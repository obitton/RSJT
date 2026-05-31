import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import {
  formatReminderReason,
  formatReminderState,
} from "@/reminders/reminder-format";
import type { ReminderSummary } from "@rsjt/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function ManagerStaleRemindersScreen() {
  const { session } = useAuth();
  const token = session?.token;

  const remindersQuery = useQuery({
    enabled: Boolean(token),
    queryKey: ["manager-stale-reminders", token],
    queryFn: () => apiClient.listStaleReminders(requireToken(token)),
  });

  return (
    <Screen contentStyle={styles.screen}>
      <Panel>
        <Text selectable style={styles.eyebrow}>
          Closeout reminders
        </Text>
        <Text selectable style={styles.title}>
          Stale reminders
        </Text>
        <Text selectable style={styles.body}>
          {remindersQuery.data?.reminders.length ?? 0} stale
        </Text>
      </Panel>

      {remindersQuery.isLoading ? (
        <Panel>
          <ActivityIndicator color="#111827" />
          <Text selectable style={styles.body}>
            Loading stale reminders...
          </Text>
        </Panel>
      ) : remindersQuery.isError ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Unable to load stale reminders
          </Text>
          <Text selectable style={styles.body}>
            {getErrorMessage(remindersQuery.error)}
          </Text>
          <ActionButton
            label="Retry"
            onPress={() => void remindersQuery.refetch()}
            variant="secondary"
          />
        </Panel>
      ) : remindersQuery.data && remindersQuery.data.reminders.length > 0 ? (
        <View style={styles.list}>
          {remindersQuery.data.reminders.map((reminder) => (
            <ReminderRow key={reminder.id} reminder={reminder} />
          ))}
        </View>
      ) : (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            No stale reminders.
          </Text>
          <Text selectable style={styles.body}>
            Open reminders are still inside the normal review window.
          </Text>
        </Panel>
      )}
    </Screen>
  );
}

function ReminderRow({ reminder }: { reminder: ReminderSummary }) {
  return (
    <Panel>
      <Text selectable style={styles.panelTitle}>
        {reminder.customerLabel ?? "Unlabeled job"}
      </Text>
      <Text selectable style={styles.body}>
        {formatReminderReason(reminder.reason)}
      </Text>
      <Text selectable style={styles.caption}>
        {formatReminderState(reminder.jobState)} | Open since{" "}
        {reminder.createdAt.toLocaleString()}
      </Text>
      <Link
        href={{
          pathname: "/manager/money/[jobId]",
          params: { jobId: reminder.jobId },
        }}
        style={styles.linkButton}
      >
        Open money review
      </Link>
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
  panel: {
    gap: 10,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    padding: 16,
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
    fontSize: 26,
    fontWeight: "700",
  },
  panelTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "700",
  },
  body: {
    color: "#374151",
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    gap: 12,
  },
  linkButton: {
    minHeight: 44,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    backgroundColor: "#FFFFFF",
  },
});
