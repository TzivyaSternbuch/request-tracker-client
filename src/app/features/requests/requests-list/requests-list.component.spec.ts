import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatPaginatorHarness } from '@angular/material/paginator/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { routes } from '../../../app.routes';
import { RequestsApiService } from '../../../core/api/requests-api.service';
import { PagedResult } from '../../../core/models/paged-result.model';
import { LoadStatus } from '../../../core/models/load-status.model';
import { DEFAULT_QUERY, RequestQuery } from '../../../core/models/request-query.model';
import { RequestStats } from '../../../core/models/request-stats.model';
import { RequestDto } from '../../../core/models/request.model';
import { RequestStatsStore } from '../request-stats/request-stats.store';
import { RequestsFilterBarComponent } from '../requests-filter-bar/requests-filter-bar.component';
import { RequestsTableComponent } from '../requests-table/requests-table.component';
import { RequestsStore } from '../requests.store';
import { RequestsListComponent } from './requests-list.component';

const ROW: RequestDto = {
  id: 1,
  title: 'Printer jam',
  organizationName: 'Acme',
  status: 'New',
  priority: 'High',
  assignedTo: 'dana',
  createdAt: '2026-01-02T03:04:05+00:00',
  updatedAt: '2026-01-02T03:04:05+00:00',
  version: 'AAAAAAAAB9E=',
};

// The store's public surface the page reads, with state set by each test and actions recorded.
class FakeRequestsStore {
  readonly query = signal<RequestQuery>(DEFAULT_QUERY);
  readonly status = signal<LoadStatus>('idle');
  readonly items = signal<RequestDto[]>([]);
  readonly totalCount = signal(0);
  readonly errorMessage = signal<string | null>(null);
  readonly searchDraft = signal('');
  readonly organizationDraft = signal('');
  readonly assignees = signal<string[]>([]);
  readonly assigneesError = signal(false);

  readonly setFilters = vi.fn();
  readonly clearFilters = vi.fn();
  readonly toggleSort = vi.fn();
  readonly resetSort = vi.fn();
  readonly setPage = vi.fn();
  readonly retry = vi.fn();
  readonly setSearchDraft = vi.fn();
  readonly setOrganizationDraft = vi.fn();
  readonly submitText = vi.fn();
}

class FakeRequestStatsStore {
  readonly status = signal<LoadStatus>('idle');
  readonly stats = signal<RequestStats | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly refresh = vi.fn();
}

const STATS: RequestStats = {
  asOf: '2026-10-27T12:00:00+00:00',
  countByStatus: { New: 1, InProgress: 2, Waiting: 3, Completed: 4 },
  openRequestAge: { underSevenDays: 1, sevenToUnderThirtyDays: 2, thirtyDaysOrMore: 3 },
  topAssignees: [{ assignedTo: 'dana', openCount: 6 }],
};

