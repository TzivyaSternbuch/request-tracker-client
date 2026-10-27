import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PagedResult } from '../models/paged-result.model';
import { DEFAULT_QUERY, RequestQuery } from '../models/request-query.model';
import { RequestDto } from '../models/request.model';
import { RequestsApiService } from './requests-api.service';

describe('RequestsApiService', () => {
  let service: RequestsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RequestsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getPaged_DefaultQuery_SendsPageAndPageSizeOnly', () => {
    service.getPaged(DEFAULT_QUERY).subscribe();

    const req = http.expectOne((r) => r.url === '/api/requests');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize']);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ items: [], page: 1, pageSize: 20, totalCount: 0 });
  });

  it('getPaged_FullQuery_SendsRepeatedKeysAndSortPairs', () => {
    const query: RequestQuery = {
      ...DEFAULT_QUERY,
      page: 3,
      pageSize: 50,
      status: ['New', 'Waiting'],
      priority: ['High'],
      assignedTo: ['Dana', 'Lee'],
      organizationName: 'Ac',
      search: 'acme',
      createdFrom: '2026-01-01',
      createdTo: '2026-01-31',
      sort: [
        { field: 'priority', direction: 'desc' },
        { field: 'createdAt', direction: 'asc' },
      ],
    };

    service.getPaged(query).subscribe();

    const req = http.expectOne((r) => r.url === '/api/requests');
    const params = req.request.params;
    expect(params.getAll('status')).toEqual(['New', 'Waiting']);
    expect(params.getAll('priority')).toEqual(['High']);
    expect(params.getAll('assignedTo')).toEqual(['Dana', 'Lee']);
    expect(params.getAll('sort')).toEqual(['priority:desc', 'createdAt:asc']);
    expect(params.get('page')).toBe('3');
    expect(params.get('pageSize')).toBe('50');
    expect(params.get('organizationName')).toBe('Ac');
    expect(params.get('createdFrom')).toBe('2026-01-01');
    expect(params.get('createdTo')).toBe('2026-01-31');
    expect(params.get('search')).toBe('acme');
    req.flush({ items: [], page: 3, pageSize: 50, totalCount: 0 });
  });

  it('getPaged_BlankAndNullValues_AreNotSent', () => {
    const query: RequestQuery = {
      ...DEFAULT_QUERY,
      search: '',
      organizationName: '',
      createdFrom: null,
      assignedTo: [],
    };

    service.getPaged(query).subscribe();

    const req = http.expectOne((r) => r.url === '/api/requests');
    expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize']);
    req.flush({ items: [], page: 1, pageSize: 20, totalCount: 0 });
  });

  it('getPaged_Response_ReturnsBody', () => {
    const body: PagedResult<RequestDto> = { items: [], page: 1, pageSize: 20, totalCount: 7 };
    let result: PagedResult<RequestDto> | undefined;

    service.getPaged(DEFAULT_QUERY).subscribe((r) => (result = r));
    http.expectOne((r) => r.url === '/api/requests').flush(body);

    expect(result).toEqual(body);
  });

  it('getAssignees_Response_ReturnsNames', () => {
    let result: string[] | undefined;

    service.getAssignees().subscribe((names) => (result = names));
    const req = http.expectOne('/api/requests/assignees');
    req.flush(['Dana', 'Lee']);

    expect(req.request.method).toBe('GET');
    expect(result).toEqual(['Dana', 'Lee']);
  });

  const sample: RequestDto = {
    id: 7,
    title: 'T',
    organizationName: 'Org',
    status: 'New',
    priority: 'High',
    assignedTo: 'Dana',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 'AAA=',
  };

  it('getById_Id_RequestsThatUrl', () => {
    service.getById(7).subscribe();

    const req = http.expectOne('/api/requests/7');
    expect(req.request.method).toBe('GET');
    req.flush(sample);
  });

  it('getById_Response_ReturnsBody', () => {
    let result: RequestDto | undefined;
    service.getById(7).subscribe((r) => (result = r));

    http.expectOne('/api/requests/7').flush(sample);

    expect(result).toEqual(sample);
  });

  it('updateStatus_Body_SendsPatchWithStatusVersionAndChangedBy', () => {
    service.updateStatus(7, { status: 'Waiting', version: 'AAA=', changedBy: 'Dana' }).subscribe();

    const req = http.expectOne('/api/requests/7/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'Waiting', version: 'AAA=', changedBy: 'Dana' });
    req.flush(sample);
  });

  it('updateStatus_Response_ReturnsUpdatedRequest', () => {
    const updated = { ...sample, status: 'Waiting' as const, version: 'BBB=' };
    let result: RequestDto | undefined;
    service
      .updateStatus(7, { status: 'Waiting', version: 'AAA=', changedBy: 'Dana' })
      .subscribe((r) => (result = r));

    http.expectOne('/api/requests/7/status').flush(updated);

    expect(result).toEqual(updated);
  });
});
