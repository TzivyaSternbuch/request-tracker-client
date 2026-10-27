import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  distinctUntilChanged,
  map,
  merge,
  of,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { problemMessage } from '../../core/api/problem-message';
import { RequestsApiService } from '../../core/api/requests-api.service';
import { PagedResult } from '../../core/models/paged-result.model';
import {
  DEFAULT_QUERY,
  EMPTY_FILTERS,
  ImmediateFilters,
  MAX_FILTER_VALUES,
  RequestQuery,
  RequestSortField,
} from '../../core/models/request-query.model';
import { RequestDto } from '../../core/models/request.model';
import { fromQueryParams, queryKey, toQueryParams } from './request-query-url';
import { toggleSortLevel } from './sort-levels';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

type LoadResult = { ok: true; page: PagedResult<RequestDto> } | { ok: false; message: string };

const TEXT_DEBOUNCE_MS = 300;

/** Trimmed, non-blank, distinct (case-sensitive) names in order, cut at the filter limit. */
function cleanNames(names: readonly string[]): string[] {
  const trimmed = names.map((name) => name.trim()).filter((name) => name !== '');
  return [...new Set(trimmed)].slice(0, MAX_FILTER_VALUES);
}

/**
 * State of the request list. The URL is the single source of truth: actions only compute the next query and
 * navigate; the pipeline reads the route's query params, so a UI change, a refresh and a pasted link take one path.
 *
 * Search and organization are edited as drafts: the text boxes show the drafts, not the URL, so the URL round trip
 * never overwrites what the user is typing. A draft reaches the URL after 300 ms without typing, on `submitText()`,
 * or with the next immediate action, whichever comes first.
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
  private readonly searchDraftSignal = signal('');
  private readonly organizationDraftSignal = signal('');
  private readonly assigneesSignal = signal<string[]>([]);
  private readonly assigneesErrorSignal = signal(false);

  /** Reloads the current query; a query change alone can't, because the pipeline ignores an unchanged query. */
  private readonly reload$ = new Subject<void>();

  /** `'start'` (re)starts the debounce of the text drafts; `'cancel'` drops it. */
  private readonly textDebounce$ = new Subject<'start' | 'cancel'>();

  /**
   * The query the store last navigated to, or `null` before the first write and after an outside navigation.
   * Actions build on it rather than on `query()`, which lags until the navigation settles, so two actions in a row
   * don't drop the first. Its key also tells the store's own URL updates from outside ones.
   */
  private lastWritten: RequestQuery | null = null;

  /** The query of the current (or last) load. */
  readonly query = this.querySignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  // These three keep the previous result during 'loading' and 'error'; consumers branch on status().
  readonly items = this.itemsSignal.asReadonly();
  readonly totalCount = this.totalCountSignal.asReadonly();
  readonly errorMessage = this.errorMessageSignal.asReadonly();
  /** The untrimmed text in the search box. */
  readonly searchDraft = this.searchDraftSignal.asReadonly();
  /** The untrimmed text in the organization box. */
  readonly organizationDraft = this.organizationDraftSignal.asReadonly();
  /** Every assignee name, loaded once when the store starts; stays empty if that load fails. */
  readonly assignees = this.assigneesSignal.asReadonly();
  readonly assigneesError = this.assigneesErrorSignal.asReadonly();

  constructor() {
    this.api
      .getAssignees()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (names) => this.assigneesSignal.set(names),
        error: () => this.assigneesErrorSignal.set(true),
      });

    const urlQuery$ = this.route.queryParamMap.pipe(
      map((params) => fromQueryParams(params)),
      tap(({ query, invalid }) => {
        if (this.lastWritten === null || queryKey(query) !== queryKey(this.lastWritten)) {
          this.adoptOutsideNavigation(query);
        }
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

    this.textDebounce$
      .pipe(
        switchMap((command) => (command === 'start' ? timer(TEXT_DEBOUNCE_MS) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.navigate(this.nextQuery()));
  }

  setSearchDraft(text: string): void {
    this.searchDraftSignal.set(text);
    this.textDebounce$.next('start');
  }

  setOrganizationDraft(text: string): void {
    this.organizationDraftSignal.set(text);
    this.textDebounce$.next('start');
  }

  /** Enter in a text box: sends the drafts now, or reloads when the query is unchanged (the same trigger as Retry). */
  submitText(): void {
    const next = this.nextQuery();
    if (queryKey(next) === queryKey(this.querySignal())) {
      // Nothing is written, so drop the pending debounce here; navigate() does it otherwise.
      this.textDebounce$.next('cancel');
      this.reload$.next();
    } else {
      this.navigate(next);
    }
  }

  setFilters(patch: ImmediateFilters): void {
    const next = patch.assignedTo ? { ...patch, assignedTo: cleanNames(patch.assignedTo) } : patch;
    this.navigate({ ...this.nextQuery(), ...next, page: 1 });
  }

  /** Resets every filter and both drafts; sorting and page size are kept. */
  clearFilters(): void {
    this.searchDraftSignal.set('');
    this.organizationDraftSignal.set('');
    this.navigate({ ...this.nextQuery(), ...EMPTY_FILTERS, page: 1 });
  }

  toggleSort(field: RequestSortField): void {
    const query = this.nextQuery();
    this.navigate({ ...query, sort: toggleSortLevel(query.sort, field), page: 1 });
  }

  resetSort(): void {
    this.navigate({ ...this.nextQuery(), sort: [], page: 1 });
  }

  /**
   * The clicked page belongs to the results on screen. Pending text or a page-size change means other results, so it
   * goes back to page 1 and the user doesn't land past the end.
   */
  setPage(page: number, pageSize: number): void {
    const sameResults = !this.hasPendingText() && pageSize === this.base().pageSize;
    this.navigate({ ...this.nextQuery(), page: sameResults ? page : 1, pageSize });
  }

  retry(): void {
    this.reload$.next();
  }

  /**
   * The base for every action: the last written query with the trimmed drafts applied (a text change goes back to
   * page 1). It has no side effects; navigate() drops the pending debounce.
   */
  private nextQuery(): RequestQuery {
    const base = this.base();
    return {
      ...base,
      search: this.searchDraftSignal().trim(),
      organizationName: this.organizationDraftSignal().trim(),
      page: this.hasPendingText() ? 1 : base.page,
    };
  }

  private base(): RequestQuery {
    return this.lastWritten ?? this.querySignal();
  }

  /** The trimmed drafts differ from the base: a text filter change is waiting to be written. */
  private hasPendingText(): boolean {
    const base = this.base();
    return (
      this.searchDraftSignal().trim() !== base.search ||
      this.organizationDraftSignal().trim() !== base.organizationName
    );
  }

  /** Refresh, a pasted link, back/forward: the URL wins over the drafts and over any pending text. */
  private adoptOutsideNavigation(query: RequestQuery): void {
    this.textDebounce$.next('cancel');
    this.lastWritten = null;
    this.searchDraftSignal.set(query.search);
    this.organizationDraftSignal.set(query.organizationName);
  }

  /**
   * The single URL write. Every write is built from nextQuery(), so it carries the drafts and the pending debounce
   * has nothing left to send. replaceUrl: list changes don't fill the history, and back still leaves the list as it
   * was.
   */
  private navigate(query: RequestQuery): void {
    this.textDebounce$.next('cancel');
    this.lastWritten = query;
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
