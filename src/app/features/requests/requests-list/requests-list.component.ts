import { ChangeDetectionStrategy, Component } from '@angular/core';

// Placeholder route target; task 09 builds the list here.
@Component({
  selector: 'app-requests-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2>Requests</h2>`,
})
export class RequestsListComponent {}
