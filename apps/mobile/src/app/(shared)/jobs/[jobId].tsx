import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import {
  formatApprovalKindLabel,
  formatApprovalRiskLabel,
  formatConfidenceBandLabel,
  formatJobChargeLabel,
  formatJobStateLabel,
  formatPendingApprovalLabel,
} from "@/dashboard/dashboard-format";
import type { ManagerJobDetailResponse } from "@rsjt/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { session } = useAuth();
  const role = session?.user.role;
  const token = session?.token;

  const detailQuery = useQuery({
    enabled: Boolean(token && jobId && role === "manager"),
    queryKey: ["manager-job-detail", jobId, token],
    queryFn: () => apiClient.getManagerJobDetail(requireToken(token), jobId),
  });

  if (!jobId) {
    return (
      <Screen>
        <PanelText label="Job" value="Missing job id" />
      </Screen>
    );
  }

  if (role !== "manager") {
    return (
      <Screen>
        <PanelText label="Job" value={jobId} />
        <Text selectable style={styles.body}>
          Detailed job view is currently available for managers only.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.screen}>
      {detailQuery.isLoading ? (
        <View style={styles.panel}>
          <ActivityIndicator color="#111827" />
          <Text selectable style={styles.body}>
            Loading job details...
          </Text>
        </View>
      ) : detailQuery.isError ? (
        <View style={styles.panel}>
          <Text selectable style={styles.label}>
            Unable to load job
          </Text>
          <Text selectable style={styles.body}>
            {getErrorMessage(detailQuery.error)}
          </Text>
          <ActionButton
            label="Retry"
            onPress={() => void detailQuery.refetch()}
            variant="secondary"
          />
        </View>
      ) : detailQuery.data ? (
        <JobDetailBody detail={detailQuery.data} />
      ) : null}
    </Screen>
  );
}

function JobDetailBody({ detail }: { detail: ManagerJobDetailResponse }) {
  const { job, pendingApprovals, selectedMatch } = detail;

  return (
    <>
      <View style={styles.panel}>
        <Text selectable style={styles.label}>
          Job
        </Text>
        <Text selectable style={styles.value}>
          {job.customerLabel ?? "Unlabeled job"}
        </Text>
      </View>
      <View style={styles.panel}>
        <Row label="State" value={formatJobStateLabel(job.state)} />
        <Row
          label="RepairShopr link"
          value={
            job.repairShoprReference
              ? `${job.repairShoprReference.entityType} ${job.repairShoprReference.repairShoprId}`
              : "Not linked"
          }
        />
        <Row
          label="Pending approvals"
          value={formatPendingApprovalLabel(job.pendingApprovalCount)}
        />
        <Row
          label="Match confidence"
          value={
            selectedMatch
              ? formatConfidenceBandLabel(selectedMatch.confidenceBand)
              : job.selectedMatchConfidenceBand
                ? formatConfidenceBandLabel(job.selectedMatchConfidenceBand)
                : "Not matched"
          }
        />
        <Row label="Charge / Profit" value={formatJobChargeLabel(job)} />
        <Link href={`/manager/money/${job.id}`} style={styles.moneyLink}>
          Review money
        </Link>
      </View>
      {pendingApprovals.length > 0 ? (
        <View style={styles.panel}>
          <Text selectable style={styles.label}>
            Pending approvals
          </Text>
          {pendingApprovals.map((approval) => (
            <View key={approval.id} style={styles.approvalRow}>
              <Text selectable style={styles.approvalKind}>
                {formatApprovalKindLabel(approval.kind)}
              </Text>
              <Text selectable style={styles.body}>
                {formatApprovalRiskLabel(approval.risk)} -{" "}
                {approval.requiredRole}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.panel}>
        <Text selectable style={styles.label}>
          Chat
        </Text>
        {job.conversationId ? (
          <>
            <Text selectable style={styles.body}>
              Read the full conversation behind this job, or take over the chat.
            </Text>
            <Link
              href={`/tech/conversations/${job.conversationId}`}
              style={styles.chatLink}
            >
              Open chat
            </Link>
          </>
        ) : (
          <Text selectable style={styles.body}>
            This job is not linked to a conversation yet.
          </Text>
        )}
      </View>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text selectable style={styles.rowLabel}>
        {label}
      </Text>
      <Text selectable style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

function PanelText({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.panel}>
      <Text selectable style={styles.label}>
        {label}
      </Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function requireToken(token: string | undefined) {
  if (!token) {
    throw new Error("Session required");
  }
  return token;
}

const styles = StyleSheet.create({
  screen: {
    gap: 14,
  },
  panel: {
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 18,
    backgroundColor: "#FFFFFF",
  },
  label: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  value: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "700",
  },
  body: {
    color: "#4B5563",
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLabel: {
    color: "#4B5563",
    fontSize: 14,
  },
  rowValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  approvalRow: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  approvalKind: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  moneyLink: {
    minHeight: 40,
    paddingTop: 10,
    color: "#047857",
    fontSize: 14,
    fontWeight: "700",
  },
  chatLink: {
    minHeight: 40,
    paddingTop: 10,
    color: "#047857",
    fontSize: 14,
    fontWeight: "700",
  },
});
