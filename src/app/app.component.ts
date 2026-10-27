import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';
import { ActingAsService } from './core/acting-as.service';
import { initials } from './shared/initials';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatToolbarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar class="app-toolbar">
      <h1>Request Tracker</h1>
      <span class="spacer"></span>
      <label class="acting-as">
        @if (initials(actingAs.name()); as letters) {
          <span class="avatar" aria-hidden="true">{{ letters }}</span>
        }
        <input
          type="text"
          maxlength="100"
          placeholder="Acting as…"
          aria-label="Acting as"
          [value]="actingAs.name()"
          (input)="onNameInput($event)"
        />
      </label>
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

    .spacer {
      flex: 1;
    }

    .acting-as {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .acting-as input {
      width: 180px;
      padding: 6px 10px;
      font: inherit;
      font-size: 14px;
      border: 1px solid var(--app-card-border);
      border-radius: 6px;
    }

    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 600;
      background: var(--app-tone-gray-background);
      color: var(--app-tone-gray-text);
    }

    main {
      padding: 16px 24px 24px;
    }

    @media (max-width: 600px) {
      .app-toolbar {
        padding-inline: 16px;
      }

      .acting-as input {
        width: 120px;
      }

      main {
        padding: 12px 16px 16px;
      }
    }
  `,
})
export class AppComponent {
  protected readonly actingAs = inject(ActingAsService);
  protected readonly initials = initials;

  protected onNameInput(event: Event): void {
    this.actingAs.setName((event.target as HTMLInputElement).value);
  }
}
