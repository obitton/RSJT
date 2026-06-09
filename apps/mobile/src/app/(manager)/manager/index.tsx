import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import { formatContactCardState } from "@/contact-cards/contact-card-format";
import { isTakeoverStale } from "@/conversations/conversation-format";
import {
  DASHBOARD_GROUP_ORDER,
  type DashboardGroupKey,
  formatConfidenceBandLabel,
  formatGroupEmptyCopy,
  formatGroupLabel,
  formatJobChargeLabel,
  formatJobStateLabel,
  formatPendingApprovalLabel,
} from "@/dashboard/dashboard-format";
import type {
  LeadSummary,
  ManagerDashboardJob,
  ManagerDashboardResponse,
  TakeoverConversationSummary,
} from "@rsjt/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function ManagerHomeScreen() {
  const { session, signOut } = useAuth();
  const token = session?.token;
  const [selectedGroup, setSelectedGroup] =
    useState<DashboardGroupKey>("openJobs");

  const dashboardQuery = useQuery({
    enabled: Boolean(token),
    queryKey: ["manager-dashboard", token],
    queryFn: () => apiClient.getManagerDashboard(requireToken(token)),
  });

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Text selectable style={styles.eyebrow}>
          Signed in as Manager
        </Text>
        <Text selectable style={styles.title}>
          Manager
        </Text>
        <Text selectable style={styles.body}>
          {session?.user.displayName ?? "Manager"}
        </Text>
      </View>

      {dashboardQuery.isLoading ? (
        <Panel>
          <ActivityIndicator color="#111827" />
          <Text selectable style={styles.body}>
            Loading dashboard...
          </Text>
        </Panel>
      ) : dashboardQuery.isError ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Unable to load dashboard.
          </Text>
          <Text selectable style={styles.body}>
            {getErrorMessage(dashboardQuery.error)}
          </Text>
          <ActionButton
            label="Retry"
            onPress={() => void dashboardQuery.refetch()}
            variant="secondary"
          />
        </Panel>
      ) : dashboardQuery.data ? (
        <DashboardBody
          data={dashboardQuery.data}
          selectedGroup={selectedGroup}
          onSelectGroup={setSelectedGroup}
        />
      ) : null}

      <Link href="/manager/reminders/stale" style={styles.contactCardLink}>
        Review stale reminders
      </Link>

      <ActionButton
        label="Sign out"
        onPress={() => void signOut()}
        variant="secondary"
      />
    </Screen>
  );
}

