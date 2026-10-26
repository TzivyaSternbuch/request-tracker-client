import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { RequestsApiService } from '../../core/api/requests-api.service';
import { PagedResult } from '../../core/models/paged-result.model';
import {
  DEFAULT_QUERY,
  MAX_FILTER_VALUES,
  RequestQuery,
} from '../../core/models/request-query.model';
import { RequestDto } from '../../core/models/request.model';
import { RequestsStore } from './requests.store';

interface GetPagedCall {
  query: RequestQuery;
  response: Subject<PagedResult<RequestDto>>;
}

// Each call gets its own Subject, so a test decides when (and whether) a response arrives.
class FakeRequestsApi {
  readonly calls: GetPagedCall[] = [];

  getPaged(query: RequestQuery): Observable<PagedResult<RequestDto>> {
    const response = new Subject<PagedResult<RequestDto>>();
    this.calls.push({ query, response });
    return response;
  }

  lastCall(): GetPagedCall {
    return this.calls[this.calls.length - 1];
  }
}

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

describe('RequestsStore', () => {
  let api: FakeRequestsApi;
  let router: Router;

  beforeEach(() => {
    api = new FakeRequestsApi();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), RequestsStore, { provide: RequestsApiService, useValue: api }],
    });
    router = TestBed.inject(Router);
  });

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  async function createStore(url = '/'): Promise<RequestsStore> {
    await router.navigateByUrl(url);
    const store = TestBed.inject(RequestsStore);
    await settle();
    return store;
  }

  it('init_NoParams_LoadsDefaultQuery', async () => {
    const store = await createStore();
    const loadingStatus = store.status();

    api.lastCall().response.next({ items: [ROW], page: 1, pageSize: 20, totalCount: 41 });

    expect(api.calls.length).toBe(1);
    expect(api.calls[0].query).toEqual(DEFAULT_QUERY);
    expect(loadingStatus).toBe('loading');
    expect(store.status()).toBe('success');
    expect(store.items()).toEqual([ROW]);
    expect(store.totalCount()).toBe(41);
    expect(store.errorMessage()).toBeNull();
  });

  it('init_InvalidUrl_RewritesToNormalizedUrl', async () => {
    await createStore('/?page=abc&status=New');

    expect(router.url).toBe('/?status=New');
    expect(api.calls.length).toBe(1);
    expect(api.calls[0].query).toEqual({ ...DEFAULT_QUERY, status: ['New'] });
  });

  it('setFilters_StatusChange_NavigatesWithPageOneAndLoads', async () => {
    const store = await createStore('/?page=3');

    store.setFilters({ status: ['New'] });
    await settle();

    expect(router.url).toBe('/?status=New');
    expect(api.calls.length).toBe(2);
    expect(api.lastCall().query).toEqual({ ...DEFAULT_QUERY, status: ['New'], page: 1 });
    expect(store.query()).toEqual(api.lastCall().query);
  });

  it('toggleSort_Field_WritesSortParamAndResetsPage', async () => {
    const store = await createStore('/?page=3');

    store.toggleSort('title');
    await settle();

    expect(router.url).toBe('/?sort=title:asc');
    expect(api.lastCall().query).toEqual({
      ...DEFAULT_QUERY,
      sort: [{ field: 'title', direction: 'asc' }],
    });
  });

  it('resetSort_AfterSorting_RemovesSortParam', async () => {
    const store = await createStore('/?sort=title:desc&sort=id:asc&page=2');

    store.resetSort();
    await settle();

    expect(router.url).toBe('/');
    expect(api.lastCall().query).toEqual(DEFAULT_QUERY);
  });

  it('setPage_PageSizeChanged_ResetsToPageOne', async () => {
    const store = await createStore();

    store.setPage(4, 50);
    await settle();

    expect(api.lastCall().query).toEqual({ ...DEFAULT_QUERY, page: 1, pageSize: 50 });
    expect(router.url).toBe('/?pageSize=50');
  });

  it('setPage_SamePageSize_KeepsRequestedPage', async () => {
    const store = await createStore();

    store.setPage(4, 20);
    await settle();

    expect(router.url).toBe('/?page=4');
    expect(api.lastCall().query).toEqual({ ...DEFAULT_QUERY, page: 4 });
  });

  it('newQuery_WhilePending_CancelsPreviousRequest', async () => {
    const store = await createStore();
    const first = api.calls[0].response;

    store.setFilters({ priority: ['High'] });
    await settle();

    expect(api.calls.length).toBe(2);
    expect(first.observed).toBe(false);
    expect(api.lastCall().response.observed).toBe(true);
    expect(store.status()).toBe('loading');
  });

  it('retry_AfterError_ReloadsSameQuery', async () => {
    const store = await createStore('/?status=Waiting');
    api.lastCall().response.error(new HttpErrorResponse({ status: 0 }));
    const errorStatus = store.status();
    const errorMessage = store.errorMessage();

    store.retry();
    api.lastCall().response.next({ items: [ROW], page: 1, pageSize: 20, totalCount: 1 });

    expect(errorStatus).toBe('error');
    expect(errorMessage).toBe("Can't reach the server. Check your connection and try again.");
    expect(api.calls.length).toBe(2);
    expect(api.calls[1].query).toEqual(api.calls[0].query);
    expect(store.status()).toBe('success');
    expect(store.errorMessage()).toBeNull();
  });

  it('setFilters_AfterError_LoadsNewQuery', async () => {
    const store = await createStore();
    api.lastCall().response.error(new HttpErrorResponse({ status: 500 }));

    store.addAssignee('dana');
    await settle();
    api.lastCall().response.next({ items: [ROW], page: 1, pageSize: 20, totalCount: 1 });

    expect(api.calls.length).toBe(2);
    expect(api.lastCall().query).toEqual({ ...DEFAULT_QUERY, assignedTo: ['dana'] });
    expect(store.status()).toBe('success');
    expect(store.items()).toEqual([ROW]);
  });

  it('clearFilters_WithFiltersSortAndPageSize_KeepsSortAndPageSizeOnPageOne', async () => {
    const store = await createStore(
      '/?status=New&priority=Low&assignedTo=dana&createdFrom=2026-01-01&page=3&pageSize=50&sort=id:asc',
    );

    store.clearFilters();
    await settle();

    expect(api.lastCall().query).toEqual({
      ...DEFAULT_QUERY,
      pageSize: 50,
      sort: [{ field: 'id', direction: 'asc' }],
    });
  });

  it('setFilters_TwoActionsBeforeNavigationSettles_KeepsBoth', async () => {
    const store = await createStore();

    store.setFilters({ status: ['New'] });
    store.toggleSort('title');
    await settle();

    expect(router.url).toBe('/?status=New&sort=title:asc');
    expect(store.query()).toEqual({
      ...DEFAULT_QUERY,
      status: ['New'],
      sort: [{ field: 'title', direction: 'asc' }],
    });
  });

  it('addAssignee_Name_AddsTrimmedNameOnPageOne', async () => {
    const store = await createStore('/?assignedTo=ann&page=3');

    store.addAssignee('  dana ');
    await settle();

    expect(router.url).toBe('/?assignedTo=ann&assignedTo=dana');
    expect(api.lastCall().query).toEqual({ ...DEFAULT_QUERY, assignedTo: ['ann', 'dana'] });
  });

  it('addAssignee_BlankOrDuplicateOrAtLimit_DoesNotNavigate', async () => {
    const full = Array.from({ length: MAX_FILTER_VALUES }, (_, i) => `assignedTo=user${i}`);
    const store = await createStore(`/?${full.join('&')}&page=3`);
    const urlBefore = router.url;

    store.addAssignee('   ');
    store.addAssignee('user0');
    store.addAssignee('dana');
    await settle();

    expect(router.url).toBe(urlBefore);
    expect(api.calls.length).toBe(1);
  });

  it('addAssignee_TwoAddsBeforeNavigationSettles_KeepsBoth', async () => {
    const store = await createStore();

    store.addAssignee('ann');
    store.addAssignee('dana');
    await settle();

    expect(store.query()).toEqual({ ...DEFAULT_QUERY, assignedTo: ['ann', 'dana'] });
  });

  it('removeAssignee_TwoRemovesBeforeNavigationSettles_RemovesBoth', async () => {
    const store = await createStore('/?assignedTo=ann&assignedTo=dana&assignedTo=lee&page=3');

    store.removeAssignee('ann');
    store.removeAssignee('dana');
    await settle();

    expect(router.url).toBe('/?assignedTo=lee');
    expect(store.query()).toEqual({ ...DEFAULT_QUERY, assignedTo: ['lee'] });
  });

  it('sameQuery_NavigatedAgain_DoesNotReload', async () => {
    await createStore('/?status=New');

    // A different URL for the same query: the router would ignore an identical URL on its own.
    await router.navigateByUrl('/?status=New&page=1');
    await settle();

    expect(api.calls.length).toBe(1);
  });

  describe('text drafts', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function advance(ms: number): Promise<void> {
      await vi.advanceTimersByTimeAsync(ms);
      await settle();
    }

    it('setSearchDraft_Typing_NavigatesOnceAfter300ms', async () => {
      const store = await createStore();

      store.setSearchDraft('a');
      await advance(100);
      store.setSearchDraft('ac');
      await advance(100);
      store.setSearchDraft('acm');
      await advance(299);
      const callsBeforeDebounce = api.calls.length;
      await advance(1);

      expect(callsBeforeDebounce).toBe(1);
      expect(api.calls.length).toBe(2);
      expect(api.lastCall().query).toEqual({ ...DEFAULT_QUERY, search: 'acm' });
    });

    it('setOrganizationDraft_Typing_IsDebounced', async () => {
      const store = await createStore();

      store.setOrganizationDraft('a');
      await advance(100);
      store.setOrganizationDraft('ac');
      await advance(100);
      store.setOrganizationDraft('acm');
      await advance(299);
      const callsBeforeDebounce = api.calls.length;
      await advance(1);

      expect(callsBeforeDebounce).toBe(1);
      expect(api.calls.length).toBe(2);
      expect(api.lastCall().query).toEqual({ ...DEFAULT_QUERY, organizationName: 'acm' });
    });

    it('setFilters_DuringDebounce_SendsPendingTextOnce', async () => {
      const store = await createStore();

      store.setSearchDraft('ac');
      await advance(100);
      store.setFilters({ status: ['New'] });
      await settle();
      const callsAfterFilter = api.calls.length;
      await advance(400);

      expect(callsAfterFilter).toBe(2);
      expect(api.calls.length).toBe(2);
      expect(api.lastCall().query).toEqual({ ...DEFAULT_QUERY, search: 'ac', status: ['New'] });
    });

    it('setPage_DuringDebounce_ResetsToPageOne', async () => {
      const store = await createStore();

      store.setSearchDraft('ac');
      await advance(100);
      store.setPage(4, 20);
      await settle();
      await advance(400);

      expect(api.calls.length).toBe(2);
      expect(api.lastCall().query).toEqual({ ...DEFAULT_QUERY, search: 'ac', page: 1 });
    });

    it('submitText_PendingDraft_SendsImmediately', async () => {
      const store = await createStore();

      store.setSearchDraft('acme');
      store.submitText();
      await settle();

      expect(api.calls.length).toBe(2);
      expect(api.lastCall().query).toEqual({ ...DEFAULT_QUERY, search: 'acme' });
      expect(router.url).toBe('/?search=acme');
    });

    it('submitText_UnchangedQuery_Reloads', async () => {
      const store = await createStore('/?search=acme');

      store.submitText();
      await settle();

      expect(api.calls.length).toBe(2);
      expect(api.calls[1].query).toEqual(api.calls[0].query);
    });

    it('setSearchDraft_TrailingSpace_DraftKeepsSpaceAndQueryTrims', async () => {
      const store = await createStore();

      store.setSearchDraft('acme ');
      await advance(300);

      expect(store.searchDraft()).toBe('acme ');
      expect(store.query().search).toBe('acme');
      expect(router.url).toBe('/?search=acme');
    });

    it('setSearchDraft_ResponseArrivesWhileTyping_DraftUnchanged', async () => {
      const store = await createStore();
      store.setSearchDraft('ac');
      // Synchronous: the debounce fires and the store navigates to `?search=ac`, but the navigation hasn't settled.
      vi.advanceTimersByTime(300);

      // The URL update and its response land after the next keystroke.
      store.setSearchDraft('acme ');
      await settle();
      api.lastCall().response.next({ items: [ROW], page: 1, pageSize: 20, totalCount: 1 });
      await settle();

      expect(router.url).toBe('/?search=ac');
      expect(store.status()).toBe('success');
      expect(store.searchDraft()).toBe('acme ');
    });

    it('outsideNavigation_UrlChanges_ResetsDrafts', async () => {
      const store = await createStore();
      store.setSearchDraft('alpha');
      store.setOrganizationDraft('Ac');
      await advance(300);

      await router.navigateByUrl('/?search=beta');
      await settle();

      expect(store.searchDraft()).toBe('beta');
      expect(store.organizationDraft()).toBe('');
      expect(store.query()).toEqual({ ...DEFAULT_QUERY, search: 'beta' });
    });

    it('clearFilters_WithDrafts_ClearsDraftsAndFilters', async () => {
      const store = await createStore(
        '/?search=acme&organizationName=Ac&status=New&page=3&pageSize=50&sort=title:asc',
      );
      store.setSearchDraft('acme x');

      store.clearFilters();
      await settle();
      const callsAfterClear = api.calls.length;
      await advance(400);

      expect(store.searchDraft()).toBe('');
      expect(store.organizationDraft()).toBe('');
      expect(router.url).toBe('/?pageSize=50&sort=title:asc');
      expect(store.query()).toEqual({
        ...DEFAULT_QUERY,
        pageSize: 50,
        sort: [{ field: 'title', direction: 'asc' }],
      });
      expect(api.calls.length).toBe(callsAfterClear);
    });
  });
});
