import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import {
  formatRelativeTime,
  isTakeoverStale,
} from "@/conversations/conversation-format";
import type { ConversationSummary } from "@rsjt/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function TechConversationsScreen() {
  const { session } = useAuth();
  const token = session?.token;

  const query = useQuery({
    enabled: Boolean(token),
    queryKey: ["tech-conversations", token],
    queryFn: () => apiClient.listTechConversations(requireToken(token)),
  });

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Text selectable style={styles.title}>
          Customer conversations
        </Text>
        <Text selectable style={styles.body}>
          Active takeover and intake conversations.
        </Text>
      </View>

      {query.isLoading ? (
        <Panel>
          <ActivityIndicator color="#111827" />
          <Text selectable style={styles.body}>
            Loading conversations...
          </Text>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Unable to load conversations.
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
      ) : query.data ? (
        <>
          <Section
            title="Active takeover"
            emptyCopy="No active takeover conversations."
            conversations={query.data.active}
          />
          <Section
            title="Needs response"
            emptyCopy="No conversations need a response."
            conversations={query.data.needsResponse}
          />
          <Section
            title="Recent"
            emptyCopy="No recent conversations."
            conversations={query.data.recent}
          />
        </>
      ) : null}
    </Screen>
  );
}

function Section({
  title,
  emptyCopy,
  conversations,
}: {
  title: string;
  emptyCopy: string;
  conversations: ConversationSummary[];
}) {
  return (
    <Panel>
      <Text selectable style={styles.panelTitle}>
        {title}
      </Text>
      {conversations.length === 0 ? (
        <Text selectable style={styles.body}>
          {emptyCopy}
        </Text>
      ) : (
        <View style={styles.list}>
          {conversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
            />
          ))}
        </View>
      )}
    </Panel>
  );
}

function ConversationRow({
  conversation,
}: {
  conversation: ConversationSummary;
}) {
  const stale = isTakeoverStale(conversation.takeoverStartedAt);

  return (
    <Link
      href={`/tech/conversations/${conversation.id}`}
      style={styles.rowLink}
    >
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text selectable style={styles.rowTitle}>
            {conversation.customerName ??
              conversation.externalPhone ??
              "Unknown sender"}
          </Text>
          <Text selectable style={styles.rowMeta}>
            {conversation.intakeState.replace(/_/g, " ")} ·{" "}
            {`Last inbound ${formatRelativeTime(conversation.lastInboundAt)}`}
          </Text>
          {conversation.lastInboundPreview ? (
            <Text selectable style={styles.preview}>
              {conversation.lastInboundPreview}
            </Text>
          ) : null}
        </View>
        {conversation.takeoverActive ? (
          <Text selectable style={[styles.badge, stale && styles.staleBadge]}>
            {stale ? "Stale takeover" : "Active takeover"}
          </Text>
        ) : null}
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
  preview: { color: "#4B5563", fontSize: 12, fontStyle: "italic" },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
    color: "#1E3A8A",
    backgroundColor: "#DBEAFE",
    fontSize: 12,
    fontWeight: "700",
  },
  staleBadge: {
    color: "#7C2D12",
    backgroundColor: "#FFEDD5",
  },
});
