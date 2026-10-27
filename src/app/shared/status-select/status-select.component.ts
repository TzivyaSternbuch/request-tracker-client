import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { REQUEST_STATUSES, RequestStatus } from '../../core/models/request.model';
import { valueLabel } from '../value-label';

/** A native select of the request statuses with a disabled placeholder; `''` means nothing chosen. */
@Component({
  selector: 'app-status-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <select [attr.aria-label]="ariaLabel()" [disabled]="disabled()" (change)="onChange($event)">
      <option value="" [selected]="value() === ''" disabled>{{ placeholder() }}</option>
      @for (status of statuses(); track status) {
        <option [value]="status" [selected]="value() === status">{{ valueLabel(status) }}</option>
      }
    </select>
  `,
  styles: `
    select {
      box-sizing: border-box;
      width: 100%;
      height: 34px;
      padding: 0 10px;
      font: inherit;
      font-size: 14px;
      color: var(--app-text);
      background: var(--app-card-background);
      border: 1px solid var(--app-control-border);
      border-radius: 6px;

      &:focus-visible {
        outline: 2px solid var(--app-link);
        outline-offset: -1px;
      }

      &:disabled {
        opacity: 0.6;
      }
    }
  `,
})
export class StatusSelectComponent {
  /** The choices; all statuses unless the caller knows which ones apply. */
  readonly statuses = input<readonly RequestStatus[]>(REQUEST_STATUSES);
  readonly value = input<RequestStatus | ''>('');
  readonly placeholder = input('');
  readonly disabled = input(false);
  readonly ariaLabel = input<string | null>(null);

  readonly valueChange = output<RequestStatus | ''>();

  protected readonly valueLabel = valueLabel;

  protected onChange(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value as RequestStatus | '');
  }
}
