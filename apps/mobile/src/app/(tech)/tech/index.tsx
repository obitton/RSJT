import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import {
  formatConfidence,
  formatFactLabel,
  formatFactValue,
  formatJobState,
  formatMissingFieldLabel,
  quickReplyForMissingField,
} from "@/jobs/fact-format";
import type {
  ExtractedFact,
  JobSummary,
  MissingFieldPrompt,
  UpdateExtractionResponse,
} from "@rsjt/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { type ReactNode, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type FeedTab = "active" | "unresolved";

type ExtractUpdateVariables = {
  jobId: string;
  body: string;
};

export default function TechHomeScreen() {
  const { session, signOut } = useAuth();
  const token = session?.token;
  const [selectedTab, setSelectedTab] = useState<FeedTab>("active");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [lastExtraction, setLastExtraction] =
    useState<UpdateExtractionResponse | null>(null);
  const [confirmedFactKeys, setConfirmedFactKeys] = useState<
    ReadonlySet<string>
  >(new Set());

  const jobFeedQuery = useQuery({
    enabled: Boolean(token),
    queryKey: ["job-update-feed", token],
    queryFn: () => apiClient.getJobUpdateFeed(requireToken(token)),
  });

  const visibleJobs = useMemo(() => {
    const feed = jobFeedQuery.data;
    if (!feed) {
      return [];
    }

    return selectedTab === "active" ? feed.activeJobs : feed.unresolvedJobs;
  }, [jobFeedQuery.data, selectedTab]);

  const selectedJob =
    visibleJobs.find((job) => job.id === selectedJobId) ??
    visibleJobs[0] ??
    null;

  const updateMutation = useMutation({
    mutationFn: ({ jobId, body }: ExtractUpdateVariables) =>
      apiClient.extractJobUpdate(requireToken(token), jobId, { body }),
    onSuccess: (response) => {
      setLastExtraction(response);
      setConfirmedFactKeys(new Set());
      setDraft("");
    },
  });

  function selectTab(tab: FeedTab) {
    setSelectedTab(tab);
    setLastExtraction(null);
    setConfirmedFactKeys(new Set());
  }

  function selectJob(jobId: string) {
    setSelectedJobId(jobId);
    setLastExtraction(null);
    setConfirmedFactKeys(new Set());
  }

  function submitUpdate() {
    const body = draft.trim();
    if (!selectedJob || !body) {
      return;
    }

    updateMutation.mutate({ jobId: selectedJob.id, body });
  }

  function appendQuickReply(prompt: MissingFieldPrompt) {
    const reply = quickReplyForMissingField(prompt.field);
    setDraft((current) => {
      const trimmed = current.trimEnd();
      return `${trimmed}${trimmed ? " " : ""}${reply}`;
    });
  }

  function confirmFact(fact: ExtractedFact) {
    const key = factKey(fact);
    setConfirmedFactKeys((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  if (!session) {
    return (
      <Screen>
        <Text selectable style={styles.body}>
          Loading session...
        </Text>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Text selectable style={styles.eyebrow}>
          Signed in
        </Text>
        <Text selectable style={styles.title}>
          Tech
        </Text>
        <Text selectable style={styles.body}>
          {session.user.displayName}
        </Text>
      </View>

      <Panel>
        <Text selectable style={styles.panelTitle}>
          Customer Chat
        </Text>
        <Link href="/tech/conversations" style={styles.primaryLink}>
          Open conversations
        </Link>
      </Panel>

      <View style={styles.segmentedControl}>
        <SegmentButton
          active={selectedTab === "active"}
          label="Active"
          onPress={() => selectTab("active")}
        />
        <SegmentButton
          active={selectedTab === "unresolved"}
          label="Unresolved"
          onPress={() => selectTab("unresolved")}
        />
      </View>

      {jobFeedQuery.isLoading ? (
        <Panel>
          <ActivityIndicator color="#111827" />
          <Text selectable style={styles.body}>
            Loading jobs...
          </Text>
        </Panel>
      ) : jobFeedQuery.isError ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Unable to load jobs
          </Text>
          <Text selectable style={styles.body}>
            {getErrorMessage(jobFeedQuery.error)}
          </Text>
          <ActionButton
            label="Retry"
            onPress={() => void jobFeedQuery.refetch()}
            variant="secondary"
          />
        </Panel>
      ) : (
        <>
          <JobList
            jobs={visibleJobs}
            selectedJobId={selectedJob?.id ?? null}
            tab={selectedTab}
            onSelect={selectJob}
          />
          <UpdateComposer
            draft={draft}
            isSubmitting={updateMutation.isPending}
            selectedJob={selectedJob}
            submitError={updateMutation.error}
            onChangeDraft={setDraft}
            onSubmit={submitUpdate}
          />
          <ExtractionResult
            confirmedFactKeys={confirmedFactKeys}
            extraction={lastExtraction}
            onAppendQuickReply={appendQuickReply}
            onConfirmFact={confirmFact}
          />
        </>
      )}

      <Link href="/tech/conversations" style={styles.conversationLink}>
        Open customer conversations
      </Link>
      <Link href="/tech/scheduling" style={styles.conversationLink}>
        Review scheduling proposals
      </Link>
      <Link href="/tech/writebacks" style={styles.conversationLink}>
        Review approved writebacks
      </Link>
      <Link href="/tech/reminders" style={styles.conversationLink}>
        Open closeout reminders
      </Link>
      {selectedJob ? (
        <Link
          href={`/tech/money/${selectedJob.id}`}
          style={styles.conversationLink}
        >
          Review selected job money
        </Link>
      ) : null}

      <ActionButton
        label="Sign out"
        onPress={() => void signOut()}
        variant="secondary"
      />
    </Screen>
  );
}

function SegmentButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.segmentButton, active && styles.activeSegmentButton]}
    >
      <Text
        selectable={false}
        style={[styles.segmentLabel, active && styles.activeSegmentLabel]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function JobList({
  jobs,
  selectedJobId,
  tab,
  onSelect,
}: {
  jobs: JobSummary[];
  selectedJobId: string | null;
  tab: FeedTab;
  onSelect: (jobId: string) => void;
}) {
  return (
    <Panel>
      <View style={styles.sectionHeader}>
        <Text selectable style={styles.panelTitle}>
          Jobs
        </Text>
        <Text selectable style={styles.count}>
          {jobs.length}
        </Text>
      </View>
      {jobs.length === 0 ? (
        <Text selectable style={styles.body}>
          No {tab} jobs yet.
        </Text>
      ) : (
        <View style={styles.jobList}>
          {jobs.map((job) => (
            <Pressable
              accessibilityRole="button"
              key={job.id}
              onPress={() => onSelect(job.id)}
              style={[
                styles.jobRow,
                selectedJobId === job.id && styles.selectedJobRow,
              ]}
            >
              <View style={styles.jobText}>
                <Text selectable style={styles.jobTitle}>
                  {job.customerLabel ?? "Unlabeled job"}
                </Text>
                <Text selectable style={styles.jobMeta}>
                  {formatJobState(job.state)}
                </Text>
              </View>
              {selectedJobId === job.id ? (
                <Text selectable={false} style={styles.selectedMark}>
                  Selected
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </Panel>
  );
}

function UpdateComposer({
  draft,
  isSubmitting,
  selectedJob,
  submitError,
  onChangeDraft,
  onSubmit,
}: {
  draft: string;
  isSubmitting: boolean;
  selectedJob: JobSummary | null;
  submitError: Error | null;
  onChangeDraft: (value: string) => void;
  onSubmit: () => void;
}) {
  const hasDraft = draft.trim().length > 0;

  return (
    <Panel>
      <Text selectable style={styles.panelTitle}>
        Update
      </Text>
      <Text selectable style={styles.body}>
        {selectedJob
          ? (selectedJob.customerLabel ?? "Selected job")
          : "Select a job first."}
      </Text>
      <TextInput
        editable={Boolean(selectedJob) && !isSubmitting}
        multiline
        onChangeText={onChangeDraft}
        placeholder="Fixed laptop, 90 min, charged 180, no parts, no follow up"
        placeholderTextColor="#6B7280"
        style={styles.composer}
        textAlignVertical="top"
        value={draft}
      />
      {submitError ? (
        <Text selectable style={styles.errorText}>
          {getErrorMessage(submitError)}
        </Text>
      ) : null}
      <ActionButton
        disabled={!selectedJob || !hasDraft}
        label="Submit update"
        loading={isSubmitting}
        onPress={onSubmit}
      />
    </Panel>
  );
}

function ExtractionResult({
  confirmedFactKeys,
  extraction,
  onAppendQuickReply,
  onConfirmFact,
}: {
  confirmedFactKeys: ReadonlySet<string>;
  extraction: UpdateExtractionResponse | null;
  onAppendQuickReply: (prompt: MissingFieldPrompt) => void;
  onConfirmFact: (fact: ExtractedFact) => void;
}) {
  if (!extraction) {
    return (
      <Panel>
        <Text selectable style={styles.panelTitle}>
          Extracted facts
        </Text>
        <Text selectable style={styles.body}>
          No update processed yet.
        </Text>
      </Panel>
    );
  }

  return (
    <Panel>
      <Text selectable style={styles.panelTitle}>
        Extracted facts
      </Text>
      {extraction.facts.length === 0 ? (
        <Text selectable style={styles.body}>
          No structured facts found.
        </Text>
      ) : (
        <View style={styles.factList}>
          {extraction.facts.map((fact) => {
            const key = factKey(fact);
            const isConfirmed = confirmedFactKeys.has(key);

            return (
              <View key={key} style={styles.factRow}>
                <View style={styles.factHeader}>
                  <Text selectable style={styles.factTitle}>
                    {formatFactLabel(fact.type)}
                  </Text>
                  <Text selectable style={styles.confidence}>
                    {formatConfidence(fact.confidence)}
                  </Text>
                </View>
                <Text selectable style={styles.factValue}>
                  {formatFactValue(fact)}
                </Text>
                <Text selectable style={styles.quote}>
                  {`"${fact.evidence.quote}"`}
                </Text>
                <View style={styles.factActions}>
                  {fact.requiresConfirmation && !isConfirmed ? (
                    <Text selectable style={styles.confirmation}>
                      Needs confirmation
                    </Text>
                  ) : null}
                  {isConfirmed ? (
                    <Text selectable style={styles.confirmed}>
                      Confirmed
                    </Text>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onConfirmFact(fact)}
                      style={styles.confirmButton}
                    >
                      <Text selectable={false} style={styles.confirmButtonText}>
                        Confirm
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {extraction.prompts.length > 0 ? (
        <View style={styles.prompts}>
          <Text selectable style={styles.panelTitle}>
            Missing fields
          </Text>
          {extraction.prompts.map((prompt) => (
            <Pressable
              accessibilityRole="button"
              key={prompt.field}
              onPress={() => onAppendQuickReply(prompt)}
              style={styles.promptButton}
            >
              <View style={styles.promptText}>
                <Text selectable style={styles.promptLabel}>
                  {formatMissingFieldLabel(prompt.field)}
                </Text>
                <Text selectable style={styles.body}>
                  {prompt.message}
                </Text>
              </View>
              <Text selectable={false} style={styles.promptAction}>
                Add
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function factKey(fact: ExtractedFact) {
  return `${fact.evidence.messageId}-${fact.type}-${fact.evidence.quote}`;
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
  header: {
    gap: 6,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    padding: 18,
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
    fontSize: 28,
    fontWeight: "700",
  },
  body: {
    color: "#4B5563",
    fontSize: 14,
    lineHeight: 20,
  },
  segmentedControl: {
    minHeight: 48,
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    padding: 4,
    backgroundColor: "#E9EEF5",
  },
  segmentButton: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  activeSegmentButton: {
    backgroundColor: "#FFFFFF",
  },
  segmentLabel: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "700",
  },
  activeSegmentLabel: {
    color: "#111827",
  },
  panel: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  sectionHeader: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  panelTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  count: {
    minWidth: 28,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
    color: "#111827",
    backgroundColor: "#E0F2FE",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    textAlign: "center",
  },
  jobList: {
    gap: 8,
  },
  jobRow: {
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
  selectedJobRow: {
    borderColor: "#047857",
    backgroundColor: "#ECFDF5",
  },
  jobText: {
    flex: 1,
    gap: 4,
  },
  jobTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  jobMeta: {
    color: "#4B5563",
    fontSize: 13,
  },
  selectedMark: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
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
  errorText: {
    color: "#B42318",
    fontSize: 14,
    lineHeight: 20,
  },
  factList: {
    gap: 10,
  },
  factRow: {
    gap: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F9FAFB",
  },
  factHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  factTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  confidence: {
    color: "#0F766E",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  factValue: {
    color: "#111827",
    fontSize: 14,
  },
  quote: {
    color: "#6B7280",
    fontSize: 13,
    fontStyle: "italic",
  },
  confirmation: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
    color: "#7C2D12",
    backgroundColor: "#FFEDD5",
    fontSize: 12,
    fontWeight: "700",
  },
  confirmed: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
    color: "#047857",
    backgroundColor: "#D1FAE5",
    fontSize: 12,
    fontWeight: "700",
  },
  factActions: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confirmButton: {
    minHeight: 30,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
  },
  confirmButtonText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  prompts: {
    gap: 8,
  },
  promptButton: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F8FAFC",
  },
  promptText: {
    flex: 1,
    gap: 4,
  },
  promptLabel: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  promptAction: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "700",
  },
  conversationLink: {
    color: "#1D4ED8",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 8,
  },
  primaryLink: {
    minHeight: 48,
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: "#FFFFFF",
    backgroundColor: "#111827",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
});
