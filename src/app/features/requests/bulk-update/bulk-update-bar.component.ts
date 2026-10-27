import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MAX_BULK_ITEMS } from '../../../core/models/bulk-update.model';
import { REQUEST_STATUSES, RequestStatus } from '../../../core/models/request.model';
import { valueLabel } from '../../../shared/value-label';
import { BulkUpdateStore } from './bulk-update.store';

@Component({
  selector: 'app-bulk-update-bar',
  imports: [DecimalPipe, MatButtonModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-update-bar.component.html',
  styleUrl: './bulk-update-bar.component.scss',
})
export class BulkUpdateBarComponent {
  protected readonly store = inject(BulkUpdateStore);
  protected readonly statuses = REQUEST_STATUSES;
  protected readonly valueLabel = valueLabel;
  protected readonly maxItems = MAX_BULK_ITEMS;

  protected onStatusChange(event: Event): void {
    this.store.setDraftStatus((event.target as HTMLSelectElement).value as RequestStatus | '');
  }
}
