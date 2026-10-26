import { convertToParamMap } from '@angular/router';
import { DEFAULT_QUERY, RequestQuery } from '../../core/models/request-query.model';
import { fromQueryParams, queryKey, toQueryParams } from './request-query-url';

const fullQuery: RequestQuery = {
  status: ['New', 'Waiting'],
  priority: ['High'],
  assignedTo: ['ann', 'bob'],
  organizationName: 'Acme',
  search: 'roof',
  createdFrom: '2026-01-01',
  createdTo: '2026-03-31',
  page: 3,
  pageSize: 50,
  sort: [
    { field: 'priority', direction: 'desc' },
    { field: 'createdAt', direction: 'asc' },
  ],
};

describe('request-query-url', () => {
  it('toQueryParams_DefaultQuery_ReturnsEmpty', () => {
    const result = toQueryParams(DEFAULT_QUERY);

    expect(result).toEqual({});
  });

  it('toQueryParams_FullQuery_WritesRepeatedKeysAndSortPairs', () => {
    const result = toQueryParams(fullQuery);

    expect(result).toEqual({
      status: ['New', 'Waiting'],
      priority: ['High'],
      assignedTo: ['ann', 'bob'],
      organizationName: 'Acme',
      search: 'roof',
      createdFrom: '2026-01-01',
      createdTo: '2026-03-31',
      page: '3',
      pageSize: '50',
      sort: ['priority:desc', 'createdAt:asc'],
    });
  });

  it('fromQueryParams_RoundTrip_ReturnsSameQuery', () => {
    const params = convertToParamMap(toQueryParams(fullQuery));

    const result = fromQueryParams(params);

    expect(result.query).toEqual(fullQuery);
    expect(result.invalid).toBe(false);
  });

  it('fromQueryParams_NoParams_ReturnsDefaultQueryNotInvalid', () => {
    const result = fromQueryParams(convertToParamMap({}));

    expect(result.query).toEqual(DEFAULT_QUERY);
    expect(result.invalid).toBe(false);
  });

  it('fromQueryParams_InvalidValues_DropsThemAndMarksInvalid', () => {
    const params = convertToParamMap({
      page: 'abc',
      pageSize: '500',
      status: ['Foo', 'New'],
      sort: ['title:sideways', 'priority'],
      createdFrom: '2026-02-30',
    });

    const result = fromQueryParams(params);

    expect(result.query.page).toBe(1);
    expect(result.query.pageSize).toBe(20);
    expect(result.query.status).toEqual(['New']);
    expect(result.query.sort).toEqual([{ field: 'priority', direction: 'asc' }]);
    expect(result.query.createdFrom).toBeNull();
    expect(result.invalid).toBe(true);
  });

  it('fromQueryParams_RepeatedSortField_KeepsFirst', () => {
    const params = convertToParamMap({ sort: ['title:desc', 'title'] });

    const result = fromQueryParams(params);

    expect(result.query.sort).toEqual([{ field: 'title', direction: 'desc' }]);
    expect(result.invalid).toBe(true);
  });

  it('fromQueryParams_FromAfterTo_DropsBothDates', () => {
    const params = convertToParamMap({ createdFrom: '2026-05-02', createdTo: '2026-05-01' });

    const result = fromQueryParams(params);

    expect(result.query.createdFrom).toBeNull();
    expect(result.query.createdTo).toBeNull();
    expect(result.invalid).toBe(true);
  });

  it('fromQueryParams_DuplicateStatusValues_DeduplicatesSilently', () => {
    const params = convertToParamMap({ status: ['New', 'New'], priority: ['Low', 'Low'] });

    const result = fromQueryParams(params);

    expect(result.query.status).toEqual(['New']);
    expect(result.query.priority).toEqual(['Low']);
    expect(result.invalid).toBe(false);
  });

  it('fromQueryParams_TextFilters_TrimsAndDropsTooLong', () => {
    const params = convertToParamMap({
      search: ' acme ',
      organizationName: 'x'.repeat(201),
      assignedTo: ['  ', 'y'.repeat(101), ' ann '],
    });

    const result = fromQueryParams(params);

    expect(result.query.search).toBe('acme');
    expect(result.query.organizationName).toBe('');
    expect(result.query.assignedTo).toEqual(['ann']);
    expect(result.invalid).toBe(true);
  });

  it('fromQueryParams_TooManyAssignees_KeepsFirstFifty', () => {
    const names = Array.from({ length: 51 }, (_, i) => `user${i}`);

    const result = fromQueryParams(convertToParamMap({ assignedTo: names }));

    expect(result.query.assignedTo).toEqual(names.slice(0, 50));
    expect(result.invalid).toBe(true);
  });

  it('fromQueryParams_PageAboveMax_FallsBackToOne', () => {
    const result = fromQueryParams(convertToParamMap({ page: '21474837' }));

    expect(result.query.page).toBe(1);
    expect(result.invalid).toBe(true);
  });

  it('queryKey_EqualQueries_ReturnsSameString', () => {
    const copy = structuredClone(fullQuery);

    expect(queryKey(copy)).toBe(queryKey(fullQuery));
    expect(queryKey(DEFAULT_QUERY)).not.toBe(queryKey(fullQuery));
  });
});
