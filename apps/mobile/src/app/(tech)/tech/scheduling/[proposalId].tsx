import { ApiError, apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import {
  UNSAFE_WORDING_HINT,
  formatProposalApprovalLabel,
  formatProposalState,
} from "@/scheduling/scheduling-format";
import type { SchedulingProposal } from "@rsjt/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function TechSchedulingDetailScreen() {
  const { proposalId } = useLocalSearchParams<{ proposalId: string }>();
  const { session } = useAuth();
  const token = session?.token;
  const queryClient = useQueryClient();

  const [overrides, setOverrides] = useState<{
    preferredWindowText?: string;
    customerMessageBody?: string;
  }>({});

  const detailQuery = useQuery({
    enabled: Boolean(token && proposalId),
    queryKey: ["tech-scheduling-proposal", proposalId, token],
    queryFn: () =>
      apiClient.getSchedulingProposal(requireToken(token), proposalId),
  });

  const proposal = detailQuery.data?.proposal;
  const preferredWindowText =
    overrides.preferredWindowText ?? proposal?.preferredWindowText ?? "";
  const customerMessageBody =
    overrides.customerMessageBody ?? proposal?.customerMessageBody ?? "";

  const editMutation = useMutation({
    mutationFn: () =>
      apiClient.editSchedulingProposal(requireToken(token), proposalId, {
        preferredWindowText,
        customerMessageBody,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(
        ["tech-scheduling-proposal", proposalId, token],
        response,
      );
      setOverrides({});
      void queryClient.invalidateQueries({
        queryKey: ["tech-scheduling", token],
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      apiClient.approveSchedulingProposal(requireToken(token), proposalId),
    onSuccess: (response) => {
      queryClient.setQueryData(
        ["tech-scheduling-proposal", proposalId, token],
        response,
      );
      void queryClient.invalidateQueries({
        queryKey: ["tech-scheduling", token],
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      apiClient.rejectSchedulingProposal(requireToken(token), proposalId, {}),
    onSuccess: (response) => {
      queryClient.setQueryData(
        ["tech-scheduling-proposal", proposalId, token],
        response,
      );
      void queryClient.invalidateQueries({
        queryKey: ["tech-scheduling", token],
      });
    },
  });

  if (!proposalId) {
    return (
      <Screen>
        <Text selectable style={styles.body}>
          Missing proposal id.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.screen}>
      {detailQuery.isLoading ? (
        <Panel>
          <ActivityIndicator color="#111827" />
          <Text selectable style={styles.body}>
            Loading proposal...
          </Text>
        </Panel>
      ) : detailQuery.isError ? (
        <Panel>
          <Text selectable style={styles.title}>
            Unable to load proposal
          </Text>
          <Text selectable style={styles.body}>
            {getErrorMessage(detailQuery.error)}
          </Text>
          <ActionButton
            label="Retry"
            onPress={() => void detailQuery.refetch()}
            variant="secondary"
          />
        </Panel>
      ) : detailQuery.data ? (
        <ProposalBody
          customerMessageBody={customerMessageBody}
          editError={editMutation.error}
          isApproving={approveMutation.isPending}
          isEditing={editMutation.isPending}
          isRejecting={rejectMutation.isPending}
          onApprove={() => approveMutation.mutate()}
          onChangeCustomerMessageBody={(value) =>
            setOverrides((current) => ({
              ...current,
              customerMessageBody: value,
            }))
          }
          onChangePreferredWindowText={(value) =>
            setOverrides((current) => ({
              ...current,
              preferredWindowText: value,
            }))
          }
          onReject={() => rejectMutation.mutate()}
          onSaveEdits={() => editMutation.mutate()}
          preferredWindowText={preferredWindowText}
          proposal={detailQuery.data.proposal}
        />
      ) : null}
    </Screen>
  );
}

function ProposalBody({
  customerMessageBody,
  editError,
  isApproving,
  isEditing,
  isRejecting,
  onApprove,
  onChangeCustomerMessageBody,
  onChangePreferredWindowText,
  onReject,
  onSaveEdits,
  preferredWindowText,
  proposal,
}: {
  customerMessageBody: string;
  editError: unknown;
  isApproving: boolean;
  isEditing: boolean;
  isRejecting: boolean;
  onApprove: () => void;
  onChangeCustomerMessageBody: (value: string) => void;
  onChangePreferredWindowText: (value: string) => void;
  onReject: () => void;
  onSaveEdits: () => void;
  preferredWindowText: string;
  proposal: SchedulingProposal;
}) {
  const pending = proposal.state === "pending";
  const unsafeWording = isUnsafeWordingError(editError);

  return (
    <>
      <Panel>
        <Text selectable style={styles.title}>
          Scheduling proposal
        </Text>
        <Text selectable style={styles.body}>
          {formatProposalState(proposal.state)} ·{" "}
          {formatProposalApprovalLabel(proposal.state)}
        </Text>
      </Panel>

      <Panel>
        <Text selectable style={styles.panelTitle}>
          Preferred window
        </Text>
        <TextInput
          editable={pending && !isEditing}
          onChangeText={onChangePreferredWindowText}
          style={styles.input}
          value={preferredWindowText}
        />
      </Panel>

      <Panel>
        <Text selectable style={styles.panelTitle}>
          Customer message
        </Text>
        <TextInput
          editable={pending && !isEditing}
          multiline
          onChangeText={onChangeCustomerMessageBody}
          style={styles.multiline}
          textAlignVertical="top"
          value={customerMessageBody}
        />
        {unsafeWording ? (
          <Text selectable style={styles.errorText}>
            {UNSAFE_WORDING_HINT}
          </Text>
        ) : editError ? (
          <Text selectable style={styles.errorText}>
            {getErrorMessage(editError)}
          </Text>
        ) : null}
        {pending ? (
          <ActionButton
            label="Save edits"
            loading={isEditing}
            onPress={onSaveEdits}
            variant="secondary"
          />
        ) : null}
      </Panel>

      <Panel>
        <Text selectable style={styles.panelTitle}>
          RepairShopr appointment proposal
        </Text>
        <Text selectable style={styles.body}>
          Status: {proposal.repairShoprAppointmentPayload.status}
        </Text>
        {proposal.repairShoprAppointmentPayload.notes ? (
          <Text selectable style={styles.body}>
            Notes: {proposal.repairShoprAppointmentPayload.notes}
          </Text>
        ) : null}
      </Panel>

      <Panel>
        <Text selectable style={styles.panelTitle}>
          Source evidence
        </Text>
        {proposal.sourceEvidence.map((evidence) => (
          <Text key={evidence.messageId} selectable style={styles.evidence}>
            &ldquo;{evidence.quote}&rdquo;
          </Text>
        ))}
      </Panel>

      {pending ? (
        <View style={styles.actions}>
          <ActionButton
            disabled={isApproving || isRejecting}
            label="Approve"
            loading={isApproving}
            onPress={onApprove}
          />
          <ActionButton
            disabled={isApproving || isRejecting}
            label="Reject"
            loading={isRejecting}
            onPress={onReject}
            variant="secondary"
          />
        </View>
      ) : null}
    </>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function isUnsafeWordingError(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    typeof error.message === "string" &&
    error.message.toLowerCase().includes("confirm availability")
  );
}

function requireToken(token: string | undefined) {
  if (!token) {
    throw new Error("Session required");
  }
  return token;
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  panel: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  title: { color: "#111827", fontSize: 22, fontWeight: "700" },
  panelTitle: { color: "#111827", fontSize: 16, fontWeight: "700" },
  body: { color: "#4B5563", fontSize: 14, lineHeight: 20 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    color: "#111827",
    backgroundColor: "#F8FAFC",
    fontSize: 15,
  },
  multiline: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    color: "#111827",
    backgroundColor: "#F8FAFC",
    fontSize: 15,
    lineHeight: 22,
  },
  evidence: { color: "#4B5563", fontSize: 13, fontStyle: "italic" },
  errorText: { color: "#B42318", fontSize: 14, lineHeight: 20 },
  actions: { gap: 8 },
});
