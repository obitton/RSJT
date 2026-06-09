import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import { formatContactCardState } from "@/contact-cards/contact-card-format";
import type { LeadDetail } from "@rsjt/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function LeadDetailScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { session } = useAuth();
  const role = session?.user.role;
  const token = session?.token;

  const detailQuery = useQuery({
    enabled: Boolean(token && conversationId && role === "manager"),
    queryKey: ["manager-lead-detail", conversationId, token],
    queryFn: () =>
      apiClient.getManagerLeadDetail(requireToken(token), conversationId),
  });

  if (!conversationId) {
    return (
      <Screen>
        <PanelText label="Lead" value="Missing lead id" />
      </Screen>
    );
  }

  if (role !== "manager") {
    return (
      <Screen>
        <PanelText label="Lead" value={conversationId} />
        <Text selectable style={styles.body}>
          Detailed lead view is currently available for managers only.
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
            Loading lead details...
          </Text>
        </View>
      ) : detailQuery.isError ? (
        <View style={styles.panel}>
          <Text selectable style={styles.label}>
            Unable to load lead
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
        <LeadDetailBody lead={detailQuery.data.lead} />
      ) : null}
    </Screen>
  );
}

function LeadDetailBody({ lead }: { lead: LeadDetail }) {
  return (
    <>
      <View style={styles.panel}>
        <Text selectable style={styles.label}>
          Lead
        </Text>
        <Text selectable style={styles.value}>
          {lead.label}
        </Text>
        <Text selectable style={styles.body}>
          {formatContactCardState(lead.intakeState)}
          {lead.takeoverActive ? " · Working on" : ""}
        </Text>
      </View>

      <View style={styles.panel}>
        <Text selectable style={styles.label}>
          Details
        </Text>
        <Row label="Name" value={lead.customerName ?? "Not collected"} />
        <Row label="Phone" value={lead.externalPhone ?? "Unknown sender"} />
        <Row label="Email" value={lead.customerEmail ?? "Not collected"} />
        <Row label="Address" value={lead.serviceAddress ?? "Not collected"} />
        <Row
          label="Problem"
          value={lead.problemDescription ?? "Not collected"}
        />
        <Row label="Timing" value={lead.preferredTiming ?? "Not collected"} />
        <Row
          label="RepairShopr match"
          value={
            lead.matchedReference
              ? `${lead.matchedReference.entityType} ${lead.matchedReference.repairShoprId}`
              : "Not matched"
          }
        />
      </View>

      <View style={styles.panel}>
        <Text selectable style={styles.label}>
          Chat
        </Text>
        <Text selectable style={styles.body}>
          Read the full conversation with this lead, or take over the chat.
        </Text>
        <Link href={`/tech/conversations/${lead.id}`} style={styles.chatLink}>
          Open chat
        </Link>
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
    flex: 1,
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  chatLink: {
    minHeight: 40,
    paddingTop: 10,
    color: "#047857",
    fontSize: 14,
    fontWeight: "700",
  },
});
