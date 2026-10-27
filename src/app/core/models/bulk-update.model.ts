import { RequestStatus } from './request.model';

/** The most requests one bulk update accepts; the same limit as the server's, and as the largest page size. */
export const MAX_BULK_ITEMS = 100;

export type BulkFailureReason = 'NotFound' | 'Conflict' | 'InvalidTransition';

export interface BulkUpdateStatusRequest {
  items: { id: number; version: string }[];
  status: RequestStatus;
  changedBy: string;
}

export interface BulkUpdateStatusResult {
  succeeded: number[];
  failed: { id: number; reason: BulkFailureReason }[];
}
