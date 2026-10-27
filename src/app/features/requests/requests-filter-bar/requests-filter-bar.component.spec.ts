import { HarnessLoader, TestKey } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { MatCalendarHarness } from '@angular/material/datepicker/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import {
  EMPTY_FILTERS,
  ImmediateFilters,
  MAX_FILTER_VALUES,
  RequestFilters,
  TEXT_FILTER_MAX_LENGTH,
} from '../../../core/models/request-query.model';
import { toIsoDate } from '../../../shared/iso-date';
import { RequestsFilterBarComponent } from './requests-filter-bar.component';

type Chip = 'status' | 'priority' | 'assignee' | 'organization' | 'created';

describe('RequestsFilterBarComponent', () => {
  let fixture: ComponentFixture<RequestsFilterBarComponent>;
  let root: HTMLElement;
  // Menus and the date picker render in the overlay container, outside the component.
  let overlay: HarnessLoader;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RequestsFilterBarComponent] });
    fixture = TestBed.createComponent(RequestsFilterBarComponent);
    root = fixture.nativeElement as HTMLElement;
    overlay = TestbedHarnessEnvironment.documentRootLoader(fixture);
  });

  async function render(
    options: {
      filters?: Partial<RequestFilters>;
      searchDraft?: string;
      organizationDraft?: string;
      assignees?: string[];
      assigneesError?: boolean;
    } = {},
  ): Promise<void> {
    fixture.componentRef.setInput('filters', { ...EMPTY_FILTERS, ...options.filters });
    fixture.componentRef.setInput('searchDraft', options.searchDraft ?? '');
    fixture.componentRef.setInput('organizationDraft', options.organizationDraft ?? '');
    fixture.componentRef.setInput('assignees', options.assignees ?? []);
    fixture.componentRef.setInput('assigneesError', options.assigneesError ?? false);
    await fixture.whenStable();
  }

  function chip(name: Chip): HTMLElement {
    const body = root.querySelector<HTMLElement>(`[data-chip="${name}"]`);
    if (!body?.parentElement) throw new Error(`No ${name} chip`);
    return body.parentElement;
  }

  async function openChip(name: Chip): Promise<void> {
    chip(name).querySelector<HTMLElement>('.chip-body')?.click();
    await fixture.whenStable();
  }

  function chipRemove(name: Chip): HTMLButtonElement | null {
    return chip(name).querySelector<HTMLButtonElement>('.chip-remove');
  }

  function textInput(name: 'search' | 'organization' | 'assignee'): HTMLInputElement {
    const input = document.querySelector<HTMLInputElement>(`input[data-filter="${name}"]`);
    if (!input) throw new Error(`No ${name} input`);
    return input;
  }

  /** The search box is in the bar; the organization box is in its chip's menu. */
  async function showTextInput(name: 'search' | 'organization'): Promise<HTMLInputElement> {
    if (name === 'organization') await openChip('organization');
    return textInput(name);
  }

  function clearAll(): HTMLButtonElement | undefined {
    return Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Clear all'),
    );
  }

  function filterChanges(): ImmediateFilters[] {
    const changes: ImmediateFilters[] = [];
    fixture.componentInstance.filtersChange.subscribe((change) => changes.push(change));
    return changes;
  }

  async function checkbox(label: string): Promise<MatCheckboxHarness> {
    return overlay.getHarness(MatCheckboxHarness.with({ label }));
  }

  async function checkboxLabels(): Promise<string[]> {
    const boxes = await overlay.getAllHarnesses(MatCheckboxHarness);
    return Promise.all(boxes.map((box) => box.getLabelText()));
  }

  for (const name of ['search', 'organization'] as const) {
    const draftChange = name === 'search' ? 'searchDraftChange' : 'organizationDraftChange';

    it(`${name}Input_Typing_EmitsDraftChange`, async () => {
      await render();
      const drafts: string[] = [];
      fixture.componentInstance[draftChange].subscribe((text) => drafts.push(text));
      const input = await showTextInput(name);

      input.value = 'acme ';
      input.dispatchEvent(new Event('input'));

      expect(drafts).toEqual(['acme ']);
    });

    it(`${name}Input_Enter_EmitsTextSubmit`, async () => {
      await render();
      let submits = 0;
      fixture.componentInstance.textSubmit.subscribe(() => submits++);
      const input = await showTextInput(name);

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(submits).toBe(1);
    });

    it(`${name}Input_MaxLength_IsTextFilterLimit`, async () => {
      await render();

      const input = await showTextInput(name);

      expect(input.maxLength).toBe(TEXT_FILTER_MAX_LENGTH);
    });
  }

  it('render_Drafts_ShowsDraftText', async () => {
    await render({
      filters: { search: 'acme', organizationName: 'glob' },
      searchDraft: 'acme ',
      organizationDraft: 'glob ',
    });

    expect((await showTextInput('search')).value).toBe('acme ');
    expect((await showTextInput('organization')).value).toBe('glob ');
  });

  it('organizationMenu_Open_FocusesInput', async () => {
    await render();

    await openChip('organization');

    expect(document.activeElement).toBe(textInput('organization'));
  });

  it('organizationInput_Enter_ClosesMenu', async () => {
    await render();
    await openChip('organization');
    const menu = await overlay.getHarness(
      MatMenuHarness.with({ selector: '[data-chip="organization"]' }),
    );

    textInput('organization').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();

    expect(await menu.isOpen()).toBe(false);
  });

  it('statusChecklist_Check_EmitsStatusAndStaysOpen', async () => {
    await render({ filters: { status: ['Waiting'] } });
    const changes = filterChanges();
    await openChip('status');
    const menu = await overlay.getHarness(
      MatMenuHarness.with({ selector: '[data-chip="status"]' }),
    );

    await (await checkbox('New')).check();

    // Canonical order, not click order.
    expect(changes).toEqual([{ status: ['New', 'Waiting'] }]);
    expect(await menu.isOpen()).toBe(true);
    expect(await checkboxLabels()).toEqual(['New', 'In progress', 'Waiting', 'Completed']);
  });

  it('statusChecklist_TwoTogglesBeforeInputUpdates_EmitsBoth', async () => {
    await render();
    const changes = filterChanges();
    await openChip('status');

    await (await checkbox('New')).check();
    await (await checkbox('Waiting')).check();

    expect(changes).toEqual([{ status: ['New'] }, { status: ['New', 'Waiting'] }]);
  });

  // Tab cycling inside the trap needs real browser focus movement, which the harness can't send; this covers Escape.
  it('statusMenu_Escape_ClosesAndFocusesChip', async () => {
    await render();
    await openChip('status');
    const menu = await overlay.getHarness(
      MatMenuHarness.with({ selector: '[data-chip="status"]' }),
    );
    const box = await checkbox('New');

    await (await box.host()).sendKeys(TestKey.ESCAPE);
    await fixture.whenStable();

    expect(await menu.isOpen()).toBe(false);
    expect(document.activeElement).toBe(root.querySelector('[data-chip="status"]'));
  });

  it('priorityChecklist_Check_EmitsPriority', async () => {
    await render();
    const changes = filterChanges();
    await openChip('priority');

    await (await checkbox('High')).check();

    expect(changes).toEqual([{ priority: ['High'] }]);
  });

  it('assigneeChecklist_Check_EmitsFullSelection', async () => {
    await render({ filters: { assignedTo: ['Avi'] }, assignees: ['Avi', 'Dana'] });
    const changes = filterChanges();
    await openChip('assignee');

    await (await checkbox('Dana')).check();

    expect(changes).toEqual([{ assignedTo: ['Avi', 'Dana'] }]);
  });

  it('assigneeChecklist_UrlNameNotInList_ShowsAsSelected', async () => {
    await render({ filters: { assignedTo: ['Zed'] }, assignees: ['Avi'] });

    await openChip('assignee');

    expect(await checkboxLabels()).toEqual(['Zed', 'Avi']);
    expect(await (await checkbox('Zed')).isChecked()).toBe(true);
    expect(await (await checkbox('Avi')).isChecked()).toBe(false);
  });

  it('assigneeChecklist_FilterText_NarrowsNames', async () => {
    await render({ assignees: ['Avi Levi', 'Dana Katz', 'Rina Ben'] });
    await openChip('assignee');
    const input = textInput('assignee');

    input.value = 'LEV';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(await checkboxLabels()).toEqual(['Avi Levi']);
  });

  it('assigneeChecklist_AtLimit_DisablesUnchecked', async () => {
    const full = Array.from({ length: MAX_FILTER_VALUES }, (_, i) => `user${i}`);
    await render({ filters: { assignedTo: full }, assignees: ['user0', 'dana'] });

    await openChip('assignee');

    expect(await (await checkbox('dana')).isDisabled()).toBe(true);
    expect(await (await checkbox('user0')).isDisabled()).toBe(false);
    expect(document.body.textContent).toContain(`At most ${MAX_FILTER_VALUES} names`);
  });

  it('assigneeChecklist_LoadError_ShowsMessage', async () => {
    await render({ filters: { assignedTo: ['Zed'] }, assigneesError: true });
    const changes = filterChanges();
    await openChip('assignee');

    await (await checkbox('Zed')).uncheck();

    expect(document.body.textContent).toContain("Couldn't load assignees");
    expect(changes).toEqual([{ assignedTo: [] }]);
  });

  it('dateRange_CompleteRange_EmitsBothDatesOnce', async () => {
    await render();
    const changes = filterChanges();
    // With no range set, the calendar opens on the current month; read before opening, so a midnight in between
    // can only fail the test, not pass it wrongly.
    const today = new Date();
    await openChip('created');
    const calendar = await overlay.getHarness(MatCalendarHarness);

    await calendar.selectCell({ text: '5' });
    const afterStart = [...changes];
    await calendar.selectCell({ text: '20' });

    expect(afterStart).toEqual([]);
    expect(changes).toEqual([
      {
        createdFrom: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 5)),
        createdTo: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 20)),
      },
    ]);
  });

  it('activeChip_Remove_ClearsThatFilter', async () => {
    await render({
      filters: { status: ['New'], createdFrom: '2026-10-01', createdTo: '2026-10-26' },
    });
    const changes = filterChanges();

    chipRemove('status')?.click();
    chipRemove('created')?.click();
    await fixture.whenStable();

    expect(changes).toEqual([{ status: [] }, { createdFrom: null, createdTo: null }]);
    expect(await overlay.getAllHarnesses(MatCheckboxHarness)).toEqual([]);
    expect(await overlay.getAllHarnesses(MatCalendarHarness)).toEqual([]);
    expect(chipRemove('status')?.getAttribute('aria-label')).toBe('Remove status filter');
  });

  it('activeChip_RemoveOrganization_ClearsDraftAndSubmits', async () => {
    await render({ filters: { organizationName: 'acme' }, organizationDraft: 'acme' });
    const drafts: string[] = [];
    let submits = 0;
    fixture.componentInstance.organizationDraftChange.subscribe((text) => drafts.push(text));
    fixture.componentInstance.textSubmit.subscribe(() => submits++);

    chipRemove('organization')?.click();

    expect(drafts).toEqual(['']);
    expect(submits).toBe(1);
  });

  it('activeChip_Labels_ShowSelection', async () => {
    await render({
      filters: {
        status: ['New', 'InProgress'],
        priority: ['High'],
        assignedTo: ['Avi', 'Dana', 'Rina'],
        createdFrom: '2026-10-01',
      },
      organizationDraft: ' acme ',
    });
    const label = (name: Chip) => chip(name).querySelector('.chip-body')?.textContent?.trim();

    expect(label('status')).toBe('Status: New, In progress');
    expect(label('priority')).toBe('Priority: High');
    expect(label('assignee')).toBe('Assignee: 3 selected');
    expect(label('organization')).toBe('Organization: acme');
    expect(label('created')).toBe('Created: from 2026-10-01');
    expect(chip('status').classList).toContain('on');

    await render({ filters: { assignedTo: ['Dana Katz'], createdTo: '2026-10-26' } });

    expect(label('assignee')).toBe('Assignee: Dana Katz');
    expect(label('created')).toBe('Created: to 2026-10-26');
    expect(label('status')).toBe('+ Status');
    expect(chip('status').classList).not.toContain('on');
    expect(chipRemove('status')).toBeNull();

    await render({ filters: { createdFrom: '2026-10-01', createdTo: '2026-10-26' } });

    expect(label('created')).toBe('Created: 2026-10-01 – 2026-10-26');
  });

  it('clearAll_NoActiveFilter_IsHidden', async () => {
    await render({ searchDraft: '  ' });

    expect(clearAll()).toBeUndefined();
  });

  it('clearAll_ActiveFilter_EmitsClear', async () => {
    // A search draft counts as an active filter before it reaches the URL.
    await render({ searchDraft: 'acme' });
    let clears = 0;
    fixture.componentInstance.clear.subscribe(() => clears++);

    clearAll()?.click();

    expect(clears).toBe(1);
  });
});
