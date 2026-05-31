import type {
  ManagerDashboardResponse,
  ManagerJobDetailResponse,
} from "@rsjt/shared";

export interface ManagerDashboardStore {
  getDashboard(): Promise<ManagerDashboardResponse>;
  getJobDetail(jobId: string): Promise<ManagerJobDetailResponse | null>;
}

export interface ManagerDashboardServiceApi {
  getDashboard(): Promise<ManagerDashboardResponse>;
  getJobDetail(jobId: string): Promise<ManagerJobDetailResponse | null>;
}

export class ManagerDashboardService implements ManagerDashboardServiceApi {
  constructor(private readonly store: ManagerDashboardStore) {}

  async getDashboard() {
    return this.store.getDashboard();
  }

  async getJobDetail(jobId: string) {
    return this.store.getJobDetail(jobId);
  }
}
