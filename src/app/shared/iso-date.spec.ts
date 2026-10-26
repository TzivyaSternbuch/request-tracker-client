import { fromIsoDate, toIsoDate } from './iso-date';

describe('isoDate', () => {
  it('toIsoDate_LocalDate_FormatsCalendarDay', () => {
    const text = toIsoDate(new Date(2026, 0, 5));

    expect(text).toBe('2026-01-05');
  });

  it('fromIsoDate_Text_ReturnsLocalDate', () => {
    const date = fromIsoDate('2026-12-31');

    expect(date).toEqual(new Date(2026, 11, 31));
  });

  it('fromIsoDate_Null_ReturnsNull', () => {
    const date = fromIsoDate(null);

    expect(date).toBeNull();
  });
});
