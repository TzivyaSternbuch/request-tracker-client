export type RequestStatus = 'New' | 'InProgress' | 'Waiting' | 'Completed';
export const REQUEST_STATUSES: readonly RequestStatus[] = [
  'New',
  'InProgress',
  'Waiting',
  'Completed',
];

export type RequestPriority = 'Low' | 'Medium' | 'High';
export const REQUEST_PRIORITIES: readonly RequestPriority[] = ['Low', 'Medium', 'High'];

// Mirrors the backend DTO. `version` is an opaque base64 string, never shown or interpreted.
export interface RequestDto {
  id: number;
  title: string;
  organizationName: string;
  status: RequestStatus;
  priority: RequestPriority;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  version: string;
}
