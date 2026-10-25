import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AppComponent } from './app.component';
import { routes } from './app.routes';

describe('AppComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter(routes)],
    });
  });

  it('render_Default_ShowsToolbarWithAppName', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const toolbar = (fixture.nativeElement as HTMLElement).querySelector('mat-toolbar');
    expect(toolbar?.textContent).toContain('Request Tracker');
  });

  it('navigate_UnknownPath_RedirectsToRequests', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/does-not-exist');

    expect(TestBed.inject(Router).url).toBe('/requests');
  });
});
