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
    // The padding keeps the title on the card's left edge at every width (the card is centered at its max width).
    .app-toolbar {
      border-bottom: 1px solid var(--app-card-border);
      padding-inline: max(24px, calc((100% - var(--app-content-max-width)) / 2 + 24px));
    }

    h1 {
      margin: 0;
      font-size: 18px;
      line-height: 24px;
      font-weight: 600;
    }

    main {
      padding: 16px 24px 24px;
    }

    @media (max-width: 600px) {
      .app-toolbar {
        padding-inline: 16px;
      }

      main {
        padding: 12px 16px 16px;
      }
    }
  `,
})
export class AppComponent {}
