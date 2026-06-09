import type {
  ManagerDashboardResponse,
  ManagerJobDetailResponse,
  ManagerLeadDetailResponse,
} from "@rsjt/shared";

export interface ManagerDashboardStore {
  getDashboard(): Promise<ManagerDashboardResponse>;
  getJobDetail(jobId: string): Promise<ManagerJobDetailResponse | null>;
  getLeadDetail(
    conversationId: string,
  ): Promise<ManagerLeadDetailResponse | null>;
}

export interface ManagerDashboardServiceApi {
  getDashboard(): Promise<ManagerDashboardResponse>;
  getJobDetail(jobId: string): Promise<ManagerJobDetailResponse | null>;
  getLeadDetail(
    conversationId: string,
  ): Promise<ManagerLeadDetailResponse | null>;
}

export class ManagerDashboardService implements ManagerDashboardServiceApi {
  constructor(private readonly store: ManagerDashboardStore) {}

  async getDashboard() {
    return this.store.getDashboard();
  }

  async getJobDetail(jobId: string) {
    return this.store.getJobDetail(jobId);
  }

  async getLeadDetail(conversationId: string) {
    return this.store.getLeadDetail(conversationId);
  }
}
