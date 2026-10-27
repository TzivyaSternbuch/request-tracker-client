import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { RequestsApiService } from '../../../core/api/requests-api.service';
import { PagedResult } from '../../../core/models/paged-result.model';
import { StatusHistoryDto } from '../../../core/models/status-history.model';
import { HISTORY_PAGE_SIZE, RequestHistoryStore } from './request-history.store';

function anEntry(id: number): StatusHistoryDto {
  return {
    id,
    requestId: 5,
    previousStatus: 'New',
    newStatus: 'InProgress',
    changedAt: '2026-01-01T00:00:00Z',
    changedBy: 'Dana',
  };
}

function aPage(ids: number[], page: number, totalCount: number): PagedResult<StatusHistoryDto> {
  return { items: ids.map(anEntry), page, pageSize: HISTORY_PAGE_SIZE, totalCount };
}

class FakeApi {
  calls: {
    id: number;
    page: number;
    pageSize: number;
    subject: Subject<PagedResult<StatusHistoryDto>>;
  }[] = [];

  getHistory(
    id: number,
    page: number,
    pageSize: number,
  ): Observable<PagedResult<StatusHistoryDto>> {
    const subject = new Subject<PagedResult<StatusHistoryDto>>();
    this.calls.push({ id, page, pageSize, subject });
    return subject;
  }

  get last() {
    return this.calls[this.calls.length - 1];
  }
}

describe('RequestHistoryStore', () => {
  let api: FakeApi;
  let store: RequestHistoryStore;

  beforeEach(() => {
    api = new FakeApi();
    TestBed.configureTestingModule({
      providers: [RequestHistoryStore, { provide: RequestsApiService, useValue: api }],
    });
    store = TestBed.inject(RequestHistoryStore);
  });

  it('load_Pending_AsksForTheFirstPage', () => {
    store.load(5);

    expect(store.status()).toBe('loading');
    expect(api.last).toMatchObject({ id: 5, page: 1, pageSize: HISTORY_PAGE_SIZE });
  });

  it('load_Success_ShowsItemsAndTotal', () => {
    store.load(5);
    api.last.subject.next(aPage([3, 2, 1], 1, 3));

    expect(store.status()).toBe('success');
    expect(store.items().map((e) => e.id)).toEqual([3, 2, 1]);
    expect(store.totalCount()).toBe(3);
    expect(store.hasMore()).toBe(false);
  });

  it('load_NoEntries_SucceedsWithEmptyItems', () => {
    store.load(5);
    api.last.subject.next(aPage([], 1, 0));

    expect(store.status()).toBe('success');
    expect(store.items()).toEqual([]);
  });

  it('load_Error_ShowsMessageAndRetryReloads', () => {
    store.load(5);
    api.last.subject.error(new HttpErrorResponse({ status: 500, error: { title: 'Boom' } }));

    expect(store.status()).toBe('error');
    expect(store.errorMessage()).toBe('Boom');

    store.retry();
    expect(store.status()).toBe('loading');
    api.last.subject.next(aPage([1], 1, 1));
    expect(store.status()).toBe('success');
    expect(store.items()).toHaveLength(1);
  });

  it('load_DifferentId_DropsPreviousItems', () => {
    store.load(5);
    api.last.subject.next(aPage([1], 1, 1));

    store.load(6);

    expect(store.items()).toEqual([]);
  });

  it('reload_SameId_KeepsItemsWhileLoading', () => {
    store.load(5);
    api.last.subject.next(aPage([1], 1, 1));

    store.load(5);

    expect(store.status()).toBe('loading');
    expect(store.items()).toHaveLength(1);
    api.last.subject.next(aPage([2, 1], 1, 2));
    expect(store.items().map((e) => e.id)).toEqual([2, 1]);
  });

  it('loadMore_MoreEntriesExist_AppendsOlderEntriesUntilTotalReached', () => {
    store.load(5);
    api.last.subject.next(aPage([5, 4], 1, 3));
    expect(store.hasMore()).toBe(true);

    store.loadMore();
    expect(api.last).toMatchObject({ id: 5, page: 2 });
    expect(store.loadingMore()).toBe(true);
    api.last.subject.next(aPage([3], 2, 3));

    expect(store.items().map((e) => e.id)).toEqual([5, 4, 3]);
    expect(store.loadingMore()).toBe(false);
    expect(store.hasMore()).toBe(false);
  });

  it('loadMore_NothingMore_DoesNotCallTheApi', () => {
    store.load(5);
    api.last.subject.next(aPage([1], 1, 1));
    const calls = api.calls.length;

    store.loadMore();

    expect(api.calls).toHaveLength(calls);
  });

  it('loadMore_Error_KeepsLoadedItemsAndRetryAsksForTheSamePage', () => {
    store.load(5);
    api.last.subject.next(aPage([5, 4], 1, 3));
    store.loadMore();
    api.last.subject.error(new HttpErrorResponse({ status: 500 }));

    expect(store.status()).toBe('success');
    expect(store.items()).toHaveLength(2);
    expect(store.loadMoreFailed()).toBe(true);
    expect(store.loadingMore()).toBe(false);

    store.loadMore();
    expect(api.last.page).toBe(2);
    expect(store.loadMoreFailed()).toBe(false);
  });

  it('load_WhileLoadingMore_CancelsItAndStartsOverFromPageOne', () => {
    store.load(5);
    api.last.subject.next(aPage([5, 4], 1, 3));
    store.loadMore();
    const stale = api.last;

    store.load(5);
    stale.subject.next(aPage([3], 2, 3));

    expect(store.loadingMore()).toBe(false);
    expect(store.items()).toHaveLength(2);
    api.last.subject.next(aPage([6, 5], 1, 3));
    expect(store.items().map((e) => e.id)).toEqual([6, 5]);
  });
});
