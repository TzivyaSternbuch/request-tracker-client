import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StatusPillComponent } from '../../../shared/status-pill/status-pill.component';
import { RequestHistoryStore } from './request-history.store';

@Component({
  selector: 'app-request-history',
  imports: [DatePipe, MatButtonModule, MatProgressBarModule, StatusPillComponent],
  providers: [RequestHistoryStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-history.component.html',
  styleUrl: './request-history.component.scss',
})
export class RequestHistoryComponent {
  protected readonly store = inject(RequestHistoryStore);

  readonly requestId = input.required<number>();
  readonly version = input.required<string>();

  constructor() {
    effect(() => {
      const id = this.requestId();
      this.version();
      untracked(() => this.store.load(id));
    });
  }
}
