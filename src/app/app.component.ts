import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatToolbarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar>
      <h1>Request Tracker</h1>
    </mat-toolbar>
    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    h1 {
      font: var(--mat-sys-title-large);
      margin: 0;
    }

    main {
      padding: 16px;
    }
  `,
})
export class AppComponent {}
