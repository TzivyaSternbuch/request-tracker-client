import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'requests' },
  {
    path: 'requests',
    loadComponent: () =>
      import('./features/requests/requests-list/requests-list.component').then(
        (m) => m.RequestsListComponent,
      ),
  },
  { path: '**', redirectTo: 'requests' },
];
