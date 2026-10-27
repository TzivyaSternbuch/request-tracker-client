import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RequestDto } from '../../../core/models/request.model';
import { RequestSortField, SortLevel } from '../../../core/models/request-query.model';
import { RequestsTableComponent } from './requests-table.component';

function aRequest(overrides: Partial<RequestDto> = {}): RequestDto {
  return {
    id: 7,
    title: 'Fix the roof',
    organizationName: 'Acme',
    status: 'New',
    priority: 'High',
    assignedTo: 'dana',
    createdAt: '2026-01-31T23:59:00+00:00',
    updatedAt: '2026-02-01T08:05:00+00:00',
    version: 'AAAAAAAAB9E=',
    allowedStatuses: ['InProgress'],
    ...overrides,
  };
}

describe('RequestsTableComponent', () => {
  let fixture: ComponentFixture<RequestsTableComponent>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RequestsTableComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(RequestsTableComponent);
    root = fixture.nativeElement as HTMLElement;
  });

  it('render_Items_TitleLinksToDetailsPreservingQuery', async () => {
    TestBed.inject(Router).initialNavigation();
    await render([aRequest({ id: 7 })], []);

    const link = root.querySelector('a.title') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/requests/7');
    expect(link.textContent).toContain('Fix the roof');
  });

  it('rowClick_Row_NavigatesToDetails', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await render([aRequest({ id: 7 })], []);

    (root.querySelector('tr.row td.mat-column-id') as HTMLElement).click();

    expect(navigate).toHaveBeenCalledWith(['/requests', 7], { queryParamsHandling: 'preserve' });
  });

  it('rowClick_TitleLink_LeavesNavigationToTheLink', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await render([aRequest({ id: 7 })], []);

    (root.querySelector('a.title') as HTMLElement).click();

    expect(navigateByUrl).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('checkboxClick_Row_EmitsIdAndDoesNotOpenDetails', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const toggled: number[] = [];
    fixture.componentInstance.rowToggle.subscribe((id) => toggled.push(id));
    await render([aRequest({ id: 7 })], []);

    (root.querySelector('tbody td.select-cell input') as HTMLInputElement).click();

    expect(toggled).toEqual([7]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('checkboxClick_Header_EmitsAllToggle', async () => {
    let emitted = 0;
    fixture.componentInstance.allToggle.subscribe(() => emitted++);
    await render([aRequest()], []);

    (root.querySelector('th.select-cell input') as HTMLInputElement).click();

    expect(emitted).toBe(1);
  });

  it('render_SelectedIds_MarksTheRowsChecked', async () => {
    fixture.componentRef.setInput('selectedIds', new Set([7]));
    await render([aRequest({ id: 7 }), aRequest({ id: 8 })], []);

    const checked = Array.from(
      root.querySelectorAll<HTMLInputElement>('tbody td.select-cell input'),
    ).map((input) => input.checked);
    expect(checked).toEqual([true, false]);
    expect(root.querySelectorAll('tr.row.selected')).toHaveLength(1);
  });

  async function render(items: RequestDto[], sort: SortLevel[], loading = false) {
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('sort', sort);
    fixture.componentRef.setInput('loading', loading);
    await fixture.whenStable();
  }

  function headerCell(label: string): HTMLElement {
    const cells = Array.from(root.querySelectorAll<HTMLElement>('th'));
    const cell = cells.find((th) => th.textContent?.trim().startsWith(label));
    if (!cell) throw new Error(`No header "${label}"`);
    return cell;
  }

  // The cell text without decorative parts (the initials circle is aria-hidden).
  function visibleText(cell: HTMLElement): string {
    const copy = cell.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
    return copy.textContent?.trim() ?? '';
  }

  it('render_Items_ShowsColumnsInOrder', async () => {
    await render([aRequest()], []);

    const headers = Array.from(root.querySelectorAll('th')).map((th) =>
      th.textContent?.replace(/\s+/g, ' ').trim(),
    );
    const cells = Array.from(root.querySelectorAll<HTMLElement>('tbody tr:first-child td')).map(
      visibleText,
    );
    expect(headers).toEqual([
      '',
      'Id',
      'Title',
      'Organization',
      'Status',
      'Priority',
      'Assignee',
      'Created',
      'Updated',
    ]);
    expect(cells).toEqual([
      '',
      '7',
      'Fix the roof',
      'Acme',
      'New',
      'High',
      'dana',
      '2026-01-31 23:59',
      '2026-02-01 08:05',
    ]);
  });

  it('render_Items_ShowsPillsAndAssigneeInitials', async () => {
    await render([aRequest({ status: 'InProgress', assignedTo: 'Dana Katz' })], []);

    const row = root.querySelector('tbody tr') as HTMLElement;
    const pills = Array.from(row.querySelectorAll('app-status-pill')).map((pill) =>
      pill.textContent?.trim(),
    );
    expect(pills).toEqual(['In progress', 'High']);
    expect(row.querySelector('.avatar')?.textContent?.trim()).toBe('DK');
  });

  it('render_BlankAssignee_ShowsNoInitialsCircle', async () => {
    await render([aRequest({ assignedTo: '  ' })], []);

    const row = root.querySelector('tbody tr') as HTMLElement;
    expect(row.querySelector('.avatar')).toBeNull();
    expect(row.querySelector('.assignee')).toBeNull();
  });

  it('render_TwoSortLevels_ShowsArrowsAndNumbers', async () => {
    await render(
      [aRequest()],
      [
        { field: 'priority', direction: 'desc' },
        { field: 'title', direction: 'asc' },
      ],
    );

    const priority = headerCell('Priority');
    const title = headerCell('Title');
    expect(priority.textContent).toContain('↓');
    expect(priority.textContent).toContain('1');
    expect(title.textContent).toContain('↑');
    expect(title.textContent).toContain('2');
    expect(priority.getAttribute('aria-sort')).toBe('descending');
    expect(priority.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Priority, sorted descending, level 1',
    );
  });

  it('render_OneSortLevel_HidesNumber', async () => {
    await render([aRequest()], [{ field: 'title', direction: 'asc' }]);

    const title = headerCell('Title');
    expect(title.textContent).toContain('↑');
    expect(title.textContent).not.toMatch(/\d/);
    expect(title.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Title, sorted ascending',
    );
  });

  it('render_NoSort_LabelsHeadersNotSorted', async () => {
    await render([aRequest()], []);

    expect(headerCell('Title').querySelector('button')?.getAttribute('aria-label')).toBe(
      'Title, not sorted',
    );
  });

  it('headerClick_Column_EmitsSortToggleWithField', async () => {
    await render([aRequest()], []);
    const emitted: RequestSortField[] = [];
    fixture.componentInstance.sortToggle.subscribe((field) => emitted.push(field));

    headerCell('Organization').querySelector('button')?.click();

    expect(emitted).toEqual(['organizationName']);
  });

  it('render_Loading_DimsRows', async () => {
    await render([aRequest()], [], true);

    expect(root.querySelector('table')?.classList).toContain('loading');
  });

  it('render_NotLoading_DoesNotDimRows', async () => {
    await render([aRequest()], [], false);

    expect(root.querySelector('table')?.classList).not.toContain('loading');
  });
});
