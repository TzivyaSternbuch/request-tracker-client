import { RequestPriority, RequestStatus } from '../core/models/request.model';

const LABELS: Partial<Record<RequestStatus | RequestPriority, string>> = {
  InProgress: 'In progress',
};

/** The text shown for a status or priority value; the value itself unless it needs spaces. */
export function valueLabel(value: RequestStatus | RequestPriority): string {
  return LABELS[value] ?? value;
}
