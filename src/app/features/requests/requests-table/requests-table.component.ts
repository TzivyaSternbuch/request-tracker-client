import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
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
  { field: 'createdAt', label: 'Created' },
  { field: 'updatedAt', label: 'Updated' },
];

@Component({
  selector: 'app-requests-table',
  imports: [DatePipe, MatCheckboxModule, MatTableModule, RouterLink, StatusPillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requests-table.component.html',
  styleUrl: './requests-table.component.scss',
})
export class RequestsTableComponent {
  readonly items = input.required<RequestDto[]>();
  readonly sort = input.required<SortLevel[]>();
  readonly loading = input(false);
  readonly selectedIds = input<ReadonlySet<number>>(new Set());
  readonly allSelected = input(false);

  readonly sortToggle = output<RequestSortField>();
  readonly rowToggle = output<number>();
  readonly allToggle = output<void>();

  private readonly router = inject(Router);

  protected readonly columns = COLUMNS;
  protected readonly fields = ['select', ...COLUMNS.map((column) => column.field)];
  protected readonly initials = initials;

  private readonly levels = computed(
    () =>
      new Map(this.sort().map((level, index) => [level.field, { ...level, number: index + 1 }])),
  );

  /** The title link handles its own click (middle-click and new tab keep working); the rest of the row opens it too, except the checkbox cell. */
  protected openRow(event: MouseEvent, row: RequestDto): void {
    if ((event.target as HTMLElement).closest('a, .select-cell')) return;
    void this.router.navigate(['/requests', row.id], { queryParamsHandling: 'preserve' });
  }

  protected levelOf(field: RequestSortField) {
    return this.levels().get(field);
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
