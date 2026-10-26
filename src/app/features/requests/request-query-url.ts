import { ParamMap, Params } from '@angular/router';
import {
  ASSIGNED_TO_MAX_LENGTH,
  DEFAULT_PAGE_SIZE,
  DEFAULT_QUERY,
  MAX_FILTER_VALUES,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  REQUEST_SORT_FIELDS,
  RequestQuery,
  SORT_DIRECTIONS,
  SortLevel,
  TEXT_FILTER_MAX_LENGTH,
} from '../../core/models/request-query.model';
import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../../core/models/request.model';

/** Only non-default values are written, so the default view has a clean URL. */
export function toQueryParams(query: RequestQuery): Params {
  const params: Params = {};
  if (query.status.length > 0) params['status'] = [...query.status];
  if (query.priority.length > 0) params['priority'] = [...query.priority];
  if (query.assignedTo.length > 0) params['assignedTo'] = [...query.assignedTo];
  if (query.organizationName !== '') params['organizationName'] = query.organizationName;
  if (query.search !== '') params['search'] = query.search;
  if (query.createdFrom !== null) params['createdFrom'] = query.createdFrom;
  if (query.createdTo !== null) params['createdTo'] = query.createdTo;
  if (query.page !== DEFAULT_QUERY.page) params['page'] = String(query.page);
  if (query.pageSize !== DEFAULT_PAGE_SIZE) params['pageSize'] = String(query.pageSize);
  if (query.sort.length > 0) {
    params['sort'] = query.sort.map((level) => `${level.field}:${level.direction}`);
  }
  return params;
}

/**
 * Tolerant parsing: an invalid value is dropped and its default used, so a broken link still opens
 * a working list. `invalid` tells the caller to rewrite the URL to the normalized query.
 */
export function fromQueryParams(params: ParamMap): { query: RequestQuery; invalid: boolean } {
  const status = parseEnumList(params.getAll('status'), REQUEST_STATUSES);
  const priority = parseEnumList(params.getAll('priority'), REQUEST_PRIORITIES);
  const assignedTo = parseAssignees(params.getAll('assignedTo'));
  const organizationName = parseText(params.getAll('organizationName'));
  const search = parseText(params.getAll('search'));
  const dates = parseDateRange(params.get('createdFrom'), params.get('createdTo'));
  const page = parseInteger(params.getAll('page'), MAX_PAGE, DEFAULT_QUERY.page);
  const pageSize = parseInteger(params.getAll('pageSize'), MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  const sort = parseSort(params.getAll('sort'));

  const invalid = [
    status,
    priority,
    assignedTo,
    organizationName,
    search,
    dates,
    page,
    pageSize,
    sort,
  ].some((parsed) => parsed.invalid);

  return {
    query: {
      status: status.value,
      priority: priority.value,
      assignedTo: assignedTo.value,
      organizationName: organizationName.value,
      search: search.value,
      createdFrom: dates.value.from,
      createdTo: dates.value.to,
      page: page.value,
      pageSize: pageSize.value,
      sort: sort.value,
    },
    invalid,
  };
}

/** A stable string for `distinctUntilChanged` and the draft-reset check. */
export function queryKey(query: RequestQuery): string {
  return JSON.stringify(toQueryParams(query));
}

interface Parsed<T> {
  value: T;
  invalid: boolean;
}

// Duplicates are removed silently: they change nothing about the result.
function parseEnumList<T extends string>(raw: string[], allowed: readonly T[]): Parsed<T[]> {
  const value = new Set<T>();
  let invalid = false;
  for (const item of raw) {
    const match = allowed.find((option) => option === item);
    if (match === undefined) {
      invalid = true;
    } else {
      value.add(match);
    }
  }
  return { value: [...value], invalid };
}

function parseAssignees(raw: string[]): Parsed<string[]> {
  const value = new Set<string>();
  let invalid = false;
  for (const item of raw) {
    const name = item.trim();
    if (name === '' || name.length > ASSIGNED_TO_MAX_LENGTH) {
      invalid = true;
    } else {
      value.add(name);
    }
  }
  if (value.size > MAX_FILTER_VALUES) {
    invalid = true;
  }
  return { value: [...value].slice(0, MAX_FILTER_VALUES), invalid };
}

function parseText(raw: string[]): Parsed<string> {
  if (raw.length === 0) {
    return { value: '', invalid: false };
  }
  const text = raw[0].trim();
  if (text === '' || text.length > TEXT_FILTER_MAX_LENGTH) {
    return { value: '', invalid: true };
  }
  return { value: text, invalid: false };
}

function parseInteger(raw: string[], max: number, fallback: number): Parsed<number> {
  if (raw.length === 0) {
    return { value: fallback, invalid: false };
  }
  const number = /^\d+$/.test(raw[0]) ? Number(raw[0]) : NaN;
  if (!(number >= 1 && number <= max)) {
    return { value: fallback, invalid: true };
  }
  return { value: number, invalid: false };
}

function parseSort(raw: string[]): Parsed<SortLevel[]> {
  const value: SortLevel[] = [];
  let invalid = false;
  for (const item of raw) {
    const [field, direction = 'asc', ...rest] = item.split(':');
    const validField = REQUEST_SORT_FIELDS.find((option) => option === field);
    const validDirection = SORT_DIRECTIONS.find((option) => option === direction);
    const repeated = value.some((level) => level.field === validField);
    if (rest.length > 0 || !validField || !validDirection || repeated) {
      invalid = true;
    } else {
      value.push({ field: validField, direction: validDirection });
    }
  }
  return { value, invalid };
}

function parseDateRange(
  rawFrom: string | null,
  rawTo: string | null,
): Parsed<{ from: string | null; to: string | null }> {
  const from = rawFrom === null ? null : validDay(rawFrom);
  const to = rawTo === null ? null : validDay(rawTo);
  // ISO days compare correctly as strings.
  if (from !== null && to !== null && from > to) {
    return { value: { from: null, to: null }, invalid: true };
  }
  const invalid = (rawFrom !== null && from === null) || (rawTo !== null && to === null);
  return { value: { from, to }, invalid };
}

// A real calendar day: `2026-02-30` matches the pattern but is not a day.
function validDay(text: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text) ? text : null;
}
