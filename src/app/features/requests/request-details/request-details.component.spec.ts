import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { ActingAsService } from '../../../core/acting-as.service';
import { RequestDto, RequestStatus } from '../../../core/models/request.model';
import { RequestsStore } from '../requests.store';
import { DetailsLoadState, RequestDetailsStore, SaveState } from './request-details.store';
import { RequestDetailsComponent } from './request-details.component';

const REQUEST: RequestDto = {
  id: 5,
  title: 'Fix the roof',
  organizationName: 'Acme Ltd',
  status: 'New',
  priority: 'High',
  assignedTo: 'Dana Katz',
  createdAt: '2026-01-31T23:59:00+00:00',
  updatedAt: '2026-02-01T08:05:00+00:00',
  version: 'AAAAAAAAB9E=',
};

class FakeDetailsStore {
  readonly loadState = signal<DetailsLoadState>('success');
  readonly request = signal<RequestDto | null>(REQUEST);
  readonly errorMessage = signal<string | null>(null);
  readonly saveState = signal<SaveState>('idle');
  readonly saveError = signal<string | null>(null);
  readonly conflict = signal(false);
  readonly updated$ = new Subject<void>();

  readonly load = vi.fn();
  readonly retry = vi.fn();
  readonly updateStatus = vi.fn<(status: RequestStatus, changedBy: string) => void>();
  readonly dismissConflict = vi.fn();
  readonly clearSaveError = vi.fn();
}

describe('RequestDetailsComponent', () => {
  let store: FakeDetailsStore;
  let listStore: { retry: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<RequestDetailsComponent>;
  let root: HTMLElement;

  let dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean };

  beforeEach(() => {
    dialogRef = { close: vi.fn(), disableClose: false };
    store = new FakeDetailsStore();
    listStore = { retry: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { id: 5 } },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: RequestsStore, useValue: listStore },
      ],
    });
    TestBed.overrideComponent(RequestDetailsComponent, {
      remove: { providers: [RequestDetailsStore] },
      add: { providers: [{ provide: RequestDetailsStore, useValue: store }] },
    });
    fixture = TestBed.createComponent(RequestDetailsComponent);
    root = fixture.nativeElement as HTMLElement;
  });

  async function render() {
    await fixture.whenStable();
  }

  function button(text: string): HTMLButtonElement {
    const found = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === text || b.getAttribute('aria-label') === text,
    );
    if (!found) throw new Error(`No button "${text}"`);
    return found;
  }

  async function openPanel() {
    button('Change status').click();
    await fixture.whenStable();
  }

  async function chooseStatus(value: string) {
    const select = root.querySelector('select') as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  async function typeName(value: string) {
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('render_Loading_ShowsProgress', async () => {
    store.loadState.set('loading');
    store.request.set(null);

    await render();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();
    expect(root.querySelector('dl')).toBeNull();
  });

  it('render_Error_ShowsMessageAndRetry', async () => {
    store.loadState.set('error');
    store.errorMessage.set('Something went wrong.');
    await render();

    expect(root.textContent).toContain('Something went wrong.');
    button('Retry').click();

    expect(store.retry).toHaveBeenCalledOnce();
  });

  it('render_NotFound_ShowsNotFoundAndClose', async () => {
    store.loadState.set('notFound');
    store.request.set(null);

    await render();

    expect(root.textContent).toContain("This request doesn't exist or was removed");
    expect(button('Close')).toBeTruthy();
  });

  it('render_Success_ShowsEveryFieldAndNoVersion', async () => {
    await render();

    const text = root.textContent ?? '';
    expect(text).toContain('REQUEST #5');
    expect(text).toContain('Fix the roof');
    expect(text).toContain('Acme Ltd');
    expect(text).toContain('Dana Katz');
    expect(text).toContain('High');
    expect(text).toContain('New');
    expect(text).toContain('31 Jan 2026, 23:59 UTC');
    expect(text).toContain('1 Feb 2026, 08:05 UTC');
    expect(text).not.toContain(REQUEST.version);
  });

  it('statusPanel_Open_OffersAllStatuses', async () => {
    await render();

    await openPanel();

    const options = Array.from(root.querySelectorAll('select option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(options).toEqual(['', 'New', 'In progress', 'Waiting', 'Completed']);
  });

  it('statusPanel_Reopened_StartsFromToolbarName', async () => {
    TestBed.inject(ActingAsService).setName('Dana Katz');
    await render();
    await openPanel();
    await typeName('Someone Else');
    button('Cancel').click();
    await fixture.whenStable();

    await openPanel();

    expect((root.querySelector('input') as HTMLInputElement).value).toBe('Dana Katz');
    expect(TestBed.inject(ActingAsService).name()).toBe('Dana Katz');
  });

  it('statusPanel_NoStatusChosen_DisablesSave', async () => {
    TestBed.inject(ActingAsService).setName('Dana');
    await render();

    await openPanel();

    expect(button('Save changes').disabled).toBe(true);
  });

  it('statusPanel_BlankChangedBy_DisablesSave', async () => {
    await render();
    await openPanel();

    await chooseStatus('Waiting');
    await typeName('   ');

    expect(button('Save changes').disabled).toBe(true);
  });

  it('statusPanel_Save_CallsStoreWithStatusAndTrimmedName', async () => {
    await render();
    await openPanel();

    await chooseStatus('InProgress');
    await typeName('  Lee  ');
    button('Save changes').click();

    expect(store.updateStatus).toHaveBeenCalledWith('InProgress', 'Lee');
  });

  it('statusPanel_SaveError_ShowsServerMessageAndStaysOpen', async () => {
    await render();
    await openPanel();

    store.saveError.set('New cannot go to Completed.');
    await fixture.whenStable();

    expect(root.querySelector('form')).not.toBeNull();
    expect(root.querySelector('.error')?.textContent).toContain('New cannot go to Completed.');
  });

  it('render_Saving_BlocksClosingTheDialog', async () => {
    await render();
    expect(dialogRef.disableClose).toBe(false);

    store.saveState.set('saving');
    await fixture.whenStable();

    expect(dialogRef.disableClose).toBe(true);
    expect(button('Close').disabled).toBe(true);

    store.saveState.set('idle');
    await fixture.whenStable();

    expect(dialogRef.disableClose).toBe(false);
    expect(button('Close').disabled).toBe(false);
  });

  it('render_Conflict_ShowsSomeoneElseChangedMessage', async () => {
    store.conflict.set(true);

    await render();

    expect(root.textContent).toContain('Someone else changed this request');
  });

  it('updated_Emitted_ReloadsListAndClosesPanel', async () => {
    await render();
    await openPanel();

    store.updated$.next();
    await fixture.whenStable();

    expect(listStore.retry).toHaveBeenCalledOnce();
    expect(root.querySelector('form')).toBeNull();
  });
});
