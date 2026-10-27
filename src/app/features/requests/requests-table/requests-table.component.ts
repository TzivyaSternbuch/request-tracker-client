import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { RequestDto } from '../../../core/models/request.model';
import { RequestSortField, SortLevel } from '../../../core/models/request-query.model';
import { initials } from '../../../shared/initials';
import { StatusPillComponent } from '../../../shared/status-pill/status-pill.component';

interface Column {
  field: RequestSortField;
  label: string;
}

// Each column's cell is rendered by its own case in the template (pill, initials, date...).
const COLUMNS: readonly Column[] = [
  { field: 'id', label: 'Id' },
  { field: 'title', label: 'Title' },
  { field: 'organizationName', label: 'Organization' },
  { field: 'status', label: 'Status' },
  { field: 'priority', label: 'Priority' },
  { field: 'assignedTo', label: 'Assignee' },
  { field: 'createdAt', label: 'Created (UTC)' },
  { field: 'updatedAt', label: 'Updated (UTC)' },
];

const AVATAR_TONES = ['blue', 'amber', 'green', 'red', 'gray'] as const;

@Component({
  selector: 'app-requests-table',
  imports: [DatePipe, MatTableModule, MatButtonModule, StatusPillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requests-table.component.html',
  styleUrl: './requests-table.component.scss',
})
export class RequestsTableComponent {
  readonly items = input.required<RequestDto[]>();
  readonly sort = input.required<SortLevel[]>();
  readonly loading = input(false);

  readonly sortToggle = output<RequestSortField>();
  readonly sortReset = output<void>();

  protected readonly columns = COLUMNS;
  protected readonly fields = COLUMNS.map((column) => column.field);
  protected readonly initials = initials;

  private readonly levels = computed(
    () =>
      new Map(this.sort().map((level, index) => [level.field, { ...level, number: index + 1 }])),
  );

  protected levelOf(field: RequestSortField) {
    return this.levels().get(field);
  }

  /** The same name always gets the same colour; a simple character sum spreads names over the tones. */
  protected avatarTone(name: string): (typeof AVATAR_TONES)[number] {
    let sum = 0;
    for (const char of name) sum += char.charCodeAt(0);
    return AVATAR_TONES[sum % AVATAR_TONES.length];
  }

  protected ariaSort(field: RequestSortField): 'ascending' | 'descending' | null {
    const first = this.sort()[0];
    if (first?.field !== field) return null;
    return first.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected ariaLabel(column: Column): string {
    const level = this.levelOf(column.field);
    if (!level) return `${column.label}, not sorted`;
    const direction = level.direction === 'asc' ? 'ascending' : 'descending';
    return this.sort().length > 1
      ? `${column.label}, sorted ${direction}, level ${level.number}`
      : `${column.label}, sorted ${direction}`;
  }
}
