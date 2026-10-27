import { TestBed } from '@angular/core/testing';
import { RequestPriority, RequestStatus } from '../../core/models/request.model';
import { StatusPillComponent } from './status-pill.component';

describe('StatusPillComponent', () => {
  it('render_EachValue_ShowsLabelAndColourClass', async () => {
    const cases: [RequestStatus | RequestPriority, string, string][] = [
      ['New', 'New', 'pill--blue'],
      ['InProgress', 'In progress', 'pill--amber'],
      ['Waiting', 'Waiting', 'pill--gray'],
      ['Completed', 'Completed', 'pill--green'],
      ['High', 'High', 'pill--red'],
      ['Medium', 'Medium', 'pill--amber'],
      ['Low', 'Low', 'pill--gray'],
    ];
    const fixture = TestBed.createComponent(StatusPillComponent);
    const rendered: [string, string][] = [];

    for (const [value] of cases) {
      fixture.componentRef.setInput('value', value);
      await fixture.whenStable();
      const pill = (fixture.nativeElement as HTMLElement).querySelector('.pill');
      const tone = Array.from(pill?.classList ?? []).find((c) => c.startsWith('pill--')) ?? '';
      rendered.push([pill?.textContent?.trim() ?? '', tone]);
    }

    expect(rendered).toEqual(cases.map(([, label, tone]) => [label, tone]));
  });
});
