import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatToolbarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar class="app-toolbar">
      <h1>Request Tracker</h1>
    </mat-toolbar>
    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    // Toolbar tokens have no border, so the thin line under the white bar sits on our own class.
    .app-toolbar {
      border-bottom: 1px solid var(--app-card-border);
    }

    h1 {
      font: var(--mat-sys-title-large);
      margin: 0;
    }

    main {
      padding: 24px 16px;
    }
  `,
})
export class AppComponent {}
