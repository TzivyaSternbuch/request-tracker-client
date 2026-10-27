import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MAX_BULK_ITEMS } from '../../../core/models/bulk-update.model';
import { StatusSelectComponent } from '../../../shared/status-select/status-select.component';
import { BulkUpdateStore } from './bulk-update.store';

@Component({
  selector: 'app-bulk-update-bar',
  imports: [DecimalPipe, MatButtonModule, MatProgressBarModule, StatusSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-update-bar.component.html',
  styleUrl: './bulk-update-bar.component.scss',
})
export class BulkUpdateBarComponent {
  protected readonly store = inject(BulkUpdateStore);
  protected readonly maxItems = MAX_BULK_ITEMS;
}
