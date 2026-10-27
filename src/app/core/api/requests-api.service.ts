import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedResult } from '../models/paged-result.model';
import { RequestQuery } from '../models/request-query.model';
import { RequestDto, UpdateStatusRequest } from '../models/request.model';

@Injectable({ providedIn: 'root' })
export class RequestsApiService {
  private readonly http = inject(HttpClient);

  getPaged(query: RequestQuery): Observable<PagedResult<RequestDto>> {
    return this.http.get<PagedResult<RequestDto>>('/api/requests', { params: toHttpParams(query) });
  }

  getById(id: number): Observable<RequestDto> {
    return this.http.get<RequestDto>(`/api/requests/${id}`);
  }

  updateStatus(id: number, body: UpdateStatusRequest): Observable<RequestDto> {
    return this.http.patch<RequestDto>(`/api/requests/${id}/status`, body);
  }

  getAssignees(): Observable<string[]> {
    return this.http.get<string[]>('/api/requests/assignees');
  }
}

// Empty values are left out so they don't reach the server as empty strings.
function toHttpParams(query: RequestQuery): HttpParams {
  let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);

  const texts: Record<string, string | null> = {
    organizationName: query.organizationName,
    search: query.search,
    createdFrom: query.createdFrom,
    createdTo: query.createdTo,
  };
  for (const [key, value] of Object.entries(texts)) {
    if (value) {
      params = params.set(key, value);
    }
  }

  const lists: Record<string, readonly string[]> = {
    status: query.status,
    priority: query.priority,
    assignedTo: query.assignedTo,
    sort: query.sort.map((level) => `${level.field}:${level.direction}`),
  };
  for (const [key, values] of Object.entries(lists)) {
    for (const value of values) {
      params = params.append(key, value);
    }
  }
  return params;
}
