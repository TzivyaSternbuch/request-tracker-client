import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadStatus } from '../../../core/models/load-status.model';
import { RequestStats } from '../../../core/models/request-stats.model';
import { RequestStatsComponent } from './request-stats.component';

const STATS: RequestStats = {
  asOf: '2026-10-27T12:00:00+00:00',
  countByStatus: { New: 18204, InProgress: 31567, Waiting: 0, Completed: 37349 },
  openRequestAge: { underSevenDays: 9410, sevenToUnderThirtyDays: 24038, thirtyDaysOrMore: 29203 },
  topAssignees: [
    { assignedTo: 'Dana Levi', openCount: 2914 },
    { assignedTo: 'Yossi Katz', openCount: 1457 },
  ],
};

describe('RequestStatsComponent', () => {
  let fixture: ComponentFixture<RequestStatsComponent>;
  let root: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(RequestStatsComponent);
    root = fixture.nativeElement as HTMLElement;
  });

  async function render(state: {
    status: LoadStatus;
    stats?: RequestStats | null;
    errorMessage?: string;
  }): Promise<void> {
    fixture.componentRef.setInput('status', state.status);
    fixture.componentRef.setInput('stats', state.stats ?? null);
    fixture.componentRef.setInput('errorMessage', state.errorMessage ?? null);
    await fixture.whenStable();
  }

  function cards(): string[] {
    return Array.from(root.querySelectorAll('.card')).map((card) => card.textContent ?? '');
  }

  it('render_Success_ShowsThreeCardsWithFormattedCounts', async () => {
    await render({ status: 'success', stats: STATS });

    const [byStatus, byAge, assignees] = cards();
    expect(root.querySelector('h2')?.textContent).toBe('All requests overview');
    expect(byStatus).toContain('In progress');
    expect(byStatus).toContain('31,567');
    expect(byStatus).toContain('Waiting');
    expect(byAge).toContain('30 days or more');
    expect(byAge).toContain('29,203');
    expect(assignees).toContain('Dana Levi');
    expect(assignees).toContain('2,914');
  });

  it('render_Success_ScalesAgeBarsToTheLargestCountInTheCard', async () => {
    await render({ status: 'success', stats: STATS });

    const ageBars = Array.from(root.querySelectorAll<HTMLElement>('.card:nth-child(2) .bar i')).map(
      (bar) => bar.style.width,
    );
    expect(ageBars.map((width) => Math.round(parseFloat(width)))).toEqual([32, 82, 100]);
  });

  it('render_Success_ShowsTotalInDonutCenter', async () => {
    await render({ status: 'success', stats: STATS });

    expect(root.querySelector('.donut-total')?.textContent).toContain('87,120');
    expect(root.querySelector('.donut-total')?.textContent).toContain('Total requests');
  });

  it('render_Success_DrawsRingSegmentsOnlyForStatusesWithRequests', async () => {
    await render({ status: 'success', stats: STATS });

    // Waiting is zero: no segment, but its legend row stays.
    expect(root.querySelectorAll('.ring-slice').length).toBe(3);
    const legendRows = Array.from(root.querySelectorAll('.legend li')).map((li) => li.textContent);
    expect(legendRows.some((text) => text?.includes('Waiting') && text.includes('0'))).toBe(true);
  });

  it('render_Success_ColorsLegendDotsLikeTheStatusPills', async () => {
    await render({ status: 'success', stats: STATS });

    const tones = Array.from(root.querySelectorAll('.legend .dot')).map((dot) =>
      Array.from(dot.classList).find((name) => name.startsWith('tone--')),
    );
    expect(tones).toEqual(['tone--blue', 'tone--amber', 'tone--gray', 'tone--green']);
  });

  it('render_MoreThanThreeAssignees_ShowsOnlyTheFirstThreeWithInitials', async () => {
    const many: RequestStats = {
      ...STATS,
      topAssignees: [
        { assignedTo: 'Dana Levi', openCount: 40 },
        { assignedTo: 'Yossi Katz', openCount: 30 },
        { assignedTo: 'Noa Barak', openCount: 20 },
        { assignedTo: 'Amit Cohen', openCount: 10 },
      ],
    };

    await render({ status: 'success', stats: many });

    const rows = Array.from(root.querySelectorAll('.assignee-row'));
    expect(rows.length).toBe(3);
    expect(rows[0].querySelector('.avatar')?.textContent).toBe('DL');
    expect(cards()[2]).not.toContain('Amit Cohen');
    expect(root.querySelector('.card:nth-child(3) .bar')).toBeNull();
  });

  it('render_FirstLoad_ShowsPlaceholdersAndNoNumbers', async () => {
    await render({ status: 'loading' });

    expect(root.querySelectorAll('.placeholder').length).toBeGreaterThan(0);
    expect(root.querySelector('.count')).toBeNull();
  });

  it('render_ReloadAfterSuccess_KeepsFigures', async () => {
    await render({ status: 'loading', stats: STATS });

    expect(root.querySelector('.placeholder')).toBeNull();
    expect(root.textContent).toContain('31,567');
  });

  it('render_NoRequests_ShowsEmptyMessage', async () => {
    const empty: RequestStats = {
      ...STATS,
      countByStatus: { New: 0, InProgress: 0, Waiting: 0, Completed: 0 },
      openRequestAge: { underSevenDays: 0, sevenToUnderThirtyDays: 0, thirtyDaysOrMore: 0 },
      topAssignees: [],
    };

    await render({ status: 'success', stats: empty });

    expect(root.querySelector('.message')?.textContent).toContain('No requests yet');
    expect(root.querySelector('.card')).toBeNull();
  });

  it('render_OnlyCompletedRequests_ShowsNoOpenAssigneesNote', async () => {
    const onlyCompleted: RequestStats = {
      ...STATS,
      countByStatus: { New: 0, InProgress: 0, Waiting: 0, Completed: 5 },
      openRequestAge: { underSevenDays: 0, sevenToUnderThirtyDays: 0, thirtyDaysOrMore: 0 },
      topAssignees: [],
    };

    await render({ status: 'success', stats: onlyCompleted });

    expect(cards()[2]).toContain('No open requests');
  });

  it('render_Error_ShowsMessageAndRetryEmitsRetry', async () => {
    // The store keeps the previous figures during an error; the section must not show them.
    await render({ status: 'error', stats: STATS, errorMessage: 'Server down' });
    const retried = vi.fn();
    fixture.componentInstance.retry.subscribe(retried);
    const alert = root.querySelector<HTMLElement>('[role="alert"]');

    alert?.querySelector('button')?.click();

    expect(alert?.textContent).toContain('Server down');
    expect(root.querySelector('.card')).toBeNull();
    expect(retried).toHaveBeenCalledOnce();
  });
});
