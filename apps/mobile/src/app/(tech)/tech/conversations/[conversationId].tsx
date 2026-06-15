import { ApiError, apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import {
  formatMessageSender,
  formatOutboundStatus,
} from "@/conversations/conversation-format";
import type { ConversationDetail } from "@rsjt/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function TechConversationDetailScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { session } = useAuth();
  const token = session?.token;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const detailQuery = useQuery({
    enabled: Boolean(token && conversationId),
    queryKey: ["tech-conversation", conversationId, token],
    queryFn: () =>
      apiClient.getTechConversation(requireToken(token), conversationId),
  });

  const takeoverMutation = useMutation({
    mutationFn: (active: boolean) =>
      apiClient.setConversationTakeover(requireToken(token), conversationId, {
        active,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(
        ["tech-conversation", conversationId, token],
        response,
      );
      void queryClient.invalidateQueries({
        queryKey: ["tech-conversations", token],
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      apiClient.sendConversationMessage(requireToken(token), conversationId, {
        body,
      }),
    onSuccess: () => {
      setDraft("");
      void detailQuery.refetch();
      void queryClient.invalidateQueries({
        queryKey: ["tech-conversations", token],
      });
    },
  });

  if (!conversationId) {
    return (
      <Screen>
        <Text selectable style={styles.body}>
          Missing conversation id.
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
            Loading conversation...
          </Text>
        </Panel>
      ) : detailQuery.isError ? (
        <Panel>
          <Text selectable style={styles.title}>
            Unable to load conversation
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
        <ConversationBody
          detail={detailQuery.data.conversation}
          draft={draft}
          isSending={sendMutation.isPending}
          isTogglingTakeover={takeoverMutation.isPending}
          sendError={sendMutation.error}
          onChangeDraft={setDraft}
          onSend={() => sendMutation.mutate(draft.trim())}
          onToggleTakeover={(active) => takeoverMutation.mutate(active)}
        />
      ) : null}
    </Screen>
  );
}

function ConversationBody({
  detail,
  draft,
  isSending,
  isTogglingTakeover,
  sendError,
  onChangeDraft,
  onSend,
  onToggleTakeover,
}: {
  detail: ConversationDetail;
  draft: string;
  isSending: boolean;
  isTogglingTakeover: boolean;
  sendError: unknown;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  onToggleTakeover: (active: boolean) => void;
}) {
  const outboundDisabled = isOutboundDisabledError(sendError);

  return (
    <>
      <Panel>
        <Text selectable style={styles.title}>
          {detail.customerName ?? detail.externalPhone ?? "Customer"}
        </Text>
        <Text selectable style={styles.body}>
          {detail.externalPhone ?? "Unknown sender"}
        </Text>
        <View style={styles.takeoverRow}>
          <Text selectable style={styles.body}>
            {detail.takeoverActive ? "Takeover On" : "Takeover Off"}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={isTogglingTakeover}
            onPress={() => onToggleTakeover(!detail.takeoverActive)}
            style={[
              styles.takeoverToggle,
              detail.takeoverActive && styles.takeoverToggleActive,
            ]}
          >
            <Text selectable={false} style={styles.takeoverToggleLabel}>
              {detail.takeoverActive ? "Release" : "Activate"}
            </Text>
          </Pressable>
        </View>
      </Panel>

      <Panel>
        <Text selectable style={styles.panelTitle}>
          Transcript
        </Text>
        {detail.messages.length === 0 ? (
          <Text selectable style={styles.body}>
            No messages yet.
          </Text>
        ) : (
          <View style={styles.messageList}>
            {detail.messages.map((message) => (
              <View key={message.id} style={styles.messageRow}>
                <Text selectable style={styles.messageDirection}>
                  {formatMessageSender(message.direction, message.authorRole)}
                  {message.direction === "internal" ? " · Internal note" : ""}
                </Text>
                <Text selectable style={styles.messageBody}>
                  {message.body}
                </Text>
                {message.externalStatus ? (
                  <Text selectable style={styles.messageMeta}>
                    {formatOutboundStatus(message.externalStatus)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Panel>

      <Panel>
        <Text selectable style={styles.panelTitle}>
          Reply
        </Text>
        <TextInput
          editable={detail.takeoverActive && !isSending}
          multiline
          onChangeText={onChangeDraft}
          placeholder={
            detail.takeoverActive
              ? "Write reply..."
              : "Activate takeover before replying"
          }
          placeholderTextColor="#6B7280"
          style={styles.composer}
          textAlignVertical="top"
          value={draft}
        />
        {outboundDisabled ? (
          <Text selectable style={styles.errorText}>
            Outbound messaging is disabled for local safety.
          </Text>
        ) : sendError ? (
          <Text selectable style={styles.errorText}>
            {getErrorMessage(sendError)}
          </Text>
        ) : null}
        <ActionButton
          disabled={
            !detail.takeoverActive || draft.trim().length === 0 || isSending
          }
          label="Send"
          loading={isSending}
          onPress={onSend}
        />
      </Panel>
    </>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function isOutboundDisabledError(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    typeof error.message === "string" &&
    error.message.toLowerCase().includes("outbound messaging is disabled")
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
  takeoverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  takeoverToggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F1F5F9",
  },
  takeoverToggleActive: {
    borderColor: "#047857",
    backgroundColor: "#D1FAE5",
  },
  takeoverToggleLabel: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  messageList: { gap: 10 },
  messageRow: {
    gap: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F9FAFB",
  },
  messageDirection: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  messageBody: {
    color: "#111827",
    fontSize: 14,
    lineHeight: 20,
  },
  messageMeta: {
    color: "#0F766E",
    fontSize: 12,
    fontWeight: "700",
  },
  composer: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    color: "#111827",
    backgroundColor: "#F8FAFC",
    fontSize: 16,
    lineHeight: 22,
  },
  errorText: { color: "#B42318", fontSize: 14, lineHeight: 20 },
});
