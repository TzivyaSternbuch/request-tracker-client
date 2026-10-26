import { RequestSortField, SortLevel } from '../../core/models/request-query.model';

/** Unsorted → added last, ascending; ascending → descending (same position); descending → removed. */
export function toggleSortLevel(
  levels: readonly SortLevel[],
  field: RequestSortField,
): SortLevel[] {
  const index = levels.findIndex((level) => level.field === field);
  if (index === -1) {
    return [...levels.map((level) => ({ ...level })), { field, direction: 'asc' }];
  }
  if (levels[index].direction === 'asc') {
    return levels.map((level, i) => (i === index ? { field, direction: 'desc' } : { ...level }));
  }
  return levels.filter((_, i) => i !== index).map((level) => ({ ...level }));
}
