import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, catchError, distinctUntilChanged, map, merge, of, switchMap, tap } from 'rxjs';
import { problemMessage } from '../../core/api/problem-message';
import { RequestsApiService } from '../../core/api/requests-api.service';
import { PagedResult } from '../../core/models/paged-result.model';
import {
  DEFAULT_QUERY,
  EMPTY_FILTERS,
  RequestFilters,
  RequestQuery,
  RequestSortField,
} from '../../core/models/request-query.model';
import { RequestDto } from '../../core/models/request.model';
import { fromQueryParams, queryKey, toQueryParams } from './request-query-url';
import { toggleSortLevel } from './sort-levels';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

type FilterPatch = Partial<
  Pick<RequestFilters, 'status' | 'priority' | 'assignedTo' | 'createdFrom' | 'createdTo'>
>;

type LoadResult = { ok: true; page: PagedResult<RequestDto> } | { ok: false; message: string };

/**
 * State of the request list. The URL is the single source of truth: actions only compute the next query and
 * navigate; the pipeline reads the route's query params, so a UI change, a refresh and a pasted link take one path.
 */
@Injectable()
export class RequestsStore {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(RequestsApiService);

  private readonly querySignal = signal<RequestQuery>(DEFAULT_QUERY);
  private readonly statusSignal = signal<LoadStatus>('idle');
  private readonly itemsSignal = signal<RequestDto[]>([]);
  private readonly totalCountSignal = signal(0);
  private readonly errorMessageSignal = signal<string | null>(null);

  /** Reloads the current query; a query change alone can't, because the pipeline ignores an unchanged query. */
  private readonly reload$ = new Subject<void>();

  /** The query of the current (or last) load. */
  readonly query = this.querySignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly items = this.itemsSignal.asReadonly();
  readonly totalCount = this.totalCountSignal.asReadonly();
  readonly errorMessage = this.errorMessageSignal.asReadonly();

  constructor() {
    const urlQuery$ = this.route.queryParamMap.pipe(
      map((params) => fromQueryParams(params)),
      tap(({ query, invalid }) => {
        if (invalid) {
          // The rewritten URL parses to the same query, so distinctUntilChanged drops it: one request.
          this.navigate(query);
        }
      }),
      map(({ query }) => query),
      distinctUntilChanged((previous, current) => queryKey(previous) === queryKey(current)),
    );
    const reloadQuery$ = this.reload$.pipe(map(() => this.querySignal()));

    merge(urlQuery$, reloadQuery$)
      .pipe(
        tap((query) => {
          this.querySignal.set(query);
          this.statusSignal.set('loading');
        }),
        // switchMap cancels the pending request when a newer query arrives. catchError stays inside it, so a
        // failed request ends only its own inner stream and later queries still load.
        switchMap((query) =>
          this.api.getPaged(query).pipe(
            map((page): LoadResult => ({ ok: true, page })),
            catchError((error: unknown) =>
              of<LoadResult>({ ok: false, message: problemMessage(error) }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.applyResult(result));
  }

  setFilters(patch: FilterPatch): void {
    this.navigate({ ...this.querySignal(), ...patch, page: 1 });
  }

  /** Resets every filter; sorting and page size are kept. */
  clearFilters(): void {
    this.navigate({ ...this.querySignal(), ...EMPTY_FILTERS, page: 1 });
  }

  toggleSort(field: RequestSortField): void {
    const query = this.querySignal();
    this.navigate({ ...query, sort: toggleSortLevel(query.sort, field), page: 1 });
  }

  resetSort(): void {
    this.navigate({ ...this.querySignal(), sort: [], page: 1 });
  }

  /** A page-size change goes back to page 1, so the user doesn't land past the end of the results. */
  setPage(page: number, pageSize: number): void {
    const query = this.querySignal();
    this.navigate({ ...query, page: pageSize === query.pageSize ? page : 1, pageSize });
  }

  retry(): void {
    this.reload$.next();
  }

  // replaceUrl: list changes don't fill the history, and back still leaves the list as it was.
  private navigate(query: RequestQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(query),
      replaceUrl: true,
    });
  }

  private applyResult(result: LoadResult): void {
    if (result.ok) {
      this.itemsSignal.set(result.page.items);
      this.totalCountSignal.set(result.page.totalCount);
      this.errorMessageSignal.set(null);
      this.statusSignal.set('success');
    } else {
      this.errorMessageSignal.set(result.message);
      this.statusSignal.set('error');
    }
  }
}
