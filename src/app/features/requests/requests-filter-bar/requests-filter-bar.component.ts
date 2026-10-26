import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  ASSIGNED_TO_MAX_LENGTH,
  ImmediateFilters,
  MAX_FILTER_VALUES,
  RequestFilters,
  TEXT_FILTER_MAX_LENGTH,
} from '../../../core/models/request-query.model';
import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../../../core/models/request.model';
import { fromIsoDate, toIsoDate } from '../../../shared/iso-date';

/**
 * Presentational: shows the current filters and emits changes; it keeps no filter state of its own. The text boxes
 * show the store's drafts rather than the URL values, so the URL round trip never rewrites what the user is typing.
 * Assignees go out as add/remove intents, not as a new list: `filters` lags until the navigation settles, so a list
 * built from it could bring back a chip removed a moment ago.
 */
@Component({
  selector: 'app-requests-filter-bar',
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requests-filter-bar.component.html',
  styleUrl: './requests-filter-bar.component.scss',
})
export class RequestsFilterBarComponent {
  readonly filters = input.required<RequestFilters>();
  readonly searchDraft = input.required<string>();
  readonly organizationDraft = input.required<string>();

  readonly searchDraftChange = output<string>();
  readonly organizationDraftChange = output<string>();
  /** Enter in a text box: send the drafts now. */
  readonly textSubmit = output<void>();
  readonly filtersChange = output<ImmediateFilters>();
  /** The typed name, untrimmed; the store decides whether it is added. */
  readonly assigneeAdd = output<string>();
  readonly assigneeRemove = output<string>();
  readonly clear = output<void>();

  protected readonly statuses = REQUEST_STATUSES;
  protected readonly priorities = REQUEST_PRIORITIES;
  protected readonly separatorKeys = [ENTER, COMMA];
  protected readonly textMaxLength = TEXT_FILTER_MAX_LENGTH;
  protected readonly assigneeMaxLength = ASSIGNED_TO_MAX_LENGTH;
  protected readonly maxAssignees = MAX_FILTER_VALUES;

  // Computed, so the date inputs get the same Date object until the filter changes.
  protected readonly createdFrom = computed(() => fromIsoDate(this.filters().createdFrom));
  protected readonly createdTo = computed(() => fromIsoDate(this.filters().createdTo));
  protected readonly assigneesFull = computed(
    () => this.filters().assignedTo.length >= MAX_FILTER_VALUES,
  );

  protected addAssignee(event: MatChipInputEvent): void {
    event.chipInput.clear();
    this.assigneeAdd.emit(event.value);
  }

  protected isoDate(event: MatDatepickerInputEvent<Date>): string | null {
    return event.value ? toIsoDate(event.value) : null;
  }
}
