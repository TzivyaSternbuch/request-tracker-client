import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { provideNativeDateAdapter } from '@angular/material/core';
import {
  DateRange,
  MatDatepickerModule,
  MatEndDate,
  MatStartDate,
} from '@angular/material/datepicker';
import { MatMenuModule } from '@angular/material/menu';
import {
  ImmediateFilters,
  MAX_FILTER_VALUES,
  RequestFilters,
  TEXT_FILTER_MAX_LENGTH,
} from '../../../core/models/request-query.model';
import {
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  RequestPriority,
  RequestStatus,
} from '../../../core/models/request.model';
import { fromIsoDate, toIsoDate } from '../../../shared/iso-date';
import { valueLabel } from '../../../shared/value-label';

/** The values of `all` that stay selected after `value` is (un)checked, in the canonical order of `all`. */
function toggled<T>(all: readonly T[], selected: readonly T[], value: T, checked: boolean): T[] {
  return all.filter((item) => (item === value ? checked : selected.includes(item)));
}

/**
 * Presentational: the search box (beside the projected card title) and a row of filter chips, each opening a menu
 * to edit its filter. It shows the current filters and emits changes; it keeps no filter state of its own beyond a
 * checklist toggle not yet reflected in `filters`. The text boxes show the store's drafts rather than the URL values,
 * so the URL round trip never rewrites what the user is typing.
 */
@Component({
  selector: 'app-requests-filter-bar',
  imports: [A11yModule, MatCheckboxModule, MatDatepickerModule, MatMenuModule],
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requests-filter-bar.component.html',
  styleUrl: './requests-filter-bar.component.scss',
})
export class RequestsFilterBarComponent {
  readonly filters = input.required<RequestFilters>();
  readonly searchDraft = input.required<string>();
  readonly organizationDraft = input.required<string>();
  /** Every assignee name, for the assignee checklist. */
  readonly assignees = input.required<string[]>();
  readonly assigneesError = input.required<boolean>();

  readonly searchDraftChange = output<string>();
  readonly organizationDraftChange = output<string>();
  /** Enter in a text box: send the drafts now. */
  readonly textSubmit = output<void>();
  readonly filtersChange = output<ImmediateFilters>();
  readonly clear = output<void>();

  private readonly createdStart = viewChild.required<MatStartDate<Date>>(MatStartDate);
  private readonly createdEnd = viewChild.required<MatEndDate<Date>>(MatEndDate);

  protected readonly statuses = REQUEST_STATUSES;
  protected readonly priorities = REQUEST_PRIORITIES;
  protected readonly textMaxLength = TEXT_FILTER_MAX_LENGTH;
  protected readonly maxAssignees = MAX_FILTER_VALUES;
  protected readonly label = valueLabel;

  /** The text in the assignee menu's filter box; it only narrows the options shown. */
  protected readonly assigneeQuery = signal('');

  // Computed, so the date inputs get the same Date object until the filter changes.
  protected readonly createdFrom = computed(() => fromIsoDate(this.filters().createdFrom));
  protected readonly createdTo = computed(() => fromIsoDate(this.filters().createdTo));

  // The checklists toggle from these, not from `filters()`: the input lags until the navigation settles, so a second
  // toggle right after the first would build on the old selection and drop the first. Each resets to the input when
  // it changes.
  private readonly statusSelection = linkedSignal(() => this.filters().status);
  private readonly prioritySelection = linkedSignal(() => this.filters().priority);
  private readonly assigneeSelection = linkedSignal(() => this.filters().assignedTo);

  protected readonly selectedStatuses = computed(() => new Set(this.statusSelection()));
  protected readonly selectedPriorities = computed(() => new Set(this.prioritySelection()));
  protected readonly selectedAssignees = computed(() => new Set(this.assigneeSelection()));
  protected readonly assigneesFull = computed(
    () => this.assigneeSelection().length >= MAX_FILTER_VALUES,
  );
  /** Selected names missing from the loaded list (from a link) come first, so they can be unchecked. */
  protected readonly assigneeOptions = computed(() => {
    const known = new Set(this.assignees());
    const extra = this.assigneeSelection().filter((name) => !known.has(name));
    const query = this.assigneeQuery().trim().toLowerCase();
    return [...extra, ...this.assignees()].filter((name) => name.toLowerCase().includes(query));
  });

