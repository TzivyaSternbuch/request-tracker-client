import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PAGE_SIZE_OPTIONS } from '../../../core/models/request-query.model';
import { RequestsFilterBarComponent } from '../requests-filter-bar/requests-filter-bar.component';
import { RequestsTableComponent } from '../requests-table/requests-table.component';
import { RequestsStore } from '../requests.store';

/**
 * Container: provides the store, wires its signals to the presentational parts and their outputs to its actions,
 * and shows the load states. The store keeps the previous result during loading and errors, so the template
 * branches on `status()` rather than on the data.
 */
@Component({
  selector: 'app-requests-list',
  imports: [
    MatButtonModule,
    MatPaginatorModule,
    MatProgressBarModule,
    RequestsFilterBarComponent,
    RequestsTableComponent,
  ],
  providers: [RequestsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>Requests</h2>

    <app-requests-filter-bar
      [filters]="store.query()"
      [searchDraft]="store.searchDraft()"
      [organizationDraft]="store.organizationDraft()"
      (searchDraftChange)="store.setSearchDraft($event)"
      (organizationDraftChange)="store.setOrganizationDraft($event)"
      (textSubmit)="store.submitText()"
      (filtersChange)="store.setFilters($event)"
      (assigneeAdd)="store.addAssignee($event)"
      (assigneeRemove)="store.removeAssignee($event)"
      (clear)="store.clearFilters()"
    />

    @if (store.status() === 'error') {
      <div class="message" role="alert">
        <p>{{ store.errorMessage() }}</p>
        <button mat-flat-button type="button" (click)="store.retry()">Retry</button>
      </div>
    } @else {
      <!-- Reserves the bar's height, so the table doesn't jump when loading starts and ends. -->
      <div class="progress">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" aria-label="Loading requests" />
        }
      </div>

      @if (empty()) {
        <div class="message empty-state">
          <p>No requests match these filters</p>
          <button mat-stroked-button type="button" (click)="store.clearFilters()">
            Clear filters
          </button>
        </div>
      } @else {
        <app-requests-table
          [items]="store.items()"
          [sort]="store.query().sort"
          [loading]="loading()"
          (sortToggle)="store.toggleSort($event)"
          (sortReset)="store.resetSort()"
        />
      }

      <!-- Shown with the empty state too: a page past the end (a stale link) still shows the total and can page back. -->
      <mat-paginator
        aria-label="Select page"
        showFirstLastButtons
        [length]="store.totalCount()"
        [pageSize]="store.query().pageSize"
        [pageSizeOptions]="pageSizeOptions"
        (page)="store.setPage($event.pageIndex + 1, $event.pageSize)"
      />
    }
  `,
  styles: `
    .progress {
      height: 4px;
    }

    .message {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 16px;
    }
  `,
})
export class RequestsListComponent {
  protected readonly store = inject(RequestsStore);
  private readonly paginator = viewChild(MatPaginator);

  protected readonly pageSizeOptions = [...PAGE_SIZE_OPTIONS];
  protected readonly loading = computed(() => this.store.status() === 'loading');
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
