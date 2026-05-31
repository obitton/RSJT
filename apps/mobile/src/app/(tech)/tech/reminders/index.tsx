import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import {
  canResolveReminderQuickly,
  formatReminderActionLabel,
  formatReminderReason,
  formatReminderState,
} from "@/reminders/reminder-format";
import type { ReminderSummary } from "@rsjt/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function TechRemindersScreen() {
  const { session } = useAuth();
  const token = session?.token;
  const queryClient = useQueryClient();

  const remindersQuery = useQuery({
    enabled: Boolean(token),
    queryKey: ["reminders", token],
    queryFn: () => apiClient.listReminders(requireToken(token)),
  });

  const generateMutation = useMutation({
    mutationFn: () => apiClient.generateReminders(requireToken(token)),
    onSuccess: (response) => {
      queryClient.setQueryData(["reminders", token], {
        reminders: response.reminders,
      });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (reminderId: string) =>
      apiClient.resolveReminder(requireToken(token), reminderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });

  const reminders =
    generateMutation.data?.reminders ?? remindersQuery.data?.reminders ?? [];

  return (
    <Screen contentStyle={styles.screen}>
      <Panel>
        <Text selectable style={styles.eyebrow}>
          Closeout reminders
        </Text>
        <Text selectable style={styles.title}>
          Tech inbox
        </Text>
        <Text selectable style={styles.body}>
          {reminders.length} open
        </Text>
      </Panel>

      <ActionButton
        label="Refresh reminders"
        loading={generateMutation.isPending}
        onPress={() => generateMutation.mutate()}
        variant="secondary"
      />

      {remindersQuery.isLoading ? (
        <Panel>
          <ActivityIndicator color="#111827" />
          <Text selectable style={styles.body}>
            Loading reminders...
          </Text>
        </Panel>
      ) : remindersQuery.isError ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Unable to load reminders
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
      ) : reminders.length === 0 ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            No closeout reminders.
          </Text>
          <Text selectable style={styles.body}>
            Accepted, scheduled, and completed jobs are clear.
          </Text>
        </Panel>
      ) : (
        <View style={styles.list}>
          {reminders.map((reminder) => (
            <ReminderRow
              isResolving={resolveMutation.isPending}
              key={reminder.id}
              reminder={reminder}
              onResolve={resolveMutation.mutate}
            />
          ))}
        </View>
      )}

      {generateMutation.error ? (
        <Text selectable style={styles.errorText}>
          {getErrorMessage(generateMutation.error)}
        </Text>
      ) : resolveMutation.error ? (
        <Text selectable style={styles.errorText}>
          {getErrorMessage(resolveMutation.error)}
        </Text>
      ) : null}
    </Screen>
  );
}

function ReminderRow({
  isResolving,
  reminder,
  onResolve,
}: {
  isResolving: boolean;
  reminder: ReminderSummary;
  onResolve: (reminderId: string) => void;
}) {
  return (
    <Panel>
      <Text selectable style={styles.panelTitle}>
        {reminder.customerLabel ?? "Unlabeled job"}
      </Text>
      <Text selectable style={styles.body}>
        {formatReminderReason(reminder.reason)}
      </Text>
      <Text selectable style={styles.caption}>
        {formatReminderState(reminder.jobState)}
        {reminder.stale ? " | Stale" : ""}
      </Text>
      {canResolveReminderQuickly(reminder.reason) ? (
        <ActionButton
          disabled={isResolving}
          label={formatReminderActionLabel(reminder.reason)}
          onPress={() => onResolve(reminder.id)}
          variant="secondary"
        />
      ) : (
        <Link
          href={{
            pathname: "/tech/money/[jobId]",
            params: { jobId: reminder.jobId },
          }}
          style={styles.linkButton}
        >
          {formatReminderActionLabel(reminder.reason)}
        </Link>
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
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    lineHeight: 20,
  },
});
