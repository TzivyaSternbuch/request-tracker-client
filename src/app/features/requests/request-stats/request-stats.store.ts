import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';
import { problemMessage } from '../../../core/api/problem-message';
import { RequestsApiService } from '../../../core/api/requests-api.service';
import { LoadStatus } from '../../../core/models/load-status.model';
import { RequestStats } from '../../../core/models/request-stats.model';

type LoadResult = { ok: true; stats: RequestStats } | { ok: false; message: string };

/**
 * State of the overview section. The figures are global, not per filter, so there is one load and no query. It loads
 * when the store is created (the list page opens) and again on `refresh()`; `stats` keeps the previous figures during
 * a reload and an error, so consumers branch on `status()`.
 */
@Injectable()
export class RequestStatsStore {
  private readonly api = inject(RequestsApiService);

  private readonly statusSignal = signal<LoadStatus>('idle');
  private readonly statsSignal = signal<RequestStats | null>(null);
  private readonly errorMessageSignal = signal<string | null>(null);

  private readonly refresh$ = new Subject<void>();

  readonly status = this.statusSignal.asReadonly();
  readonly stats = this.statsSignal.asReadonly();
  readonly errorMessage = this.errorMessageSignal.asReadonly();

  constructor() {
    this.refresh$
      .pipe(
        startWith(undefined),
        // switchMap cancels the pending request when a newer one starts. catchError stays inside it, so a failed
        // request ends only its own inner stream and Retry keeps working.
        switchMap(() => {
          this.statusSignal.set('loading');
          return this.api.getStats().pipe(
            map((stats): LoadResult => ({ ok: true, stats })),
            catchError((error: unknown) =>
              of<LoadResult>({ ok: false, message: problemMessage(error) }),
            ),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (result.ok) {
          this.statsSignal.set(result.stats);
          this.errorMessageSignal.set(null);
          this.statusSignal.set('success');
        } else {
          this.errorMessageSignal.set(result.message);
          this.statusSignal.set('error');
        }
      });
  }

  /** Reloads the figures; used by Retry and after a status update changed them. */
  refresh(): void {
    this.refresh$.next();
  }
}
