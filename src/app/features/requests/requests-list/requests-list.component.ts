import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PAGE_SIZE_OPTIONS } from '../../../core/models/request-query.model';
import { ThousandsPaginatorIntl } from '../../../shared/thousands-paginator-intl';
import { RequestsFilterBarComponent } from '../requests-filter-bar/requests-filter-bar.component';
import { RequestsTableComponent } from '../requests-table/requests-table.component';
import { LoadStatus, RequestsStore } from '../requests.store';

/**
 * Container: provides the store, wires its signals to the presentational parts and their outputs to its actions,
 * and shows the load states. The store keeps the previous result during loading and errors, so the template
 * branches on `status()` rather than on the data.
 */
@Component({
  selector: 'app-requests-list',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatPaginatorModule,
    MatProgressBarModule,
    RequestsFilterBarComponent,
    RequestsTableComponent,
  ],
  providers: [RequestsStore, { provide: MatPaginatorIntl, useClass: ThousandsPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requests-list.component.html',
  styleUrl: './requests-list.component.scss',
})
export class RequestsListComponent {
  protected readonly store = inject(RequestsStore);
  private readonly paginator = viewChild(MatPaginator);

  protected readonly pageSizeOptions = [...PAGE_SIZE_OPTIONS];
  protected readonly loading = computed(() => this.store.status() === 'loading');
  // True from the first success on. The store keeps the previous result while loading, so the last total stays
  // visible and the header doesn't jump; the error state hides it like the rest of the list.
  private readonly loadedOnce = linkedSignal<LoadStatus, boolean>({
    source: () => this.store.status(),
    computation: (status, previous) => status === 'success' || (previous?.value ?? false),
  });
  protected readonly showTotal = computed(
    () => this.loadedOnce() && this.store.status() !== 'error',
  );
  /** No sort levels chosen: the API applies its default order (newest first). */
  protected readonly defaultOrder = computed(() => this.store.query().sort.length === 0);
  protected readonly empty = computed(
    () => this.store.status() === 'success' && this.store.items().length === 0,
  );

  constructor() {
    // Not a [pageIndex] binding: the paginator moves its own index before it emits, and when the store keeps the
    // page number (pending text sends the user to page 1) a binding sees no change and never writes it back. The
    // store sets a new query object on every load, so this re-syncs even when the page number is the same.
    effect(() => {
      const paginator = this.paginator();
      const pageIndex = this.store.query().page - 1;
      if (paginator) paginator.pageIndex = pageIndex;
    });
  }
}