  protected readonly statusLabel = computed(() => {
    const status = this.filters().status;
    return status.length ? `Status: ${status.map(valueLabel).join(', ')}` : null;
  });
  protected readonly priorityLabel = computed(() => {
    const priority = this.filters().priority;
    return priority.length ? `Priority: ${priority.map(valueLabel).join(', ')}` : null;
  });
  protected readonly assigneeLabel = computed(() => {
    const names = this.filters().assignedTo;
    if (names.length === 0) return null;
    return `Assignee: ${names.length === 1 ? names[0] : `${names.length} selected`}`;
  });
  // The draft, not the URL value: the chip follows what is typed in its menu.
  protected readonly organizationLabel = computed(() => {
    const organization = this.organizationDraft().trim();
    return organization ? `Organization: ${organization}` : null;
  });
  protected readonly createdLabel = computed(() => {
    const { createdFrom: from, createdTo: to } = this.filters();
    if (from && to) return `Created: ${from} – ${to}`;
    if (from) return `Created: from ${from}`;
    if (to) return `Created: to ${to}`;
    return null;
  });

  protected readonly anyFilterActive = computed(() => {
    const filters = this.filters();
    return (
      filters.status.length > 0 ||
      filters.priority.length > 0 ||
      filters.assignedTo.length > 0 ||
      filters.createdFrom !== null ||
      filters.createdTo !== null ||
      filters.search !== '' ||
      filters.organizationName !== '' ||
      this.searchDraft().trim() !== '' ||
      this.organizationDraft().trim() !== ''
    );
  });

  protected toggleStatus(status: RequestStatus, checked: boolean): void {
    const next = toggled(REQUEST_STATUSES, this.statusSelection(), status, checked);
    this.statusSelection.set(next);
    this.filtersChange.emit({ status: next });
  }

  protected togglePriority(priority: RequestPriority, checked: boolean): void {
    const next = toggled(REQUEST_PRIORITIES, this.prioritySelection(), priority, checked);
    this.prioritySelection.set(next);
    this.filtersChange.emit({ priority: next });
  }

  protected toggleAssignee(name: string, checked: boolean): void {
    const selected = this.assigneeSelection();
    const next = checked ? [...selected, name] : selected.filter((n) => n !== name);
    this.assigneeSelection.set(next);
    this.filtersChange.emit({ assignedTo: next });
  }

  protected removeOrganization(): void {
    this.organizationDraftChange.emit('');
    this.textSubmit.emit();
  }

  /**
   * Called on every end-date change of the picker. Picking a new start clears the end, so the range is sent only once
   * both days are picked, in one change: a start-only change would load a list nobody asked for.
   */
  protected createdRangeChange(range: DateRange<Date> | null): void {
    if (range?.start && range.end) {
      this.filtersChange.emit({
        createdFrom: toIsoDate(range.start),
        createdTo: toIsoDate(range.end),
      });
    }
  }

  /**
   * A range left half-picked stays in the hidden inputs otherwise, and would show (and be completed) on the next
   * open even after the filter was cleared. The bindings can't restore it: their value didn't change.
   */
  protected resetCreatedInputs(): void {
    this.createdStart().value = this.createdFrom();
    this.createdEnd().value = this.createdTo();
  }

  /**
   * The menu reads keys for its own menu items, which these menus don't have: it cancels Home, End and the arrows
   * (they move the cursor in a text box) and closes on Tab (which moves between the checkboxes). Escape still
   * reaches the menu and closes it.
   */
  protected keepKeysInMenu(event: KeyboardEvent): void {
    if (event.key !== 'Escape') event.stopPropagation();
  }
}
