import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RequestPriority, RequestStatus } from '../../core/models/request.model';
import { valueLabel } from '../value-label';

type PillValue = RequestStatus | RequestPriority;
type Tone = 'blue' | 'amber' | 'green' | 'red' | 'gray';

const TONES: Record<PillValue, Tone> = {
  New: 'blue',
  InProgress: 'amber',
  Waiting: 'gray',
  Completed: 'green',
  High: 'red',
  Medium: 'amber',
  Low: 'gray',
};

@Component({
  selector: 'app-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="pill pill--{{ tone() }}">{{ label() }}</span>`,
  styles: `
    .pill {
      display: inline-block;
      font-size: 12px;
      line-height: 16px;
      padding: 3px 10px;
      border-radius: 999px;
      font-weight: 500;
      white-space: nowrap;
    }

    .pill--blue {
      background: var(--app-tone-blue-background);
      color: var(--app-tone-blue-text);
    }

    .pill--amber {
      background: var(--app-tone-amber-background);
      color: var(--app-tone-amber-text);
    }

    .pill--green {
      background: var(--app-tone-green-background);
      color: var(--app-tone-green-text);
    }

    .pill--red {
      background: var(--app-tone-red-background);
      color: var(--app-tone-red-text);
    }

    .pill--gray {
      background: var(--app-tone-gray-background);
      color: var(--app-tone-gray-text);
    }
  `,
})
export class StatusPillComponent {
  readonly value = input.required<PillValue>();

  protected readonly tone = computed(() => TONES[this.value()]);
  protected readonly label = computed(() => valueLabel(this.value()));
}
