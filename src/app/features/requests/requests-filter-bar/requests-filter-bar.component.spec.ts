import { HarnessLoader, TestKey } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatChipGridHarness } from '@angular/material/chips/testing';
import { MatDateRangeInputHarness } from '@angular/material/datepicker/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import {
  EMPTY_FILTERS,
  ImmediateFilters,
  MAX_FILTER_VALUES,
  RequestFilters,
} from '../../../core/models/request-query.model';
import { RequestsFilterBarComponent } from './requests-filter-bar.component';

describe('RequestsFilterBarComponent', () => {
  let fixture: ComponentFixture<RequestsFilterBarComponent>;
  let root: HTMLElement;
  let loader: HarnessLoader;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RequestsFilterBarComponent] });
    fixture = TestBed.createComponent(RequestsFilterBarComponent);
    root = fixture.nativeElement as HTMLElement;
    loader = TestbedHarnessEnvironment.loader(fixture);
  });

  async function render(
    filters: Partial<RequestFilters> = {},
    searchDraft = '',
    organizationDraft = '',
  ): Promise<void> {
    fixture.componentRef.setInput('filters', { ...EMPTY_FILTERS, ...filters });
    fixture.componentRef.setInput('searchDraft', searchDraft);
    fixture.componentRef.setInput('organizationDraft', organizationDraft);
    await fixture.whenStable();
  }

  function textInput(name: 'search' | 'organization'): HTMLInputElement {
    const input = root.querySelector<HTMLInputElement>(`input[data-filter="${name}"]`);
    if (!input) throw new Error(`No ${name} input`);
    return input;
  }

  function filterChanges(): ImmediateFilters[] {
    const changes: ImmediateFilters[] = [];
    fixture.componentInstance.filtersChange.subscribe((change) => changes.push(change));
    return changes;
  }

  function emitted(output: 'assigneeAdd' | 'assigneeRemove'): string[] {
    const names: string[] = [];
    fixture.componentInstance[output].subscribe((name) => names.push(name));
    return names;
  }

  async function addAssignee(name: string): Promise<void> {
    const grid = await loader.getHarness(MatChipGridHarness);
    const input = await grid.getInput();
    await input?.setValue(name);
    await input?.sendSeparatorKey(TestKey.ENTER);
  }

  for (const name of ['search', 'organization'] as const) {
    const draftChange = name === 'search' ? 'searchDraftChange' : 'organizationDraftChange';

    it(`${name}Input_Typing_EmitsDraftChange`, async () => {
      await render();
      const drafts: string[] = [];
      fixture.componentInstance[draftChange].subscribe((text) => drafts.push(text));
      const input = textInput(name);

      input.value = 'acme ';
      input.dispatchEvent(new Event('input'));

      expect(drafts).toEqual(['acme ']);
    });

    it(`${name}Input_Enter_EmitsTextSubmit`, async () => {
      await render();
      let submits = 0;
      fixture.componentInstance.textSubmit.subscribe(() => submits++);

      textInput(name).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(submits).toBe(1);
    });
  }

  it('render_Drafts_ShowsDraftText', async () => {
    await render({ search: 'acme', organizationName: 'glob' }, 'acme ', 'glob ');

    expect(textInput('search').value).toBe('acme ');
    expect(textInput('organization').value).toBe('glob ');
  });

  // The store trims, ignores blank and listed names and applies the limit; the bar reports what was typed.
  it('assigneeInput_Enter_EmitsAssigneeAddAndClearsInput', async () => {
    await render({ assignedTo: ['ann'] });
    const added = emitted('assigneeAdd');
    const changes = filterChanges();

    await addAssignee('  dana ');

    const input = await (await loader.getHarness(MatChipGridHarness)).getInput();
    expect(added).toEqual(['  dana ']);
    expect(await input?.getValue()).toBe('');
    expect(changes).toEqual([]);
  });

  it('render_AssigneesAtLimit_ShowsLimitHint', async () => {
    const full = Array.from({ length: MAX_FILTER_VALUES }, (_, i) => `user${i}`);

    await render({ assignedTo: full });

    expect(root.textContent).toContain(`At most ${MAX_FILTER_VALUES} names`);
  });

  it('assigneeChip_Remove_EmitsAssigneeRemove', async () => {
    await render({ assignedTo: ['ann', 'dana', 'lee'] });
    const removed = emitted('assigneeRemove');
    const changes = filterChanges();
    const grid = await loader.getHarness(MatChipGridHarness);
    const [, dana] = await grid.getRows();

    await dana.remove();

    expect(removed).toEqual(['dana']);
    expect(changes).toEqual([]);
  });

  it('render_Assignees_ShowsChips', async () => {
    await render({ assignedTo: ['ann', 'dana'] });
    const grid = await loader.getHarness(MatChipGridHarness);

    const rows = await grid.getRows();

    expect(await Promise.all(rows.map((row) => row.getText()))).toEqual(['ann', 'dana']);
  });

  it('statusSelect_Change_EmitsStatus', async () => {
    await render({ status: ['New'] });
    const changes = filterChanges();
    const select = await loader.getHarness(
      MatSelectHarness.with({ selector: '[data-filter="status"]' }),
    );

    await select.open();
    await select.clickOptions({ text: 'Waiting' });

    expect(changes).toEqual([{ status: ['New', 'Waiting'] }]);
  });

  it('prioritySelect_Change_EmitsPriority', async () => {
    await render();
    const changes = filterChanges();
    const select = await loader.getHarness(
      MatSelectHarness.with({ selector: '[data-filter="priority"]' }),
    );

    await select.open();
    await select.clickOptions({ text: 'High' });

    expect(changes).toEqual([{ priority: ['High'] }]);
  });

  it('createdRange_TypedDays_EmitsIsoDays', async () => {
    await render();
    const changes = filterChanges();
    const range = await loader.getHarness(MatDateRangeInputHarness);

    await (await range.getStartInput()).setValue('1/5/2026');
    await (await range.getEndInput()).setValue('2/28/2026');

    expect(changes).toEqual([{ createdFrom: '2026-01-05' }, { createdTo: '2026-02-28' }]);
  });

  it('render_CreatedRange_ShowsDays', async () => {
    await render({ createdFrom: '2026-01-05', createdTo: '2026-02-28' });
    const range = await loader.getHarness(MatDateRangeInputHarness);

    const from = await (await range.getStartInput()).getValue();
    const to = await (await range.getEndInput()).getValue();

    // The native date adapter formats with the app locale (default en-US).
    expect([from, to]).toEqual(['1/5/2026', '2/28/2026']);
  });

  it('clearButton_Click_EmitsClear', async () => {
    await render({ status: ['New'] });
    let clears = 0;
    fixture.componentInstance.clear.subscribe(() => clears++);

    Array.from(root.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Clear filters'))
      ?.click();

    expect(clears).toBe(1);
  });
});