function DashboardBody({
  data,
  selectedGroup,
  onSelectGroup,
}: {
  data: ManagerDashboardResponse;
  selectedGroup: DashboardGroupKey;
  onSelectGroup: (group: DashboardGroupKey) => void;
}) {
  const groupJobs = data.groups[selectedGroup];

  return (
    <>
      <SummaryStrip data={data} />
      <SegmentedGroup
        selected={selectedGroup}
        takeoverCount={data.summary.takeoverCount}
        onSelect={onSelectGroup}
      />
      <Panel>
        <Text selectable style={styles.panelTitle}>
          {formatGroupLabel(selectedGroup)}
        </Text>
        {groupJobs.length === 0 ? (
          <Text selectable style={styles.body}>
            {formatGroupEmptyCopy(selectedGroup)}
          </Text>
        ) : (
          <View style={styles.jobList}>
            {groupJobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </View>
        )}
        <Text selectable style={styles.caption}>
          Unresolved items stay visible until matched or closed.
        </Text>
      </Panel>
      <LeadsPanel leads={data.leads} />
      <TakeoverPanel conversations={data.takeoverConversations} />
    </>
  );
}

function LeadsPanel({ leads }: { leads: LeadSummary[] }) {
  return (
    <Panel>
      <Text selectable style={styles.panelTitle}>
        Leads
      </Text>
      {leads.length === 0 ? (
        <Text selectable style={styles.body}>
          No leads yet.
        </Text>
      ) : (
        <View style={styles.jobList}>
          {leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              style={styles.jobRowLink}
            >
              <View style={styles.jobRow}>
                <View style={styles.jobText}>
                  <Text selectable style={styles.jobTitle}>
                    {lead.label}
                  </Text>
                  <Text selectable style={styles.jobMeta}>
                    {formatContactCardState(lead.intakeState)}
                    {lead.takeoverActive ? " · Working on" : ""}
                  </Text>
                  {lead.lastInboundPreview ? (
                    <Text selectable style={styles.jobMeta} numberOfLines={1}>
                      {lead.lastInboundPreview}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Link>
          ))}
        </View>
      )}
    </Panel>
  );
}

function SummaryStrip({ data }: { data: ManagerDashboardResponse }) {
  const summary = data.summary;
  return (
    <View style={styles.summaryStrip}>
      <SummaryCard
        label="Leads"
        value={summary.leadsCount}
        details={[
          {
            label: "Needs tech answer",
            value: `${summary.needsTechAnswerCount} / ${summary.leadsCount}`,
          },
          {
            label: "Working on",
            value: `${summary.workingOnCount} / ${summary.leadsCount}`,
          },
        ]}
      />
      <SummaryCard
        label="Jobs"
        value={summary.jobsCount}
        details={[
          {
            label: "Scheduled",
            value: `${summary.scheduledCount} / ${summary.jobsCount}`,
          },
          {
            label: "Repair",
            value: `${summary.repairCount} / ${summary.jobsCount}`,
          },
        ]}
      />
      <SummaryCard
        label="Payout"
        value={summary.payoutReadyCount}
        details={[]}
      />
    </View>
  );
}

function SummaryCard({
  label,
  value,
  details,
}: {
  label: string;
  value: number;
  details: { label: string; value: string }[];
}) {
  return (
    <View style={styles.summaryStat}>
      <Text selectable style={styles.summaryLabel}>
        {label}
      </Text>
      <Text selectable style={styles.summaryValue}>
        {value}
      </Text>
      {details.map((detail) => (
        <View key={detail.label} style={styles.summaryDetailRow}>
          <Text selectable style={styles.summaryDetailLabel}>
            {detail.label}
          </Text>
          <Text selectable style={styles.summaryDetailValue}>
            {detail.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SegmentedGroup({
  selected,
  takeoverCount,
  onSelect,
}: {
  selected: DashboardGroupKey;
  takeoverCount: number;
  onSelect: (group: DashboardGroupKey) => void;
}) {
  return (
    <View style={styles.segmentedControl}>
      {DASHBOARD_GROUP_ORDER.map((group) => (
        <SegmentButton
          active={selected === group}
          key={group}
          label={formatGroupLabel(group)}
          onPress={() => onSelect(group)}
        />
      ))}
      <SegmentButton
        active={false}
        disabled
        label={`Takeover ${takeoverCount}`}
      />
    </View>
  );
}

function SegmentButton({
  active,
  disabled,
  label,
  onPress,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.segmentButton,
        active && styles.activeSegmentButton,
        disabled && styles.disabledSegmentButton,
      ]}
    >
      <Text
        selectable={false}
        style={[styles.segmentLabel, active && styles.activeSegmentLabel]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function JobRow({ job }: { job: ManagerDashboardJob }) {
  return (
    <Link href={`/jobs/${job.id}`} style={styles.jobRowLink}>
      <View style={styles.jobRow}>
        <View style={styles.jobText}>
          <Text selectable style={styles.jobTitle}>
            {job.customerLabel ?? "Unlabeled job"}
          </Text>
          <Text selectable style={styles.jobMeta}>
            {formatJobStateLabel(job.state)}
          </Text>
          {job.selectedMatchConfidenceBand ? (
            <Text selectable style={styles.jobMeta}>
              {`Match: ${formatConfidenceBandLabel(
                job.selectedMatchConfidenceBand,
              )}`}
            </Text>
          ) : null}
        </View>
        <View style={styles.jobRight}>
          <Text selectable style={styles.jobCharge}>
            {formatJobChargeLabel(job)}
          </Text>
          <Text selectable style={styles.jobMeta}>
            {formatPendingApprovalLabel(job.pendingApprovalCount)}
          </Text>
        </View>
      </View>
    </Link>
  );
}

function TakeoverPanel({
  conversations,
}: {
  conversations: TakeoverConversationSummary[];
}) {
  return (
    <Panel>
      <Text selectable style={styles.panelTitle}>
        Active takeover
      </Text>
      {conversations.length === 0 ? (
        <Text selectable style={styles.body}>
          No takeover conversations.
        </Text>
      ) : (
        <View style={styles.takeoverList}>
          {conversations.map((conversation) => {
            const stale = isTakeoverStale(conversation.takeoverStartedAt);
            return (
              <View
                key={conversation.id}
                style={[styles.takeoverRow, stale && styles.takeoverRowStale]}
              >
                <Text selectable style={styles.takeoverPhone}>
                  {conversation.externalPhone ?? "Unknown sender"}
                </Text>
                <Text selectable style={styles.takeoverMeta}>
                  {stale ? "Stale takeover · " : ""}Active since{" "}
                  {(
                    conversation.takeoverStartedAt ?? conversation.updatedAt
                  ).toLocaleString()}
                </Text>
                <Link
                  href={`/tech/conversations/${conversation.id}`}
                  style={styles.contactCardLink}
                >
                  Open chat
                </Link>
                <Link
                  href={{
                    pathname: "/manager/contact-card/[conversationId]",
                    params: { conversationId: conversation.id },
                  }}
                  style={styles.contactCardLink}
                >
                  Contact card
                </Link>
              </View>
            );
          })}
        </View>
      )}
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
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
  header: {
    gap: 6,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    padding: 18,
    backgroundColor: "#FFFFFF",
  },
  eyebrow: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
  body: {
    color: "#4B5563",
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    color: "#6B7280",
    fontSize: 12,
    fontStyle: "italic",
  },
  summaryStrip: {
    flexDirection: "row",
    gap: 10,
  },
  summaryStat: {
    flex: 1,
    gap: 4,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#FFFFFF",
  },
  summaryLabel: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  summaryDetailRow: {
    gap: 2,
  },
  summaryDetailLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
  },
  summaryDetailValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  segmentedControl: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    backgroundColor: "#E9EEF5",
  },
  segmentButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  activeSegmentButton: {
    backgroundColor: "#FFFFFF",
  },
  disabledSegmentButton: {
    opacity: 0.6,
  },
  segmentLabel: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "700",
  },
  activeSegmentLabel: {
    color: "#111827",
  },
  panel: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  panelTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  jobList: {
    gap: 8,
  },
  jobRowLink: {
    color: "#111827",
    textDecorationLine: "none",
  },
  jobRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F9FAFB",
  },
  jobText: {
    flex: 1,
    gap: 4,
  },
  jobRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  jobTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  jobMeta: {
    color: "#4B5563",
    fontSize: 13,
  },
  jobCharge: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  takeoverList: {
    gap: 8,
  },
  takeoverRow: {
    gap: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#FEF3C7",
  },
  takeoverRowStale: {
    borderColor: "#B45309",
    backgroundColor: "#FFEDD5",
  },
  takeoverPhone: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  takeoverMeta: {
    color: "#4B5563",
    fontSize: 13,
  },
  contactCardLink: {
    minHeight: 32,
    paddingTop: 6,
    color: "#047857",
    fontSize: 13,
    fontWeight: "700",
  },
  primaryLink: {
    minHeight: 48,
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: "#FFFFFF",
    backgroundColor: "#111827",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
});
