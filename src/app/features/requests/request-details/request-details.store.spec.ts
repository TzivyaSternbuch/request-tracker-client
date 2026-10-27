import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { RequestsApiService } from '../../../core/api/requests-api.service';
import { problemMessage } from '../../../core/api/problem-message';
import { RequestDto, UpdateStatusRequest } from '../../../core/models/request.model';
import { RequestDetailsStore } from './request-details.store';

function aRequest(overrides: Partial<RequestDto> = {}): RequestDto {
  return {
    id: 5,
    title: 'Fix the roof',
    organizationName: 'Acme',
    status: 'New',
    priority: 'High',
    assignedTo: 'Dana',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 'v1',
    ...overrides,
  };
}

function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

class FakeApi {
  gets: { id: number; subject: Subject<RequestDto> }[] = [];
  patches: { id: number; body: UpdateStatusRequest; subject: Subject<RequestDto> }[] = [];

  getById(id: number): Observable<RequestDto> {
    const subject = new Subject<RequestDto>();
    this.gets.push({ id, subject });
    return subject;
  }

  updateStatus(id: number, body: UpdateStatusRequest): Observable<RequestDto> {
    const subject = new Subject<RequestDto>();
    this.patches.push({ id, body, subject });
    return subject;
  }

  get lastGet() {
    return this.gets[this.gets.length - 1];
  }

  get lastPatch() {
    return this.patches[this.patches.length - 1];
  }
}

describe('RequestDetailsStore', () => {
  let api: FakeApi;
  let store: RequestDetailsStore;

  beforeEach(() => {
    api = new FakeApi();
    TestBed.configureTestingModule({
      providers: [RequestDetailsStore, { provide: RequestsApiService, useValue: api }],
    });
    store = TestBed.inject(RequestDetailsStore);
  });

  function loaded(request = aRequest()) {
    store.load(request.id);
    api.lastGet.subject.next(request);
  }

  it('load_Success_ShowsRequest', () => {
    store.load(5);
    expect(store.loadState()).toBe('loading');

    api.lastGet.subject.next(aRequest());

    expect(store.loadState()).toBe('success');
    expect(store.request()?.title).toBe('Fix the roof');
  });

  it('load_NotFound_ShowsNotFound', () => {
    store.load(5);

    api.lastGet.subject.error(httpError(404));

    expect(store.loadState()).toBe('notFound');
  });

  it('load_Error_ShowsMessageAndRetryReloads', () => {
    store.load(5);
    api.lastGet.subject.error(httpError(0));
    expect(store.loadState()).toBe('error');
    expect(store.errorMessage()).toBe(problemMessage(httpError(0)));

    store.retry();
    expect(store.loadState()).toBe('loading');
    api.lastGet.subject.next(aRequest());

    expect(api.gets.map((g) => g.id)).toEqual([5, 5]);
    expect(store.loadState()).toBe('success');
  });

  it('load_NewIdWhilePending_CancelsPreviousRequest', () => {
    store.load(5);
    const first = api.lastGet;
    store.load(6);

    expect(first.subject.observed).toBe(false);
    api.lastGet.subject.next(aRequest({ id: 6 }));
    expect(store.request()?.id).toBe(6);
  });

  it('load_OtherIdAfterLoaded_ClearsPreviousRequestWhileLoading', () => {
    loaded(aRequest({ id: 5 }));

    store.load(6);

    expect(store.request()).toBeNull();
    expect(store.loadState()).toBe('loading');
  });

  it('retry_AfterLoaded_KeepsRequestWhileLoading', () => {
    loaded();

    store.retry();

    expect(store.request()?.id).toBe(5);
    expect(store.loadState()).toBe('loading');
  });

  it('updated$_Consumer_CannotEmit', () => {
    expect('next' in store.updated$).toBe(false);
  });

  it('updateStatus_Success_ReplacesRequestWithResponseAndEmitsUpdated', () => {
    loaded();
    let emitted = 0;
    store.updated$.subscribe(() => emitted++);

    store.updateStatus('InProgress', 'Lee');
    expect(store.saveState()).toBe('saving');
    api.lastPatch.subject.next(
      aRequest({ status: 'InProgress', version: 'v2', updatedAt: '2026-02-01T00:00:00Z' }),
    );

    expect(store.request()).toMatchObject({
      status: 'InProgress',
      version: 'v2',
      updatedAt: '2026-02-01T00:00:00Z',
    });
    expect(store.saveState()).toBe('idle');
    expect(emitted).toBe(1);
  });

  it('updateStatus_Always_SendsHeldVersionStatusAndChangedBy', () => {
    loaded();

    store.updateStatus('Waiting', 'Lee');

    expect(api.lastPatch.id).toBe(5);
    expect(api.lastPatch.body).toEqual({ status: 'Waiting', version: 'v1', changedBy: 'Lee' });
  });

  it('updateStatus_Conflict_ReloadsAndNextSaveUsesNewVersion', () => {
    loaded();
    let emitted = 0;
    store.updated$.subscribe(() => emitted++);

    store.updateStatus('Waiting', 'Lee');
    api.lastPatch.subject.error(httpError(409));

    expect(store.conflict()).toBe(true);
    expect(store.saveState()).toBe('idle');
    expect(api.gets).toHaveLength(2);
    expect(emitted).toBe(1);

    api.lastGet.subject.next(aRequest({ status: 'InProgress', version: 'v2' }));
    store.updateStatus('Waiting', 'Lee');

    expect(api.lastPatch.body.version).toBe('v2');
    expect(store.conflict()).toBe(true);
  });

  it('dismissConflict_AfterConflict_ClearsIt', () => {
    loaded();
    store.updateStatus('Waiting', 'Lee');
    api.lastPatch.subject.error(httpError(409));

    store.dismissConflict();

    expect(store.conflict()).toBe(false);
  });

  it.each([
    [422, { title: 'Transition not allowed', detail: 'New cannot go to Completed.' }],
    [400, { title: 'Invalid', errors: { changedBy: ['Changed by is required.'] } }],
  ])('updateStatus_Rejected_ShowsServerMessageAndKeepsRequest (%i)', (status, body) => {
    loaded();

    store.updateStatus('Completed', 'Lee');
    api.lastPatch.subject.error(httpError(status, body));

    expect(store.saveError()).toBe(problemMessage(httpError(status, body)));
    expect(store.saveState()).toBe('idle');
    expect(store.request()?.version).toBe('v1');
    expect(api.gets).toHaveLength(1);
  });

  it('updateStatus_NewSave_ClearsPreviousError', () => {
    loaded();
    store.updateStatus('Completed', 'Lee');
    api.lastPatch.subject.error(httpError(422, { detail: 'No.' }));

    store.updateStatus('Waiting', 'Lee');

    expect(store.saveError()).toBeNull();
  });

  it('updateStatus_NotFound_SwitchesToNotFound', () => {
    loaded();

    store.updateStatus('Waiting', 'Lee');
    api.lastPatch.subject.error(httpError(404));

    expect(store.loadState()).toBe('notFound');
  });

  it('updateStatus_NetworkError_ShowsCannotReachServer', () => {
    loaded();

    store.updateStatus('Waiting', 'Lee');
    api.lastPatch.subject.error(httpError(0));

    expect(store.saveError()).toBe(problemMessage(httpError(0)));
    expect(store.loadState()).toBe('success');
  });

  it('updateStatus_WhileSaving_IgnoresSecondCall', () => {
    loaded();

    store.updateStatus('Waiting', 'Lee');
    store.updateStatus('Completed', 'Lee');

    expect(api.patches).toHaveLength(1);
  });
});
