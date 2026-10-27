import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { routes } from '../../../app.routes';
import { RequestsApiService } from '../../../core/api/requests-api.service';
import { PagedResult } from '../../../core/models/paged-result.model';
import { RequestQuery } from '../../../core/models/request-query.model';
import { RequestStats } from '../../../core/models/request-stats.model';
import { RequestDto, UpdateStatusRequest } from '../../../core/models/request.model';
import { StatusHistoryDto } from '../../../core/models/status-history.model';

function aRequest(id: number, overrides: Partial<RequestDto> = {}): RequestDto {
  return {
    id,
    title: `Request ${id}`,
    organizationName: 'Acme',
    status: 'New',
    priority: 'High',
    assignedTo: 'Dana',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 'v1',
    ...overrides,
  };
}

class FakeApi {
  readonly queries: RequestQuery[] = [];
  readonly loadedIds: number[] = [];
  readonly patches: UpdateStatusRequest[] = [];
  statsCalls = 0;

  getPaged(query: RequestQuery): Observable<PagedResult<RequestDto>> {
    this.queries.push(query);
    return of({ items: [aRequest(5)], page: 1, pageSize: 20, totalCount: 1 });
  }

  getAssignees(): Observable<string[]> {
    return of([]);
  }

  getStats(): Observable<RequestStats> {
    this.statsCalls++;
    return of({
      asOf: '2026-01-01T00:00:00Z',
      countByStatus: { New: 1, InProgress: 0, Waiting: 0, Completed: 0 },
      openRequestAge: { underSevenDays: 1, sevenToUnderThirtyDays: 0, thirtyDaysOrMore: 0 },
      topAssignees: [{ assignedTo: 'Dana', openCount: 1 }],
    });
  }

  getById(id: number): Observable<RequestDto> {
    this.loadedIds.push(id);
    return of(aRequest(id));
  }

  getHistory(): Observable<PagedResult<StatusHistoryDto>> {
    return of({ items: [], page: 1, pageSize: 10, totalCount: 0 });
  }

  updateStatus(id: number, body: UpdateStatusRequest): Observable<RequestDto> {
    this.patches.push(body);
    return of(aRequest(id, { status: body.status, version: 'v2' }));
  }
}

describe('RequestDetailsRouteComponent', () => {
  let api: FakeApi;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    api = new FakeApi();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: RequestsApiService, useValue: api }],
    });
    harness = await RouterTestingHarness.create();
  });

  async function settle() {
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();
  }

  function dialogText(): string | null {
    return document.querySelector('app-request-details')?.textContent ?? null;
  }

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('route_IdParam_OpensDialogWithThatId', async () => {
    await harness.navigateByUrl('/requests/5?status=New');
    await settle();

    expect(api.loadedIds).toEqual([5]);
    expect(dialogText()).toContain('Request 5');
  });

  it('route_QueryString_LoadsListWithItBehindTheDialog', async () => {
    await harness.navigateByUrl('/requests/5?status=New');
    await settle();

    expect(api.queries).toHaveLength(1);
    expect(api.queries[0].status).toEqual(['New']);
    expect(
      (harness.routeNativeElement as HTMLElement).querySelector('app-requests-table'),
    ).not.toBeNull();
  });

  it('route_DialogClosed_NavigatesToListPreservingQuery', async () => {
    await harness.navigateByUrl('/requests/5?status=New');
    await settle();

    TestBed.inject(MatDialog).closeAll();
    await settle();

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/requests?status=New'));
    expect(api.queries).toHaveLength(1);
  });

  it('route_BrowserBack_ClosesDialog', async () => {
    await harness.navigateByUrl('/requests?status=New');
    await harness.navigateByUrl('/requests/5?status=New');
    await settle();

    await TestBed.inject(Router).navigateByUrl('/requests?status=New');
    await settle();

    await vi.waitFor(() => expect(document.querySelector('app-request-details')).toBeNull());
  });

  it('route_NonNumericId_RedirectsToList', async () => {
    await harness.navigateByUrl('/requests/abc?status=New');
    await settle();

    expect(TestBed.inject(Router).url).toBe('/requests?status=New');
    expect(api.loadedIds).toEqual([]);
    expect(document.querySelector('app-request-details')).toBeNull();
  });

  it('route_StatusSaved_ReloadsTheListBehindTheDialog', async () => {
    await harness.navigateByUrl('/requests/5');
    await settle();

    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('app-request-details button'),
    );
    buttons.find((b) => b.getAttribute('aria-label') === 'Change status')?.click();
    await settle();
    const select = document.querySelector('app-request-details select') as HTMLSelectElement;
    select.value = 'Waiting';
    select.dispatchEvent(new Event('change'));
    const input = document.querySelector('app-request-details input') as HTMLInputElement;
    input.value = 'Lee';
    input.dispatchEvent(new Event('input'));
    await settle();
    Array.from(document.querySelectorAll<HTMLButtonElement>('app-request-details button'))
      .find((b) => b.textContent?.trim() === 'Save changes')
      ?.click();
    await settle();

    expect(api.patches).toEqual([{ status: 'Waiting', version: 'v1', changedBy: 'Lee' }]);
    expect(api.queries).toHaveLength(2);
    // Once when the list opened, once after the save.
    expect(api.statsCalls).toBe(2);
  });
});
