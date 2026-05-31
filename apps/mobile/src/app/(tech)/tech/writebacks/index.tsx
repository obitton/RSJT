import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import {
  formatAttemptSummary,
  formatWritebackAction,
  formatWritebackIssue,
  formatWritebackState,
  formatWritebackTarget,
} from "@/writebacks/writeback-format";
import type { WritebackExecution } from "@rsjt/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function TechWritebacksScreen() {
  const { session } = useAuth();
  const token = session?.token;

  const query = useQuery({
    enabled: Boolean(token),
    queryKey: ["tech-writebacks", token],
    queryFn: () => apiClient.listWritebackExecutions(requireToken(token)),
  });

  const executions = query.data?.executions ?? [];
  const ready = executions.filter((execution) => execution.state === "ready");
  const needsAttention = executions.filter(
    (execution) =>
      execution.state === "failed" || execution.state === "blocked",
  );
  const completed = executions.filter(
    (execution) => execution.state === "succeeded",
  );

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Text selectable style={styles.title}>
          Writebacks
        </Text>
        <Text selectable style={styles.body}>
          Execute approved RepairShopr and customer-message changes.
        </Text>
      </View>

      {query.isLoading ? (
        <Panel>
          <ActivityIndicator color="#111827" />
          <Text selectable style={styles.body}>
            Loading writebacks...
          </Text>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Unable to load writebacks.
          </Text>
          <Text selectable style={styles.body}>
            {getErrorMessage(query.error)}
          </Text>
          <ActionButton
            label="Retry"
            onPress={() => void query.refetch()}
            variant="secondary"
          />
        </Panel>
      ) : (
        <>
          <Section
            empty="No ready writebacks."
            executions={ready}
            title="Ready"
          />
          <Section
            empty="No writebacks need attention."
            executions={needsAttention}
            title="Needs attention"
          />
          <Section
            empty="No completed writebacks yet."
            executions={completed}
            title="Completed"
          />
        </>
      )}
    </Screen>
  );
}

function Section({
  empty,
  executions,
  title,
}: {
  empty: string;
  executions: WritebackExecution[];
  title: string;
}) {
  return (
    <Panel>
      <Text selectable style={styles.panelTitle}>
        {title}
      </Text>
      {executions.length === 0 ? (
        <Text selectable style={styles.body}>
          {empty}
        </Text>
      ) : (
        <View style={styles.list}>
          {executions.map((execution) => (
            <WritebackRow execution={execution} key={execution.id} />
          ))}
        </View>
      )}
    </Panel>
  );
}

function WritebackRow({ execution }: { execution: WritebackExecution }) {
  const issue = formatWritebackIssue(execution);

  return (
    <Link href={`/tech/writebacks/${execution.id}`} style={styles.rowLink}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text selectable style={styles.rowTitle}>
            {formatWritebackAction(execution.action)}
          </Text>
          <Text selectable style={styles.rowMeta}>
            {formatWritebackState(execution.state)} ·{" "}
            {formatWritebackTarget(execution)}
          </Text>
          <Text selectable style={styles.preview}>
            {issue ?? formatAttemptSummary(execution)}
          </Text>
        </View>
      </View>
    </Link>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
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
  screen: { gap: 14 },
  header: {
    gap: 6,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    padding: 18,
    backgroundColor: "#FFFFFF",
  },
  title: { color: "#111827", fontSize: 22, fontWeight: "700" },
  body: { color: "#4B5563", fontSize: 14, lineHeight: 20 },
  panel: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  panelTitle: { color: "#111827", fontSize: 16, fontWeight: "700" },
  list: { gap: 8 },
  rowLink: { textDecorationLine: "none" },
  row: {
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
  rowText: { flex: 1, gap: 4 },
  rowTitle: { color: "#111827", fontSize: 15, fontWeight: "700" },
  rowMeta: { color: "#4B5563", fontSize: 13 },
  preview: { color: "#4B5563", fontSize: 12 },
});
