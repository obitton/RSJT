import { apiClient } from "@/api/client";
import { requireToken } from "@/api/request-helpers";
import { useQuery } from "@tanstack/react-query";

export function useJobMoney(token: string | undefined, jobId: string) {
  return useQuery({
    enabled: Boolean(token && jobId),
    queryKey: ["job-money", jobId, token],
    queryFn: () => apiClient.getJobMoney(requireToken(token), jobId),
  });
}
