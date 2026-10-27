import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusHistoryDto } from '../../../core/models/status-history.model';
import { RequestHistoryComponent } from './request-history.component';
import { RequestHistoryStore } from './request-history.store';
import { LoadStatus } from '../../../core/models/load-status.model';

function anEntry(id: number): StatusHistoryDto {
  return {
    id,
    requestId: 5,
    previousStatus: 'New',
    newStatus: 'InProgress',
    changedAt: '2026-01-31T23:59:00+00:00',
    changedBy: 'Dana Katz',
  };
}

class FakeHistoryStore {
  readonly status = signal<LoadStatus>('success');
  readonly items = signal<StatusHistoryDto[]>([]);
  readonly totalCount = signal(0);
  readonly errorMessage = signal<string | null>(null);
  readonly loadingMore = signal(false);
  readonly loadMoreFailed = signal(false);
  readonly hasMore = signal(false);

  readonly load = vi.fn();
  readonly loadMore = vi.fn();
}

describe('RequestHistoryComponent', () => {
  let store: FakeHistoryStore;
  let fixture: ComponentFixture<RequestHistoryComponent>;
  let root: HTMLElement;

  beforeEach(() => {
    store = new FakeHistoryStore();
    TestBed.overrideComponent(RequestHistoryComponent, {
      remove: { providers: [RequestHistoryStore] },
      add: { providers: [{ provide: RequestHistoryStore, useValue: store }] },
    });
    fixture = TestBed.createComponent(RequestHistoryComponent);
    fixture.componentRef.setInput('requestId', 5);
    fixture.componentRef.setInput('version', 'v1');
    root = fixture.nativeElement as HTMLElement;
  });

  async function render() {
    await fixture.whenStable();
  }

  function button(text: string): HTMLButtonElement {
    const found = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === text,
    );
    if (!found) throw new Error(`No button "${text}"`);
    return found;
  }

  it('init_RequestId_LoadsItsHistory', async () => {
    await render();

    expect(store.load).toHaveBeenCalledExactlyOnceWith(5);
  });

  it('versionChange_NewVersion_ReloadsTheHistory', async () => {
    await render();

    fixture.componentRef.setInput('version', 'v2');
    await render();

    expect(store.load).toHaveBeenCalledTimes(2);
  });

  it('entries_Loaded_ShowsChangeAuthorAndTime', async () => {
    store.items.set([anEntry(2), anEntry(1)]);
    store.totalCount.set(2);

    await render();

    expect(root.querySelectorAll('.entry')).toHaveLength(2);
    expect(root.querySelector('.meta')?.textContent).toContain('Dana Katz · 31 Jan 2026, 23:59');
    expect(root.textContent).toContain('Showing 2 of 2');
    expect(root.textContent).not.toContain('Load older');
  });

  it('entries_Empty_ShowsEmptyState', async () => {
    await render();

    expect(root.textContent).toContain('No status changes yet');
  });

  it('error_FirstPageFailed_ShowsMessageAndRetryReloads', async () => {
    store.status.set('error');
    store.errorMessage.set('Boom');
    await render();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Boom');
    button('Retry').click();
    expect(store.load).toHaveBeenLastCalledWith(5);
    expect(store.load).toHaveBeenCalledTimes(2);
  });

  it('error_ReloadFailedWithEntriesShown_ShowsMessageKeepsEntriesAndRetryReloads', async () => {
    store.items.set([anEntry(2), anEntry(1)]);
    store.totalCount.set(2);
    store.status.set('error');
    store.errorMessage.set('Boom');
    await render();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Boom');
    expect(root.querySelectorAll('.entry')).toHaveLength(2);
    button('Retry').click();
    expect(store.load).toHaveBeenLastCalledWith(5);
  });

  it('loadOlder_Reloading_IsDisabled', async () => {
    store.items.set([anEntry(2), anEntry(1)]);
    store.totalCount.set(5);
    store.hasMore.set(true);
    store.status.set('loading');
    await render();

    expect(button('Load older').disabled).toBe(true);
  });

  it('loadOlder_MoreEntriesExist_SaysSoAndLoadsThem', async () => {
    store.items.set([anEntry(2), anEntry(1)]);
    store.totalCount.set(5);
    store.hasMore.set(true);
    await render();

    expect(root.textContent).toContain('Showing 2 of 5');
    button('Load older').click();

    expect(store.loadMore).toHaveBeenCalled();
  });

  it('loadOlder_Failed_KeepsEntriesAndOffersRetry', async () => {
    store.items.set([anEntry(2), anEntry(1)]);
    store.totalCount.set(5);
    store.hasMore.set(true);
    store.loadMoreFailed.set(true);
    await render();

    expect(root.querySelectorAll('.entry')).toHaveLength(2);
    expect(root.textContent).toContain("Couldn't load older entries.");
    button('Retry').click();
    expect(store.loadMore).toHaveBeenCalled();
  });
});
