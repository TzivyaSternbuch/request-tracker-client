import { SortLevel } from '../../core/models/request-query.model';
import { toggleSortLevel } from './sort-levels';

describe('toggleSortLevel', () => {
  it('toggleSortLevel_UnsortedField_AddsLastAscending', () => {
    const levels: SortLevel[] = [{ field: 'title', direction: 'asc' }];

    const result = toggleSortLevel(levels, 'priority');

    expect(result).toEqual([
      { field: 'title', direction: 'asc' },
      { field: 'priority', direction: 'asc' },
    ]);
  });

  it('toggleSortLevel_AscendingField_SwitchesToDescendingKeepingPosition', () => {
    const levels: SortLevel[] = [
      { field: 'title', direction: 'asc' },
      { field: 'priority', direction: 'asc' },
    ];

    const result = toggleSortLevel(levels, 'title');

    expect(result).toEqual([
      { field: 'title', direction: 'desc' },
      { field: 'priority', direction: 'asc' },
    ]);
  });

  it('toggleSortLevel_DescendingField_RemovesIt', () => {
    const levels: SortLevel[] = [
      { field: 'title', direction: 'desc' },
      { field: 'priority', direction: 'asc' },
    ];

    const result = toggleSortLevel(levels, 'title');

    expect(result).toEqual([{ field: 'priority', direction: 'asc' }]);
  });

  it('toggleSortLevel_Always_DoesNotMutateInput', () => {
    const levels: SortLevel[] = [{ field: 'title', direction: 'asc' }];
    const snapshot = structuredClone(levels);

    const added = toggleSortLevel(levels, 'priority');
    const switched = toggleSortLevel(levels, 'title');

    expect(levels).toEqual(snapshot);
    expect(added).not.toBe(levels);
    expect(switched).not.toBe(levels);
  });
});
