import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActingAsService } from '../../../core/acting-as.service';
import { REQUEST_STATUSES, RequestStatus } from '../../../core/models/request.model';
import { StatusPillComponent } from '../../../shared/status-pill/status-pill.component';
import { valueLabel } from '../../../shared/value-label';
import { RequestStatsStore } from '../request-stats/request-stats.store';
import { RequestsStore } from '../requests.store';
import { RequestDetailsStore } from './request-details.store';
import { RequestHistoryComponent } from './request-history.component';

export interface RequestDetailsData {
  id: number;
}

/**
 * The dialog content: every field of one request and the status change panel. The list's store is optional so the
 * component renders without a list behind it; when present, it reloads after every update the store reports.
 */
@Component({
  selector: 'app-request-details',
  imports: [
    DatePipe,
    MatButtonModule,
    MatProgressBarModule,
    RequestHistoryComponent,
    StatusPillComponent,
  ],
  providers: [RequestDetailsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-details.component.html',
  styleUrl: './request-details.component.scss',
})
export class RequestDetailsComponent {
  protected readonly store = inject(RequestDetailsStore);
  private readonly actingAs = inject(ActingAsService);
  private readonly dialogRef = inject(MatDialogRef);
  private readonly listStore = inject(RequestsStore, { optional: true });
  private readonly statsStore = inject(RequestStatsStore, { optional: true });
  private readonly data = inject<RequestDetailsData>(MAT_DIALOG_DATA);

  protected readonly statuses = REQUEST_STATUSES;
  protected readonly valueLabel = valueLabel;

  protected readonly panelOpen = signal(false);
  protected readonly draftStatus = signal<RequestStatus | ''>('');
  protected readonly draftName = signal('');

  protected readonly saving = computed(() => this.store.saveState() === 'saving');
  protected readonly canSave = computed(
    () => this.draftStatus() !== '' && this.draftName().trim() !== '' && !this.saving(),
  );
  // A reload keeps the request on screen (dimmed); only the first load has nothing to show yet.
  protected readonly showContent = computed(
    () =>
      this.store.request() !== null &&
      (this.store.loadState() === 'success' || this.store.loadState() === 'loading'),
  );

  constructor() {
    // Esc and the backdrop would otherwise close the dialog mid-save and abort the request, leaving the list stale.
    effect(() => (this.dialogRef.disableClose = this.saving()));
    this.store.load(this.data.id);
    this.store.updated$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.panelOpen.set(false);
      this.listStore?.retry();
      this.statsStore?.refresh();
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected openPanel(): void {
    this.store.dismissConflict();
    this.store.clearSaveError();
    this.draftStatus.set('');
    // A new change gets a new `changedBy`: it starts from the toolbar name and editing it leaves the toolbar alone.
    this.draftName.set(this.actingAs.name());
    this.panelOpen.set(true);
  }

  protected closePanel(): void {
    this.panelOpen.set(false);
  }

  protected onStatusChange(event: Event): void {
    this.draftStatus.set((event.target as HTMLSelectElement).value as RequestStatus | '');
  }

  protected onNameInput(event: Event): void {
    this.draftName.set((event.target as HTMLInputElement).value);
  }

  protected save(): void {
    const status = this.draftStatus();
    if (!this.canSave() || status === '') return;
    this.store.updateStatus(status, this.draftName().trim());
  }
}
