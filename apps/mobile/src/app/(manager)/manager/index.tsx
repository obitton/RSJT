import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import { formatContactCardState } from "@/contact-cards/contact-card-format";
import {
  DASHBOARD_SECTION_ORDER,
  type DashboardSectionKey,
  formatConfidenceBandLabel,
  formatJobChargeLabel,
  formatJobStateLabel,
  formatPendingApprovalLabel,
  formatSectionEmptyCopy,
  formatSectionLabel,
} from "@/dashboard/dashboard-format";
import type {
  LeadSummary,
  ManagerDashboardJob,
  ManagerDashboardResponse,
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
  const [selectedSection, setSelectedSection] =
    useState<DashboardSectionKey>("leads");

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
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
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
  selectedSection,
  onSelectSection,
}: {
  data: ManagerDashboardResponse;
  selectedSection: DashboardSectionKey;
  onSelectSection: (section: DashboardSectionKey) => void;
}) {
  return (
    <>
      <SummaryStrip data={data} />
      <SectionTabs selected={selectedSection} onSelect={onSelectSection} />
      <Panel>
        <Text selectable style={styles.panelTitle}>
          {formatSectionLabel(selectedSection)}
        </Text>
        {selectedSection === "leads" ? (
          <LeadList leads={data.leads} />
        ) : (
          <JobSectionList
            jobs={data.groups[selectedSection]}
            emptyCopy={formatSectionEmptyCopy(selectedSection)}
          />
        )}
      </Panel>
    </>
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

function SectionTabs({
  selected,
  onSelect,
}: {
  selected: DashboardSectionKey;
  onSelect: (section: DashboardSectionKey) => void;
}) {
  return (
    <View style={styles.segmentedControl}>
      {DASHBOARD_SECTION_ORDER.map((section) => (
        <SegmentButton
          active={selected === section}
          key={section}
          label={formatSectionLabel(section)}
          onPress={() => onSelect(section)}
        />
      ))}
    </View>
  );
}

function SegmentButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.segmentButton, active && styles.activeSegmentButton]}
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

function LeadList({ leads }: { leads: LeadSummary[] }) {
  if (leads.length === 0) {
    return (
      <Text selectable style={styles.body}>
        {formatSectionEmptyCopy("leads")}
      </Text>
    );
  }

  return (
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
  );
}

function JobSectionList({
  jobs,
  emptyCopy,
}: {
  jobs: ManagerDashboardJob[];
  emptyCopy: string;
}) {
  if (jobs.length === 0) {
    return (
      <Text selectable style={styles.body}>
        {emptyCopy}
      </Text>
    );
  }

  return (
    <View style={styles.jobList}>
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </View>
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
  contactCardLink: {
    minHeight: 32,
    paddingTop: 6,
    color: "#047857",
    fontSize: 13,
    fontWeight: "700",
  },
});
