import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'requests' },
  {
    path: 'requests',
    loadComponent: () =>
      import('./features/requests/requests-list/requests-list.component').then(
        (m) => m.RequestsListComponent,
      ),
    children: [
      {
        path: ':id',
        loadComponent: () =>
          import('./features/requests/request-details/request-details-route.component').then(
            (m) => m.RequestDetailsRouteComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'requests' },
];
