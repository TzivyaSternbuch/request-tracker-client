import { RequestPriority, RequestStatus } from './request.model';

export type RequestSortField =
  | 'id'
  | 'title'
  | 'organizationName'
  | 'status'
  | 'priority'
  | 'assignedTo'
  | 'createdAt'
  | 'updatedAt';

export const REQUEST_SORT_FIELDS: readonly RequestSortField[] = [
  'id',
  'title',
  'organizationName',
  'status',
  'priority',
  'assignedTo',
  'createdAt',
  'updatedAt',
];

export type SortDirection = 'asc' | 'desc';
export const SORT_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];

export interface SortLevel {
  field: RequestSortField;
  direction: SortDirection;
}

export interface RequestFilters {
  status: RequestStatus[];
  priority: RequestPriority[];
  assignedTo: string[];
  organizationName: string;
  search: string;
  /** `yyyy-MM-dd`, a UTC day. */
  createdFrom: string | null;
  /** `yyyy-MM-dd`, a UTC day. */
  createdTo: string | null;
}

/**
 * The filters a single change replaces at once. Search and organization travel as drafts, and assignees as
 * add/remove intents, so they aren't here.
 */
export type ImmediateFilters = Partial<
  Pick<RequestFilters, 'status' | 'priority' | 'createdFrom' | 'createdTo'>
>;

export interface RequestQuery extends RequestFilters {
  page: number;
  pageSize: number;
  /** Empty means the server default order (`createdAt:desc`). */
  sort: SortLevel[];
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];
export const MAX_PAGE = 21_474_836;
export const MAX_FILTER_VALUES = 50;
export const ASSIGNED_TO_MAX_LENGTH = 100;
export const TEXT_FILTER_MAX_LENGTH = 200;

export const EMPTY_FILTERS: RequestFilters = {
  status: [],
  priority: [],
  assignedTo: [],
  organizationName: '',
  search: '',
  createdFrom: null,
  createdTo: null,
};

export const DEFAULT_QUERY: RequestQuery = {
  ...EMPTY_FILTERS,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sort: [],
};
