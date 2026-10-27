import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { BulkFailureReason } from '../../../core/models/bulk-update.model';
import { valueLabel } from '../../../shared/value-label';
import { BulkUpdateStore, FailedItem } from './bulk-update.store';

// Plain words per reason. The UI only describes outcomes; it never decides which transitions are allowed.
const REASONS: Record<BulkFailureReason, string> = {
  NotFound: 'The request no longer exists.',
  Conflict: 'Changed by another user. Reload before retrying.',
  InvalidTransition: 'Status transition is not allowed.',
};

/** The outcome of the last bulk update: the counts and a table of the requests that were not updated. */
@Component({
  selector: 'app-bulk-update-result',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-update-result.component.html',
  styleUrl: './bulk-update-result.component.scss',
})
export class BulkUpdateResultComponent {
  protected readonly store = inject(BulkUpdateStore);
  protected reasonText(item: FailedItem): string {
    if (item.reason !== 'InvalidTransition') return REASONS[item.reason];
    return `${valueLabel(item.fromStatus)} → ${valueLabel(item.toStatus)} is not allowed.`;
  }
}
