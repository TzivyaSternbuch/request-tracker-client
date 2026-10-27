import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { ActingAsService } from '../../../core/acting-as.service';
import { RequestsApiService } from '../../../core/api/requests-api.service';
import {
  BulkUpdateStatusRequest,
  BulkUpdateStatusResult,
} from '../../../core/models/bulk-update.model';
import { DEFAULT_QUERY, RequestQuery } from '../../../core/models/request-query.model';
import { RequestDto } from '../../../core/models/request.model';
import { RequestStatsStore } from '../request-stats/request-stats.store';
import { RequestsStore } from '../requests.store';
import { BulkUpdateStore } from './bulk-update.store';

function aRequest(id: number): RequestDto {
  return {
    id,
    title: `Request ${id}`,
    organizationName: 'Acme',
    status: 'New',
    priority: 'High',
    assignedTo: 'Dana',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: `v${id}`,
    allowedStatuses: [],
  };
}

class FakeApi {
  calls: { body: BulkUpdateStatusRequest; subject: Subject<BulkUpdateStatusResult> }[] = [];

  bulkUpdateStatus(body: BulkUpdateStatusRequest): Observable<BulkUpdateStatusResult> {
    const subject = new Subject<BulkUpdateStatusResult>();
    this.calls.push({ body, subject });
    return subject;
  }

  get last() {
    return this.calls[this.calls.length - 1];
  }
}

class FakeListStore {
  readonly items = signal<RequestDto[]>([]);
  readonly query = signal<RequestQuery>(DEFAULT_QUERY);
  retry = vi.fn();
}

describe('BulkUpdateStore', () => {
  let api: FakeApi;
  let list: FakeListStore;
  let stats: { refresh: ReturnType<typeof vi.fn> };
  let store: BulkUpdateStore;

  beforeEach(() => {
    api = new FakeApi();
    list = new FakeListStore();
    list.items.set([aRequest(1), aRequest(2), aRequest(3)]);
    stats = { refresh: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        BulkUpdateStore,
        { provide: RequestsApiService, useValue: api },
        { provide: RequestsStore, useValue: list },
        { provide: RequestStatsStore, useValue: stats },
      ],
    });
    TestBed.inject(ActingAsService).setName('Dana');
    store = TestBed.inject(BulkUpdateStore);
    TestBed.tick();
  });

  function submitCompleted(ids: number[]) {
    ids.forEach((id) => store.toggle(id));
    store.startChoosing();
    store.setDraftStatus('Completed');
    store.submit();
  }

  it('toggleAll_NotAllSelected_SelectsEveryRowOfThePage', () => {
    store.toggle(1);

    store.toggleAll();

    expect(store.count()).toBe(3);
    expect(store.allSelected()).toBe(true);
  });

  it('toggleAll_AllSelected_ClearsSelection', () => {
    store.toggleAll();

    store.toggleAll();

    expect(store.count()).toBe(0);
  });

  it('toggle_AtTheLimit_IgnoresTheNextRow', () => {
    list.items.set(Array.from({ length: 101 }, (_, i) => aRequest(i + 1)));
    for (let id = 1; id <= 100; id++) store.toggle(id);

    store.toggle(101);

    expect(store.count()).toBe(100);
    expect(store.limitReached()).toBe(true);
  });

  it('submit_Selection_SendsVersionsFromTheListAndTheActingAsName', () => {
    submitCompleted([1, 3]);

    expect(api.last.body).toEqual({
      items: [
        { id: 1, version: 'v1' },
        { id: 3, version: 'v3' },
      ],
      status: 'Completed',
      changedBy: 'Dana',
    });
    expect(store.saving()).toBe(true);
  });

  it('submit_NoActingAsName_DoesNotCallTheApi', () => {
    TestBed.inject(ActingAsService).setName('  ');
    store.toggle(1);
    store.startChoosing();
    store.setDraftStatus('Completed');

    store.submit();

    expect(api.calls).toHaveLength(0);
    expect(store.canSubmit()).toBe(false);
  });

  it('submit_PartialSuccess_KeepsFailedRowsSelectedAndReloadsTheList', () => {
    submitCompleted([1, 2, 3]);

    api.last.subject.next({
      succeeded: [1],
      failed: [
        { id: 2, reason: 'Conflict' },
        { id: 3, reason: 'InvalidTransition' },
      ],
    });

    expect(store.result()).toEqual({
      updatedCount: 1,
      failed: [
        { id: 2, title: 'Request 2', reason: 'Conflict', toStatus: 'Completed' },
        {
          id: 3,
          title: 'Request 3',
          reason: 'InvalidTransition',
          toStatus: 'Completed',
        },
      ],
    });
    expect(store.selectedItems().map((item) => item.id)).toEqual([2, 3]);
    expect(store.saving()).toBe(false);
    expect(list.retry).toHaveBeenCalledTimes(1);
    expect(stats.refresh).toHaveBeenCalledTimes(1);
  });

  it('submit_BadRequest_ShowsTheServerMessageAndKeepsTheSelection', () => {
    submitCompleted([1]);

    api.last.subject.error(
      new HttpErrorResponse({ status: 400, error: { detail: 'Items is required.' } }),
    );

    expect(store.errorMessage()).toBe('Items is required.');
    expect(store.count()).toBe(1);
    expect(store.saving()).toBe(false);
    expect(list.retry).not.toHaveBeenCalled();
  });

  it('query_Changes_ClearsSelectionAndResult', () => {
    submitCompleted([1]);
    api.last.subject.next({ succeeded: [], failed: [{ id: 1, reason: 'NotFound' }] });

    list.query.set({ ...DEFAULT_QUERY, page: 2 });
    TestBed.tick();

    expect(store.count()).toBe(0);
    expect(store.result()).toBeNull();
  });

  it('query_ReloadedWithSameKey_KeepsSelection', () => {
    store.toggle(1);

    list.query.set({ ...DEFAULT_QUERY });
    TestBed.tick();

    expect(store.count()).toBe(1);
  });
});
