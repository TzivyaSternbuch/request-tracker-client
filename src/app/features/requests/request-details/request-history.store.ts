import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { problemMessage } from '../../../core/api/problem-message';
import { RequestsApiService } from '../../../core/api/requests-api.service';
import { LoadStatus } from '../../../core/models/load-status.model';
import { StatusHistoryDto } from '../../../core/models/status-history.model';

export const HISTORY_PAGE_SIZE = 10;

interface PageQuery {
  id: number;
  page: number;
}

type PageResult =
  | { ok: true; query: PageQuery; items: StatusHistoryDto[]; totalCount: number }
  | { ok: false; query: PageQuery; message: string };

@Injectable()
export class RequestHistoryStore {
  private readonly api = inject(RequestsApiService);

  private readonly statusSignal = signal<LoadStatus>('idle');
  private readonly itemsSignal = signal<StatusHistoryDto[]>([]);
  private readonly totalCountSignal = signal(0);
  private readonly errorMessageSignal = signal<string | null>(null);
  private readonly loadingMoreSignal = signal(false);
  private readonly loadMoreFailedSignal = signal(false);

  private readonly query$ = new Subject<PageQuery>();
  private currentId: number | null = null;

  readonly status = this.statusSignal.asReadonly();
  readonly items = this.itemsSignal.asReadonly();
  readonly totalCount = this.totalCountSignal.asReadonly();
  readonly errorMessage = this.errorMessageSignal.asReadonly();
  readonly loadingMore = this.loadingMoreSignal.asReadonly();
  readonly loadMoreFailed = this.loadMoreFailedSignal.asReadonly();
  readonly hasMore = computed(() => this.itemsSignal().length < this.totalCountSignal());

  constructor() {
    this.query$
      .pipe(
        switchMap((query) =>
          this.api.getHistory(query.id, query.page, HISTORY_PAGE_SIZE).pipe(
            map((result): PageResult => ({
              ok: true,
              query,
              items: result.items,
              totalCount: result.totalCount,
            })),
            catchError((error: unknown) =>
              of<PageResult>({ ok: false, query, message: problemMessage(error) }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.onResult(result));
  }

  load(id: number): void {
    if (id !== this.currentId) {
      this.itemsSignal.set([]);
      this.totalCountSignal.set(0);
    }
    this.currentId = id;
    this.statusSignal.set('loading');
    this.loadingMoreSignal.set(false);
    this.loadMoreFailedSignal.set(false);
    this.query$.next({ id, page: 1 });
  }

  loadMore(): void {
    if (this.currentId === null || !this.hasMore() || this.loadingMoreSignal()) return;
    if (this.statusSignal() !== 'success') return;

    this.loadingMoreSignal.set(true);
    this.loadMoreFailedSignal.set(false);
    // More entries exist, so every page loaded so far was full: the next page follows from the item count.
    const nextPage = Math.floor(this.itemsSignal().length / HISTORY_PAGE_SIZE) + 1;
    this.query$.next({ id: this.currentId, page: nextPage });
  }

  private onResult(result: PageResult): void {
    const firstPage = result.query.page === 1;
    if (!result.ok) {
      if (firstPage) {
        this.errorMessageSignal.set(result.message);
        this.statusSignal.set('error');
      } else {
        this.loadMoreFailedSignal.set(true);
        this.loadingMoreSignal.set(false);
      }
      return;
    }

    this.itemsSignal.update((current) =>
      firstPage ? result.items : [...current, ...result.items],
    );
    this.totalCountSignal.set(result.totalCount);
    this.errorMessageSignal.set(null);
    this.statusSignal.set('success');
    this.loadingMoreSignal.set(false);
  }
}
