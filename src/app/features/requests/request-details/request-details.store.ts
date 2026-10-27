import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { problemMessage } from '../../../core/api/problem-message';
import { RequestsApiService } from '../../../core/api/requests-api.service';
import { RequestDto, RequestStatus } from '../../../core/models/request.model';

export type DetailsLoadState = 'loading' | 'success' | 'error' | 'notFound';
export type SaveState = 'idle' | 'saving';

type LoadResult =
  | { state: 'success'; request: RequestDto }
  | { state: 'notFound' }
  | { state: 'error'; message: string };

/**
 * State of the request details dialog. A reload (retry, or after a 409) keeps the current request in `request`, so
 * the view can dim it instead of blanking it. The status update sends the `version` of the request the store holds;
 * the server decides whether it is still current.
 */
@Injectable()
export class RequestDetailsStore {
  private readonly api = inject(RequestsApiService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly loadStateSignal = signal<DetailsLoadState>('loading');
  private readonly requestSignal = signal<RequestDto | null>(null);
  private readonly errorMessageSignal = signal<string | null>(null);
  private readonly saveStateSignal = signal<SaveState>('idle');
  private readonly saveErrorSignal = signal<string | null>(null);
  private readonly conflictSignal = signal(false);

  private readonly load$ = new Subject<number>();
  private currentId: number | null = null;

  readonly loadState = this.loadStateSignal.asReadonly();
  readonly request = this.requestSignal.asReadonly();
  readonly errorMessage = this.errorMessageSignal.asReadonly();
  readonly saveState = this.saveStateSignal.asReadonly();
  readonly saveError = this.saveErrorSignal.asReadonly();
  /** True after a 409 until the panel is opened again or the dialog closes. */
  readonly conflict = this.conflictSignal.asReadonly();

  /** Emits after a successful save and after a 409, so the list can reload to match. */
  private readonly updatedSubject = new Subject<void>();
  readonly updated$ = this.updatedSubject.asObservable();

  constructor() {
    this.load$
      .pipe(
        switchMap((id) =>
          this.api.getById(id).pipe(
            map((request): LoadResult => ({ state: 'success', request })),
            // Inside the inner observable, so a failed load doesn't end the stream and Retry keeps working.
            catchError((error: unknown) =>
              of<LoadResult>(
                error instanceof HttpErrorResponse && error.status === 404
                  ? { state: 'notFound' }
                  : { state: 'error', message: problemMessage(error) },
              ),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.loadStateSignal.set(result.state);
        if (result.state === 'success') {
          this.requestSignal.set(result.request);
        } else if (result.state === 'error') {
          this.errorMessageSignal.set(result.message);
        }
      });
  }

  load(id: number): void {
    // A different id must not show the previous request's data; a reload of the same id keeps it on screen.
    if (id !== this.currentId) this.requestSignal.set(null);
    this.currentId = id;
    this.reload();
  }

  retry(): void {
    this.reload();
  }

  updateStatus(status: RequestStatus, changedBy: string): void {
    const request = this.requestSignal();
    if (!request || this.saveStateSignal() === 'saving') return;

    this.saveStateSignal.set('saving');
    this.saveErrorSignal.set(null);
    this.api
      .updateStatus(request.id, { status, version: request.version, changedBy })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.requestSignal.set(updated);
          this.saveStateSignal.set('idle');
          this.updatedSubject.next();
        },
        error: (error: unknown) => this.onSaveError(error),
      });
  }

  dismissConflict(): void {
    this.conflictSignal.set(false);
  }

  /** Called when the panel opens, so an error from an earlier attempt doesn't greet a new one. */
  clearSaveError(): void {
    this.saveErrorSignal.set(null);
  }

  private onSaveError(error: unknown): void {
    this.saveStateSignal.set('idle');
    const httpStatus = error instanceof HttpErrorResponse ? error.status : null;
    if (httpStatus === 404) {
      this.loadStateSignal.set('notFound');
    } else if (httpStatus === 409) {
      this.conflictSignal.set(true);
      this.reload();
      this.updatedSubject.next();
    } else {
      this.saveErrorSignal.set(problemMessage(error));
    }
  }

  private reload(): void {
    if (this.currentId === null) return;
    this.loadStateSignal.set('loading');
    this.load$.next(this.currentId);
  }
}
