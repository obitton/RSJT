import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import {
  buildContactShareMessage,
  formatContactCardMissingField,
  formatContactCardState,
} from "@/contact-cards/contact-card-format";
import type { ContactCardPreviewResponse } from "@rsjt/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Share, StyleSheet, Text, View } from "react-native";

export default function ManagerContactCardScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { session } = useAuth();
  const role = session?.user.role;
  const token = session?.token;

  const previewQuery = useQuery({
    enabled: Boolean(token && conversationId && role === "manager"),
    queryKey: ["contact-card-preview", conversationId, token],
    queryFn: () =>
      apiClient.getContactCardPreview(requireToken(token), conversationId),
  });

  const vcardQuery = useQuery({
    enabled: Boolean(
      token &&
        conversationId &&
        role === "manager" &&
        previewQuery.data?.available,
    ),
    queryKey: ["contact-card-vcard", conversationId, token],
    queryFn: () =>
      apiClient.getContactCardVcard(requireToken(token), conversationId),
  });

  const shareMutation = useMutation({
    mutationFn: async () => {
      const vcard =
        vcardQuery.data ??
        (await apiClient.getContactCardVcard(
          requireToken(token),
          conversationId,
        ));
      await Share.share({
        message: buildContactShareMessage(vcard),
        title: previewQuery.data?.contact?.fullName ?? "Contact card",
      });
    },
  });

  if (!conversationId) {
    return (
      <Screen>
        <Panel>
          <Text selectable style={styles.body}>
            Missing conversation id.
          </Text>
        </Panel>
      </Screen>
    );
  }

  if (role !== "manager") {
    return (
      <Screen>
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Manager access required
          </Text>
          <Text selectable style={styles.body}>
            Contact cards are available from manager sessions.
          </Text>
        </Panel>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.screen}>
      {previewQuery.isLoading ? (
        <Panel>
          <ActivityIndicator color="#111827" />
          <Text selectable style={styles.body}>
            Loading contact card...
          </Text>
        </Panel>
      ) : previewQuery.isError ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Unable to load contact card
          </Text>
          <Text selectable style={styles.body}>
            {getErrorMessage(previewQuery.error)}
          </Text>
          <ActionButton
            label="Retry"
            onPress={() => void previewQuery.refetch()}
            variant="secondary"
          />
        </Panel>
      ) : previewQuery.data ? (
        <ContactCardBody
          preview={previewQuery.data}
          shareError={shareMutation.error}
          vcardError={vcardQuery.error}
          vcardLoading={vcardQuery.isLoading}
          onRetryVcard={() => void vcardQuery.refetch()}
          onShare={() => shareMutation.mutate()}
          sharing={shareMutation.isPending}
        />
      ) : null}
    </Screen>
  );
}

function ContactCardBody({
  preview,
  shareError,
  vcardError,
  vcardLoading,
  sharing,
  onRetryVcard,
  onShare,
}: {
  preview: ContactCardPreviewResponse;
  shareError: Error | null;
  vcardError: Error | null;
  vcardLoading: boolean;
  sharing: boolean;
  onRetryVcard: () => void;
  onShare: () => void;
}) {
  if (!preview.available || !preview.contact) {
    return (
      <Panel>
        <Text selectable style={styles.eyebrow}>
          Contact card
        </Text>
        <Text selectable style={styles.title}>
          Unavailable
        </Text>
        <Row label="State" value={formatContactCardState(preview.state)} />
        {preview.missingFields.map((field) => (
          <Text selectable key={field} style={styles.body}>
            {`Missing ${formatContactCardMissingField(field)}`}
          </Text>
        ))}
      </Panel>
    );
  }

  const contact = preview.contact;

  return (
    <>
      <Panel>
        <Text selectable style={styles.eyebrow}>
          Contact card
        </Text>
        <Text selectable style={styles.title}>
          {contact.fullName}
        </Text>
        <Row label="State" value={formatContactCardState(preview.state)} />
        <Row label="Phone" value={contact.phone} />
        <Row label="Email" value={contact.email ?? "Not entered"} />
        <Row
          label="Service address"
          value={contact.serviceAddress ?? "Not entered"}
        />
      </Panel>

      <Panel>
        <Text selectable style={styles.panelTitle}>
          Share
        </Text>
        {vcardError ? (
          <>
            <Text selectable style={styles.errorText}>
              {getErrorMessage(vcardError)}
            </Text>
            <ActionButton
              label="Retry contact card"
              onPress={onRetryVcard}
              variant="secondary"
            />
          </>
        ) : null}
        {shareError ? (
          <Text selectable style={styles.errorText}>
            {getErrorMessage(shareError)}
          </Text>
        ) : null}
        <ActionButton
          disabled={Boolean(vcardError)}
          label="Share contact"
          loading={vcardLoading || sharing}
          onPress={onShare}
        />
      </Panel>
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
    gap: 12,
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
    fontSize: 24,
    fontWeight: "700",
  },
  panelTitle: {
    color: "#111827",
    fontSize: 16,
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
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "700",
  },
});
