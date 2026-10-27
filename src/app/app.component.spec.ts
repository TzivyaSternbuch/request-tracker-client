import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ActingAsService } from './core/acting-as.service';
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

  it('toolbar_Typing_UpdatesActingAsName', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;

    input.value = 'Dana Katz';
    input.dispatchEvent(new Event('input'));

    expect(TestBed.inject(ActingAsService).name()).toBe('Dana Katz');
  });

  it('toolbar_EmptyName_ShowsPlaceholderAndNoAvatar', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('input')?.placeholder).toBe('Acting as…');
    expect(root.querySelector('.avatar')).toBeNull();
  });

  it('toolbar_NameSet_ShowsInitials', async () => {
    TestBed.inject(ActingAsService).setName('Dana Katz');
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('.avatar')?.textContent).toBe('DK');
  });

  it('navigate_EmptyPath_RedirectsToRequests', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/');

    expect(TestBed.inject(Router).url).toBe('/requests');
  });

  it('navigate_UnknownPath_RedirectsToRequests', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/does-not-exist');

    expect(TestBed.inject(Router).url).toBe('/requests');
  });
});
