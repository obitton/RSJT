import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import { formatProposalState } from "@/scheduling/scheduling-format";
import type { SchedulingProposal } from "@rsjt/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function TechSchedulingScreen() {
  const { session } = useAuth();
  const token = session?.token;

  const query = useQuery({
    enabled: Boolean(token),
    queryKey: ["tech-scheduling", token],
    queryFn: () => apiClient.listSchedulingProposals(requireToken(token)),
  });

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Text selectable style={styles.title}>
          Scheduling
        </Text>
        <Text selectable style={styles.body}>
          Review and approve scheduling wording and appointment proposals.
        </Text>
      </View>

      {query.isLoading ? (
        <Panel>
          <ActivityIndicator color="#111827" />
          <Text selectable style={styles.body}>
            Loading proposals...
          </Text>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Unable to load proposals.
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
            title="Pending"
            empty="No pending proposals."
            proposals={query.data.pending}
          />
          <Section
            title="Decided"
            empty="No decided proposals yet."
            proposals={query.data.decided}
          />
        </>
      ) : null}
    </Screen>
  );
}

function Section({
  title,
  empty,
  proposals,
}: {
  title: string;
  empty: string;
  proposals: SchedulingProposal[];
}) {
  return (
    <Panel>
      <Text selectable style={styles.panelTitle}>
        {title}
      </Text>
      {proposals.length === 0 ? (
        <Text selectable style={styles.body}>
          {empty}
        </Text>
      ) : (
        <View style={styles.list}>
          {proposals.map((proposal) => (
            <ProposalRow key={proposal.id} proposal={proposal} />
          ))}
        </View>
      )}
    </Panel>
  );
}

function ProposalRow({ proposal }: { proposal: SchedulingProposal }) {
  return (
    <Link href={`/tech/scheduling/${proposal.id}`} style={styles.rowLink}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text selectable style={styles.rowTitle}>
            {proposal.preferredWindowText}
          </Text>
          <Text selectable style={styles.rowMeta}>
            {formatProposalState(proposal.state)}
          </Text>
          <Text selectable style={styles.preview}>
            {proposal.customerMessageBody}
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
  preview: { color: "#4B5563", fontSize: 12, fontStyle: "italic" },
});
