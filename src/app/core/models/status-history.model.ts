import { RequestStatus } from './request.model';

// Mirrors the backend DTO: one audit row per status change.
export interface StatusHistoryDto {
  id: number;
  requestId: number;
  previousStatus: RequestStatus;
  newStatus: RequestStatus;
  changedAt: string;
  changedBy: string;
}
