import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActingAsService } from '../../../core/acting-as.service';
import { problemMessage } from '../../../core/api/problem-message';
import { RequestsApiService } from '../../../core/api/requests-api.service';
import { BulkFailureReason, MAX_BULK_ITEMS } from '../../../core/models/bulk-update.model';
import { RequestStatus } from '../../../core/models/request.model';
import { RequestStatsStore } from '../request-stats/request-stats.store';
import { queryKey } from '../request-query-url';
import { RequestsStore } from '../requests.store';

export interface FailedItem {
  id: number;
  title: string;
  reason: BulkFailureReason;
  /** The status that was requested; the status the server compared it with is not known here. */
  toStatus: RequestStatus;
}

export interface BulkResult {
  updatedCount: number;
  failed: FailedItem[];
}

@Injectable()
export class BulkUpdateStore {
  private readonly api = inject(RequestsApiService);
  private readonly listStore = inject(RequestsStore);
  private readonly statsStore = inject(RequestStatsStore, { optional: true });
  private readonly actingAs = inject(ActingAsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly selectedIdsSignal = signal<ReadonlySet<number>>(new Set());
  private readonly choosingSignal = signal(false);
  private readonly draftStatusSignal = signal<RequestStatus | ''>('');
  private readonly savingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly resultSignal = signal<BulkResult | null>(null);

  readonly selectedIds = this.selectedIdsSignal.asReadonly();
  readonly choosing = this.choosingSignal.asReadonly();
  readonly draftStatus = this.draftStatusSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();
  readonly errorMessage = this.errorSignal.asReadonly();
  readonly result = this.resultSignal.asReadonly();

  readonly selectedItems = computed(() => {
    const ids = this.selectedIdsSignal();
    return this.listStore.items().filter((item) => ids.has(item.id));
  });
  readonly count = computed(() => this.selectedItems().length);
  readonly limitReached = computed(() => this.count() >= MAX_BULK_ITEMS);
  readonly allSelected = computed(
    () => this.listStore.items().length > 0 && this.count() === this.listStore.items().length,
  );
  readonly missingName = computed(() => this.actingAs.name().trim() === '');
  readonly canSubmit = computed(
    () =>
      this.count() > 0 &&
      this.draftStatusSignal() !== '' &&
      !this.missingName() &&
      !this.savingSignal(),
  );

  constructor() {
    const key = computed(() => queryKey(this.listStore.query()));
    effect(() => {
      key();
      untracked(() => {
        this.clearSelection();
        this.resultSignal.set(null);
      });
    });
  }

  isSelected(id: number): boolean {
    return this.selectedIdsSignal().has(id);
  }

  toggle(id: number): void {
    const next = new Set(this.selectedIdsSignal());
    if (next.has(id)) {
      next.delete(id);
    } else if (next.size < MAX_BULK_ITEMS) {
      next.add(id);
    }
    this.selectedIdsSignal.set(next);
  }

  toggleAll(): void {
    if (this.allSelected()) {
      this.clearSelection();
      return;
    }
    const ids = this.listStore
      .items()
      .slice(0, MAX_BULK_ITEMS)
      .map((item) => item.id);
    this.selectedIdsSignal.set(new Set(ids));
  }

  clearSelection(): void {
    this.selectedIdsSignal.set(new Set());
    this.cancelChoosing();
  }

  startChoosing(): void {
    this.resultSignal.set(null);
    this.errorSignal.set(null);
    this.choosingSignal.set(true);
  }

  cancelChoosing(): void {
    if (this.savingSignal()) return;
    this.choosingSignal.set(false);
    this.draftStatusSignal.set('');
    this.errorSignal.set(null);
  }

  setDraftStatus(status: RequestStatus | ''): void {
    this.draftStatusSignal.set(status);
  }

  submit(): void {
    const status = this.draftStatusSignal();
    if (!this.canSubmit() || status === '') return;

    const items = this.selectedItems();
    const sent = new Map(items.map((item) => [item.id, item]));
    this.savingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .bulkUpdateStatus({
        items: items.map(({ id, version }) => ({ id, version })),
        status,
        changedBy: this.actingAs.name().trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          const failed = result.failed.map(({ id, reason }) => ({
            id,
            reason,
            title: sent.get(id)?.title ?? '',
            toStatus: status,
          }));
          this.resultSignal.set({ updatedCount: result.succeeded.length, failed });
          // The failed rows stay selected, so they can be retried once the reloaded list shows their current state.
          this.selectedIdsSignal.set(new Set(failed.map((f) => f.id)));
          this.choosingSignal.set(false);
          this.draftStatusSignal.set('');
          this.savingSignal.set(false);
          this.reloadList();
        },
        error: (error: unknown) => {
          this.errorSignal.set(problemMessage(error));
          this.savingSignal.set(false);
        },
      });
  }

  closeResult(): void {
    this.resultSignal.set(null);
  }

  reloadFailed(): void {
    this.resultSignal.set(null);
    this.reloadList();
  }

  private reloadList(): void {
    this.listStore.retry();
    this.statsStore?.refresh();
  }
}
