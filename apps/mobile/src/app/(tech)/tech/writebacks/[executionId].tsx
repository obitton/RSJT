import { ApiError, apiClient } from "@/api/client";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function TechWritebackDetailScreen() {
  const { executionId } = useLocalSearchParams<{ executionId: string }>();
  const { session } = useAuth();
  const token = session?.token;
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    enabled: Boolean(token && executionId),
    queryKey: ["tech-writebacks", token],
    queryFn: () => apiClient.listWritebackExecutions(requireToken(token)),
  });

  const execution =
    listQuery.data?.executions.find((item) => item.id === executionId) ?? null;

  const executeMutation = useMutation({
    mutationFn: () =>
      apiClient.executeApprovedWriteback(
        requireToken(token),
        requireExecution(execution).approvalId,
      ),
    onSuccess: (response) => {
      updateWritebackCache(queryClient, token, response.execution);
    },
  });

  const retryMutation = useMutation({
    mutationFn: () =>
      apiClient.retryWritebackExecution(
        requireToken(token),
        requireExecution(execution).id,
      ),
    onSuccess: (response) => {
      updateWritebackCache(queryClient, token, response.execution);
    },
  });

  if (!executionId) {
    return (
      <Screen>
        <Text selectable style={styles.body}>
          Missing writeback id.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.screen}>
      {listQuery.isLoading ? (
        <Panel>
          <ActivityIndicator color="#111827" />
          <Text selectable style={styles.body}>
            Loading writeback...
          </Text>
        </Panel>
      ) : listQuery.isError ? (
        <Panel>
          <Text selectable style={styles.title}>
            Unable to load writeback
          </Text>
          <Text selectable style={styles.body}>
            {getErrorMessage(listQuery.error)}
          </Text>
          <ActionButton
            label="Retry"
            onPress={() => void listQuery.refetch()}
            variant="secondary"
          />
        </Panel>
      ) : execution ? (
        <WritebackBody
          error={executeMutation.error ?? retryMutation.error}
          execution={execution}
          isExecuting={executeMutation.isPending}
          isRetrying={retryMutation.isPending}
          onExecute={() => executeMutation.mutate()}
          onRetry={() => retryMutation.mutate()}
        />
      ) : (
        <Panel>
          <Text selectable style={styles.title}>
            Writeback not found
          </Text>
          <Text selectable style={styles.body}>
            This execution is no longer in the current writeback list.
          </Text>
        </Panel>
      )}
    </Screen>
  );
}

function WritebackBody({
  error,
  execution,
  isExecuting,
  isRetrying,
  onExecute,
  onRetry,
}: {
  error: unknown;
  execution: WritebackExecution;
  isExecuting: boolean;
  isRetrying: boolean;
  onExecute: () => void;
  onRetry: () => void;
}) {
  const issue = formatWritebackIssue(execution);

  return (
    <>
      <Panel>
        <Text selectable style={styles.title}>
          {formatWritebackAction(execution.action)}
        </Text>
        <Text selectable style={styles.body}>
          {formatWritebackState(execution.state)} ·{" "}
          {formatWritebackTarget(execution)}
        </Text>
        <Text selectable style={styles.body}>
          {formatAttemptSummary(execution)}
        </Text>
      </Panel>

      <Panel>
        <Text selectable style={styles.panelTitle}>
          Request
        </Text>
        <Text selectable style={styles.codeText}>
          {JSON.stringify(execution.requestPayload, null, 2)}
        </Text>
      </Panel>

      {execution.responsePayload ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Response
          </Text>
          <Text selectable style={styles.codeText}>
            {JSON.stringify(execution.responsePayload, null, 2)}
          </Text>
        </Panel>
      ) : null}

      {issue || error ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Attention
          </Text>
          <Text selectable style={styles.errorText}>
            {issue ?? getErrorMessage(error)}
          </Text>
          {isDisabledError(issue) ? (
            <Text selectable style={styles.body}>
              Live external writes stay disabled until a specific test record is
              approved.
            </Text>
          ) : null}
        </Panel>
      ) : null}

      {execution.state === "ready" ? (
        <ActionButton
          label="Execute"
          loading={isExecuting}
          onPress={onExecute}
        />
      ) : null}
      {execution.state === "failed" || execution.state === "blocked" ? (
        <ActionButton
          label="Retry"
          loading={isRetrying}
          onPress={onRetry}
          variant="secondary"
        />
      ) : null}
    </>
  );
}

function updateWritebackCache(
  queryClient: ReturnType<typeof useQueryClient>,
  token: string | undefined,
  execution: WritebackExecution,
) {
  queryClient.setQueryData<{ executions: WritebackExecution[] }>(
    ["tech-writebacks", token],
    (current) => {
      const executions = current?.executions ?? [];
      const index = executions.findIndex((item) => item.id === execution.id);
      if (index === -1) {
        return { executions: [execution, ...executions] };
      }
      return {
        executions: executions.map((item) =>
          item.id === execution.id ? execution : item,
        ),
      };
    },
  );
}

function requireExecution(execution: WritebackExecution | null) {
  if (!execution) {
    throw new Error("Writeback required");
  }
  return execution;
}

function isDisabledError(message: string | null) {
  return Boolean(message?.toLowerCase().includes("disabled"));
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Request failed";
}

function requireToken(token: string | undefined) {
  if (!token) {
    throw new Error("Session required");
  }
  return token;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
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
  codeText: {
    color: "#111827",
    fontFamily: "Courier",
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: { color: "#B42318", fontSize: 14, lineHeight: 20 },
});
