import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

const format = (value: number) => value.toLocaleString('en-US');

/** Material's range label ("1 – 20 of 100,000") with thousands separators; same rules for empty and past-the-end. */
@Injectable()
export class ThousandsPaginatorIntl extends MatPaginatorIntl {
  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) return `0 of ${format(length)}`;
    const total = Math.max(length, 0);
    const start = page * pageSize;
    const end = start < total ? Math.min(start + pageSize, total) : start + pageSize;
    return `${format(start + 1)} – ${format(end)} of ${format(total)}`;
  };
}
