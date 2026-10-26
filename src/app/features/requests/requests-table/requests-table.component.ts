import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { RequestDto } from '../../../core/models/request.model';
import { RequestSortField, SortLevel } from '../../../core/models/request-query.model';

interface Column {
  field: RequestSortField;
  label: string;
  value: (row: RequestDto) => string | number;
  kind: 'text' | 'date';
}

const COLUMNS: readonly Column[] = [
  { field: 'id', label: 'Id', value: (r) => r.id, kind: 'text' },
  { field: 'title', label: 'Title', value: (r) => r.title, kind: 'text' },
  {
    field: 'organizationName',
    label: 'Organization',
    value: (r) => r.organizationName,
    kind: 'text',
  },
  { field: 'status', label: 'Status', value: (r) => r.status, kind: 'text' },
  {
    field: 'priority',
    label: 'Priority',
    value: (r) => r.priority,
    kind: 'text',
  },
  {
    field: 'assignedTo',
    label: 'Assignee',
    value: (r) => r.assignedTo,
    kind: 'text',
  },
  {
    field: 'createdAt',
    label: 'Created (UTC)',
    value: (r) => r.createdAt,
    kind: 'date',
  },
  {
    field: 'updatedAt',
    label: 'Updated (UTC)',
    value: (r) => r.updatedAt,
    kind: 'date',
  },
];

@Component({
  selector: 'app-requests-table',
  imports: [DatePipe, MatTableModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sort-row">
      <button mat-button type="button" [disabled]="sort().length === 0" (click)="sortReset.emit()">
        Reset sorting
      </button>
      @if (sort().length === 0) {
        <span class="default-note">Default order: newest first</span>
      }
    </div>

    <table mat-table [dataSource]="items()" [class.loading]="loading()">
      @for (column of columns; track column.field) {
        <ng-container [matColumnDef]="column.field">
          <th mat-header-cell *matHeaderCellDef [attr.aria-sort]="ariaSort(column.field)">
            <button
              type="button"
              class="sort-button"
              [attr.aria-label]="ariaLabel(column)"
              (click)="sortToggle.emit(column.field)"
            >
              {{ column.label }}
              @if (levelOf(column.field); as level) {
                <span aria-hidden="true">{{ level.direction === 'asc' ? '↑' : '↓' }}</span>
                @if (sort().length > 1) {
                  <sup aria-hidden="true">{{ level.number }}</sup>
                }
              }
            </button>
          </th>
          <td mat-cell *matCellDef="let row">
            @if (column.kind === 'date') {
              {{ column.value(row) | date: 'yyyy-MM-dd HH:mm' : 'UTC' }}
            } @else {
              {{ column.value(row) }}
            }
          </td>
        </ng-container>
      }
      <tr mat-header-row *matHeaderRowDef="fields"></tr>
      <tr mat-row *matRowDef="let row; columns: fields"></tr>
    </table>
  `,
  styles: `
    .sort-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .default-note {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    table {
      width: 100%;
    }

    table.loading tbody {
      opacity: 0.5;
    }

    .sort-button {
      all: unset;
      cursor: pointer;
      font: inherit;
    }

    .sort-button:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
    }
  `,
})
export class RequestsTableComponent {
  readonly items = input.required<RequestDto[]>();
  readonly sort = input.required<SortLevel[]>();
  readonly loading = input(false);

  readonly sortToggle = output<RequestSortField>();
  readonly sortReset = output<void>();

  protected readonly columns = COLUMNS;
  protected readonly fields = COLUMNS.map((column) => column.field);

  private readonly levels = computed(
    () =>
      new Map(this.sort().map((level, index) => [level.field, { ...level, number: index + 1 }])),
  );

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
