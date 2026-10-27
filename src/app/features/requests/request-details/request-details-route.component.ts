import { ChangeDetectionStrategy, Component, DestroyRef, Injector, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { RequestDetailsComponent, RequestDetailsData } from './request-details.component';

const MAX_ID = 2_147_483_647;

/**
 * Route host for `requests/:id`: renders nothing itself, it opens the details dialog over the list that stays
 * rendered behind it. Closing the dialog navigates back to the list with its query string; leaving the route
 * (browser Back) closes the dialog.
 */
@Component({
  selector: 'app-request-details-route',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class RequestDetailsRouteComponent {
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);

  private dialogRef: MatDialogRef<RequestDetailsComponent> | null = null;

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        this.dismissDialog();
        const text = params.get('id') ?? '';
        const id = /^\d{1,10}$/.test(text) ? Number(text) : NaN;
        if (!(id <= MAX_ID)) {
          // Not a request id, so there is nothing to show.
          void this.backToList();
          return;
        }
        this.open(id);
      });
    inject(DestroyRef).onDestroy(() => this.dismissDialog());
  }

  private open(id: number): void {
    const data: RequestDetailsData = { id };
    const ref = this.dialog.open(RequestDetailsComponent, {
      data,
      injector: this.injector,
      width: '860px',
      maxWidth: 'calc(100vw - 32px)',
      // The surface scrolls past this; without it a short window cuts the dialog off.
      maxHeight: 'calc(100vh - 32px)',
    });
    this.dialogRef = ref;
    ref.afterClosed().subscribe(() => {
      // Only a close by the user comes back here; dismissDialog() forgets the ref first.
      if (this.dialogRef === ref) {
        this.dialogRef = null;
        void this.backToList();
      }
    });
  }

  private dismissDialog(): void {
    const ref = this.dialogRef;
    this.dialogRef = null;
    ref?.close();
  }

  private backToList(): Promise<boolean> {
    return this.router.navigate(['/requests'], { queryParamsHandling: 'preserve' });
  }
}