describe('RequestsListComponent', () => {
  let store: FakeRequestsStore;
  let statsStore: FakeRequestStatsStore;
  let fixture: ComponentFixture<RequestsListComponent>;
  let root: HTMLElement;

  beforeEach(() => {
    store = new FakeRequestsStore();
    statsStore = new FakeRequestStatsStore();
    // Replaces only the stores, so the component's other providers (the paginator labels) stay real.
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.overrideComponent(RequestsListComponent, {
      remove: { providers: [RequestsStore, RequestStatsStore] },
      add: {
        providers: [
          { provide: RequestsStore, useValue: store },
          { provide: RequestStatsStore, useValue: statsStore },
        ],
      },
    });
    fixture = TestBed.createComponent(RequestsListComponent);
    root = fixture.nativeElement as HTMLElement;
  });

  async function render(state: {
    status: LoadStatus;
    items?: RequestDto[];
    totalCount?: number;
    errorMessage?: string;
    query?: Partial<RequestQuery>;
  }): Promise<void> {
    store.status.set(state.status);
    store.items.set(state.items ?? []);
    store.totalCount.set(state.totalCount ?? 0);
    store.errorMessage.set(state.errorMessage ?? null);
    store.query.set({ ...DEFAULT_QUERY, ...state.query });
    await fixture.whenStable();
  }

  function element(selector: string): HTMLElement {
    const found = root.querySelector<HTMLElement>(selector);
    if (!found) throw new Error(`No element "${selector}"`);
    return found;
  }

  function button(container: HTMLElement, text: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(text),
    );
    if (!found) throw new Error(`No button "${text}"`);
    return found;
  }

  function paginator(): Promise<MatPaginatorHarness> {
    return TestbedHarnessEnvironment.loader(fixture).getHarness(MatPaginatorHarness);
  }

  it('render_Loading_ShowsProgressBar', async () => {
    await render({ status: 'loading', items: [ROW], totalCount: 41 });

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();
    expect(element('table').classList).toContain('loading');
    expect(root.textContent).toContain('Printer jam');
  });

  it('render_Success_ShowsRowsWithoutProgressBar', async () => {
    await render({ status: 'success', items: [ROW], totalCount: 41 });

    expect(root.querySelector('mat-progress-bar')).toBeNull();
    expect(element('table').classList).not.toContain('loading');
    expect(root.querySelectorAll('tbody tr').length).toBe(1);
    expect(await (await paginator()).getRangeLabel()).toBe('1 – 20 of 41');
  });

  it('render_Success_ShowsTotalWithThousandsSeparator', async () => {
    await render({ status: 'success', items: [ROW], totalCount: 100000 });

    expect(element('.card-header').textContent).toContain('100,000 total');
  });

  it('render_FirstLoad_HidesTotal', async () => {
    await render({ status: 'loading' });

    expect(element('.card-header').textContent?.trim()).toBe('Requests');
  });

  it('render_LoadingAfterSuccess_KeepsLastTotal', async () => {
    await render({ status: 'success', items: [ROW], totalCount: 41 });

    await render({ status: 'loading', items: [ROW], totalCount: 41 });

    expect(element('.card-header').textContent).toContain('41 total');
  });

  it('render_ErrorAfterSuccess_HidesTotal', async () => {
    await render({ status: 'success', items: [ROW], totalCount: 41 });

    await render({ status: 'error', items: [ROW], totalCount: 41, errorMessage: 'Server down' });

    expect(element('.card-header').textContent?.trim()).toBe('Requests');
  });

  it('paginator_LargeTotal_ShowsThousandsSeparators', async () => {
    await render({ status: 'success', items: [ROW], totalCount: 100000 });

    expect(await (await paginator()).getRangeLabel()).toBe('1 – 20 of 100,000');
  });

  it('render_SuccessEmpty_ShowsEmptyStateWithClearFilters', async () => {
    await render({ status: 'success', items: [], totalCount: 0, query: { status: ['New'] } });
    const empty = element('.empty-state');

    button(empty, 'Clear filters').click();

    expect(empty.textContent).toContain('No requests match these filters');
    expect(root.querySelector('table')).toBeNull();
    expect(store.clearFilters).toHaveBeenCalledOnce();
  });

  it('render_Error_ShowsMessageAndRetryCallsStore', async () => {
    // The store keeps the previous result during an error; the page must not show it.
    await render({ status: 'error', items: [ROW], totalCount: 41, errorMessage: 'Server down' });
    const alert = element('[role="alert"]');

    button(alert, 'Retry').click();

    expect(alert.textContent).toContain('Server down');
    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('mat-paginator')).toBeNull();
    expect(store.retry).toHaveBeenCalledOnce();
  });

  it('render_PageBeyondEnd_ShowsEmptyStateAndPaginator', async () => {
    await render({ status: 'success', items: [], totalCount: 3, query: { page: 999 } });
    const pages = await paginator();

    await pages.goToFirstPage();

    expect(element('.empty-state').textContent).toContain('No requests match these filters');
    expect(await pages.getRangeLabel()).toContain('of 3');
    expect(store.setPage).toHaveBeenCalledExactlyOnceWith(1, 20);
  });

  it('paginatorPage_CallsSetPage', async () => {
    await render({ status: 'success', items: [ROW], totalCount: 41 });
    const pages = await paginator();

    await pages.goToNextPage();
    await pages.setPageSize(50);

    expect(store.setPage.mock.calls).toEqual([
      [2, 20],
      [1, 50],
    ]);
  });

  it('paginatorNext_DuringPendingDraft_ShowsFirstPage', async () => {
    await render({ status: 'success', items: [ROW], totalCount: 41 });
    const pages = await paginator();
    // Pending text sends the user to page 1 of the new results: the store's page stays 1, in a new query.
    store.setPage.mockImplementation(() => store.query.set({ ...DEFAULT_QUERY, search: 'acme' }));

    await pages.goToNextPage();
    await fixture.whenStable();

    expect(store.setPage).toHaveBeenCalledExactlyOnceWith(2, 20);
    expect(await pages.getRangeLabel()).toBe('1 – 20 of 41');
  });

  it('render_PageSizeNotInOptions_ShowsItAsCurrentSize', async () => {
    await render({ status: 'success', items: [ROW], totalCount: 41, query: { pageSize: 15 } });
    const pages = await paginator();

    expect(await pages.getPageSize()).toBe(15);
    expect(await pages.getRangeLabel()).toBe('1 – 15 of 41');
  });

  it('childOutputs_Emit_CallStoreActions', async () => {
    await render({ status: 'success', items: [ROW], totalCount: 1 });
    const bar = fixture.debugElement.query(By.directive(RequestsFilterBarComponent))
      .componentInstance as RequestsFilterBarComponent;
    const table = fixture.debugElement.query(By.directive(RequestsTableComponent))
      .componentInstance as RequestsTableComponent;

    bar.searchDraftChange.emit('acme ');
    bar.organizationDraftChange.emit('glob');
    bar.textSubmit.emit();
    bar.filtersChange.emit({ priority: ['High'] });
    bar.clear.emit();
    table.sortToggle.emit('title');

    expect(store.setSearchDraft).toHaveBeenCalledExactlyOnceWith('acme ');
    expect(store.setOrganizationDraft).toHaveBeenCalledExactlyOnceWith('glob');
    expect(store.submitText).toHaveBeenCalledOnce();
    expect(store.setFilters).toHaveBeenCalledExactlyOnceWith({ priority: ['High'] });
    expect(store.clearFilters).toHaveBeenCalledOnce();
    expect(store.toggleSort).toHaveBeenCalledExactlyOnceWith('title');
  });

  it('render_StatsLoaded_ShowsOverviewAboveTable', async () => {
    statsStore.status.set('success');
    statsStore.stats.set(STATS);
    await render({ status: 'success', items: [ROW], totalCount: 1 });

    const overview = element('app-request-stats');
    const table = element('table');

    expect(overview.textContent).toContain('All requests overview');
    expect(overview.closest('section.card')).toBeNull();
    expect(overview.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('render_StatsFailed_StillShowsTheList', async () => {
    statsStore.status.set('error');
    statsStore.errorMessage.set('Stats down');
    await render({ status: 'success', items: [ROW], totalCount: 1 });

    expect(element('app-request-stats [role="alert"]').textContent).toContain('Stats down');
    expect(root.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('statsRetry_Click_RefreshesStatsOnly', async () => {
    statsStore.status.set('error');
    statsStore.errorMessage.set('Stats down');
    await render({ status: 'success', items: [ROW], totalCount: 1 });

    button(element('app-request-stats'), 'Retry').click();

    expect(statsStore.refresh).toHaveBeenCalledOnce();
    expect(store.retry).not.toHaveBeenCalled();
  });

  it('render_NoSort_ShowsDefaultNoteAndDisablesReset', async () => {
    await render({ status: 'success', items: [ROW], totalCount: 1 });

    expect(element('.sort-controls').textContent).toContain('Default order: newest first');
    expect(button(root, 'Reset sorting').disabled).toBe(true);
  });

  it('resetClick_WithSort_HidesDefaultNoteAndCallsResetSort', async () => {
    await render({
      status: 'success',
      items: [ROW],
      totalCount: 1,
      query: { sort: [{ field: 'id', direction: 'asc' }] },
    });

    button(root, 'Reset sorting').click();

    expect(element('.sort-controls').textContent).not.toContain('Default order');
    expect(store.resetSort).toHaveBeenCalledOnce();
  });
});

describe('RequestsListComponent on its route', () => {
  class FakeRequestsApi {
    readonly queries: RequestQuery[] = [];

    getPaged(query: RequestQuery): Observable<PagedResult<RequestDto>> {
      this.queries.push(query);
      return of({ items: [ROW], page: query.page, pageSize: query.pageSize, totalCount: 1 });
    }

    getAssignees(): Observable<string[]> {
      return of([]);
    }

    getStats(): Observable<RequestStats> {
      return of(STATS);
    }
  }

  it('navigate_InvalidUrl_RewritesUrlAndLoadsOnce', async () => {
    const api = new FakeRequestsApi();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: RequestsApiService, useValue: api }],
    });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/requests?page=abc&status=New', RequestsListComponent);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/requests?status=New');
    expect(api.queries).toEqual([{ ...DEFAULT_QUERY, status: ['New'] }]);
  });
});
