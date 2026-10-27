import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { RequestsApiService } from '../../../core/api/requests-api.service';
import { RequestStats } from '../../../core/models/request-stats.model';
import { RequestStatsStore } from './request-stats.store';

// Each call gets its own Subject, so a test decides when (and whether) a response arrives.
class FakeRequestsApi {
  readonly responses: Subject<RequestStats>[] = [];

  getStats(): Observable<RequestStats> {
    const response = new Subject<RequestStats>();
    this.responses.push(response);
    return response;
  }

  last(): Subject<RequestStats> {
    return this.responses[this.responses.length - 1];
  }
}

const STATS: RequestStats = {
  asOf: '2026-10-27T12:00:00+00:00',
  countByStatus: { New: 2, InProgress: 1, Waiting: 0, Completed: 3 },
  openRequestAge: { underSevenDays: 1, sevenToUnderThirtyDays: 2, thirtyDaysOrMore: 0 },
  topAssignees: [{ assignedTo: 'Dana', openCount: 2 }],
};

describe('RequestStatsStore', () => {
  let api: FakeRequestsApi;

  beforeEach(() => {
    api = new FakeRequestsApi();
    TestBed.configureTestingModule({
      providers: [RequestStatsStore, { provide: RequestsApiService, useValue: api }],
    });
  });

  async function createStore(): Promise<RequestStatsStore> {
    const store = TestBed.inject(RequestStatsStore);
    await TestBed.inject(ApplicationRef).whenStable();
    return store;
  }

  it('init_Created_LoadsOnceAndShowsLoading', async () => {
    const store = await createStore();

    expect(api.responses.length).toBe(1);
    expect(store.status()).toBe('loading');
    expect(store.stats()).toBeNull();
  });

  it('init_ResponseArrives_SetsStatsAndSuccess', async () => {
    const store = await createStore();

    api.last().next(STATS);

    expect(store.status()).toBe('success');
    expect(store.stats()).toEqual(STATS);
    expect(store.errorMessage()).toBeNull();
  });

  it('init_RequestFails_SetsErrorAndKeepsNoStats', async () => {
    const store = await createStore();

    api.last().error(new HttpErrorResponse({ status: 0 }));

    expect(store.status()).toBe('error');
    expect(store.errorMessage()).toContain("Can't reach the server");
    expect(store.stats()).toBeNull();
  });

  it('refresh_AfterSuccess_ReloadsAndKeepsPreviousStatsWhileLoading', async () => {
    const store = await createStore();
    api.last().next(STATS);

    store.refresh();

    expect(api.responses.length).toBe(2);
    expect(store.status()).toBe('loading');
    expect(store.stats()).toEqual(STATS);

    const updated = { ...STATS, countByStatus: { ...STATS.countByStatus, New: 1, Waiting: 1 } };
    api.last().next(updated);

    expect(store.stats()).toEqual(updated);
  });

  it('refresh_AfterError_RetriesAndRecovers', async () => {
    const store = await createStore();
    api.last().error(new HttpErrorResponse({ status: 500 }));

    store.refresh();
    api.last().next(STATS);

    expect(store.status()).toBe('success');
    expect(store.errorMessage()).toBeNull();
  });

  it('refresh_WhileLoading_IgnoresTheOlderResponse', async () => {
    const store = await createStore();
    const first = api.last();

    store.refresh();
    first.next({ ...STATS, countByStatus: { ...STATS.countByStatus, New: 99 } });

    expect(store.stats()).toBeNull();

    api.last().next(STATS);

    expect(store.stats()).toEqual(STATS);
  });
});
