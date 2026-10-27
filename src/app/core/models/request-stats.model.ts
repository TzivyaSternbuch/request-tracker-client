import { RequestStatus } from './request.model';

// Mirrors RequestStatsDto. The status keys are the enum names, every status present (zeros included).
export interface RequestStats {
  asOf: string;
  countByStatus: Record<RequestStatus, number>;
  openRequestAge: OpenRequestAge;
  topAssignees: AssigneeWorkload[];
}

export interface OpenRequestAge {
  underSevenDays: number;
  sevenToUnderThirtyDays: number;
  thirtyDaysOrMore: number;
}

export interface AssigneeWorkload {
  assignedTo: string;
  openCount: number;
}
