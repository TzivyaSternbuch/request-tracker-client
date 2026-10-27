import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { LoadStatus } from '../../../core/models/load-status.model';
import { RequestStats } from '../../../core/models/request-stats.model';
import { REQUEST_STATUSES, RequestStatus } from '../../../core/models/request.model';
import { initials } from '../../../shared/initials';
import { valueLabel } from '../../../shared/value-label';

const TOP_ASSIGNEES = 3;

// The same tones the status pills use in the table.
const STATUS_TONES: Record<RequestStatus, 'blue' | 'amber' | 'gray' | 'green'> = {
  New: 'blue',
  InProgress: 'amber',
  Waiting: 'gray',
  Completed: 'green',
};

/** Circumference of the donut ring in the SVG's units: radius 15.915 makes it 100, so a count's share is its length. */
const RING_LENGTH = 100;

interface StatusSlice {
  label: string;
  count: number;
  tone: string;
  /** Visible length of the ring segment, in ring units; 0 for a status with no requests. */
  length: number;
  /** Where the segment starts: the ring starts at 12 o'clock and runs clockwise. */
  offset: number;
}

interface BarRow {
  label: string;
  count: number;
  /** Bar length, 0 to 100, relative to the largest count in the same card. */
  percent: number;
}

interface AssigneeRow {
  name: string;
  initials: string;
  count: number;
}

/**
 * The "All requests overview" section: three cards of global figures. The figures are not filtered by the list, so
 * the section says so in its title. Loading shows placeholders only before the first result; a reload keeps the
 * previous figures on screen.
 */
@Component({
  selector: 'app-request-stats',
  imports: [DecimalPipe, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-stats.component.html',
  styleUrl: './request-stats.component.scss',
})
export class RequestStatsComponent {
  readonly stats = input.required<RequestStats | null>();
  readonly status = input.required<LoadStatus>();
  readonly errorMessage = input<string | null>(null);

  readonly retry = output();

  protected readonly ringLength = RING_LENGTH;

  /** Placeholder lines per card, about as many as the real cards have rows. */
  protected readonly placeholderCards = [
    [1, 2, 3, 4],
    [1, 2, 3],
    [1, 2, 3],
  ];

  protected readonly total = computed(() =>
    REQUEST_STATUSES.reduce((sum, status) => sum + (this.stats()?.countByStatus[status] ?? 0), 0),
  );

  protected readonly statusSlices = computed<StatusSlice[]>(() => {
    const counts = this.stats()?.countByStatus;
    const total = this.total();
    let start = 0;
    return REQUEST_STATUSES.map((status) => {
      const count = counts?.[status] ?? 0;
      const length = total === 0 ? 0 : (count / total) * RING_LENGTH;
      const slice = {
        label: valueLabel(status),
        count,
        tone: STATUS_TONES[status],
        length,
        offset: -start,
      };
      start += length;
      return slice;
    });
  });

  protected readonly ageRows = computed<BarRow[]>(() => {
    const age = this.stats()?.openRequestAge;
    const rows = [
      { label: 'Under 7 days', count: age?.underSevenDays ?? 0 },
      { label: '7 to 30 days', count: age?.sevenToUnderThirtyDays ?? 0 },
      { label: '30 days or more', count: age?.thirtyDaysOrMore ?? 0 },
    ];
    const largest = Math.max(1, ...rows.map((row) => row.count));
    return rows.map((row) => ({ ...row, percent: (row.count / largest) * 100 }));
  });

  protected readonly assigneeRows = computed<AssigneeRow[]>(() =>
    (this.stats()?.topAssignees ?? []).slice(0, TOP_ASSIGNEES).map((assignee) => ({
      name: assignee.assignedTo,
      initials: initials(assignee.assignedTo),
      count: assignee.openCount,
    })),
  );

  /** Every status count is zero: there are no requests at all. */
  protected readonly noRequests = computed(() => this.total() === 0);
}
