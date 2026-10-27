import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ActingAsService {
  private readonly nameSignal = signal('');

  readonly name = this.nameSignal.asReadonly();

  setName(text: string): void {
    this.nameSignal.set(text);
  }
}
