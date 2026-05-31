import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import {
  formatExpenseCategory,
  formatMissingField,
  formatNullableMoney,
  formatPayoutReady,
  formatProfitBasis,
  formatSplitCategory,
} from "@/money/money-format";
import type { JobMoneyResponse, SplitCategory } from "@rsjt/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const SPLIT_CATEGORIES = [
  "returning_repairshopr_customer",
  "new_lead",
  "customer_service_heavy",
] as const satisfies readonly SplitCategory[];

export default function ManagerMoneyScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { session } = useAuth();
  const token = session?.token;
  const queryClient = useQueryClient();
  const [loadedJobId, setLoadedJobId] = useState<string | null>(null);
  const [selectedSplit, setSelectedSplit] = useState<SplitCategory>("new_lead");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const moneyQuery = useQuery({
    enabled: Boolean(token && jobId),
    queryKey: ["job-money", jobId, token],
    queryFn: () => apiClient.getJobMoney(requireToken(token), jobId),
  });

  const hydrateForm = useCallback((response: JobMoneyResponse) => {
    setLoadedJobId(response.summary.jobId);
    setSelectedSplit(response.summary.splitCategory ?? "new_lead");
    setReason("");
  }, []);

  useEffect(() => {
    const data = moneyQuery.data;
    if (!data || loadedJobId === data.summary.jobId) {
      return;
    }
    const timer = setTimeout(() => hydrateForm(data), 0);
    return () => clearTimeout(timer);
  }, [moneyQuery.data, loadedJobId, hydrateForm]);

  const overrideMutation = useMutation({
    mutationFn: () =>
      apiClient.overrideJobSplitCategory(requireToken(token), jobId, {
        splitCategory: selectedSplit,
        reason: reason.trim(),
      }),
    onSuccess: (response) => {
      hydrateForm(response);
      setValidationError(null);
      void queryClient.invalidateQueries({ queryKey: ["manager-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["job-money", jobId] });
    },
  });

  function submitOverride() {
    if (!reason.trim()) {
      setValidationError("Reason is required.");
      return;
    }
    setValidationError(null);
    overrideMutation.mutate();
  }

  if (!jobId) {
    return (
      <Screen>
        <Panel>
          <Text selectable style={styles.body}>
            Missing job id.
          </Text>
        </Panel>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.screen}>
      {moneyQuery.isLoading ? (
        <Panel>
          <ActivityIndicator color="#111827" />
          <Text selectable style={styles.body}>
            Loading money review...
          </Text>
        </Panel>
      ) : moneyQuery.isError ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Unable to load money review
          </Text>
          <Text selectable style={styles.body}>
            {getErrorMessage(moneyQuery.error)}
          </Text>
          <ActionButton
            label="Retry"
            onPress={() => void moneyQuery.refetch()}
            variant="secondary"
          />
        </Panel>
      ) : moneyQuery.data ? (
        <MoneyReview
          data={moneyQuery.data}
          isSubmitting={overrideMutation.isPending}
          reason={reason}
          selectedSplit={selectedSplit}
          submitError={overrideMutation.error}
          validationError={validationError}
          onChangeReason={setReason}
          onSelectSplit={setSelectedSplit}
          onSubmit={submitOverride}
        />
      ) : null}
    </Screen>
  );
}

function MoneyReview({
  data,
  isSubmitting,
  reason,
  selectedSplit,
  submitError,
  validationError,
  onChangeReason,
  onSelectSplit,
  onSubmit,
}: {
  data: JobMoneyResponse;
  isSubmitting: boolean;
  reason: string;
  selectedSplit: SplitCategory;
  submitError: Error | null;
  validationError: string | null;
  onChangeReason: (value: string) => void;
  onSelectSplit: (category: SplitCategory) => void;
  onSubmit: () => void;
}) {
  const summary = data.summary;

  return (
    <>
      <Panel>
        <Text selectable style={styles.eyebrow}>
          Money review
        </Text>
        <Text selectable style={styles.title}>
          Manager split
        </Text>
        <Row label="Payout" value={formatPayoutReady(summary.payoutReady)} />
        <Row
          label="Profit basis"
          value={formatProfitBasis(summary.profitBasis)}
        />
        <Row
          label="Charge"
          value={formatNullableMoney(summary.grossChargeCents)}
        />
        <Row
          label="Expenses"
          value={formatNullableMoney(summary.reportedExpenseCents)}
        />
        <Row
          label="Reported profit"
          value={formatNullableMoney(summary.reportedProfitCents)}
        />
        <Row
          label="Calculated profit"
          value={formatNullableMoney(summary.calculatedProfitCents)}
        />
      </Panel>

      <Panel>
        <Text selectable style={styles.panelTitle}>
          Split
        </Text>
        <Row
          label="Current"
          value={
            summary.splitCategory
              ? formatSplitCategory(summary.splitCategory)
              : "Not selected"
          }
        />
        <Row
          label="Manager share"
          value={
            summary.managerShareCents === null
              ? "Not ready"
              : formatNullableMoney(summary.managerShareCents)
          }
        />
        <Row
          label="Tech share"
          value={
            summary.techShareCents === null
              ? "Not ready"
              : formatNullableMoney(summary.techShareCents)
          }
        />
        <View style={styles.segmentedControl}>
          {SPLIT_CATEGORIES.map((category) => (
            <SegmentButton
              active={selectedSplit === category}
              key={category}
              label={formatSplitCategory(category)}
              onPress={() => onSelectSplit(category)}
            />
          ))}
        </View>
        <TextInput
          multiline
          onChangeText={onChangeReason}
          placeholder="Audit reason"
          placeholderTextColor="#6B7280"
          style={styles.reasonInput}
          textAlignVertical="top"
          value={reason}
        />
        {validationError ? (
          <Text selectable style={styles.errorText}>
            {validationError}
          </Text>
        ) : submitError ? (
          <Text selectable style={styles.errorText}>
            {getErrorMessage(submitError)}
          </Text>
        ) : null}
        <ActionButton
          label="Override split"
          loading={isSubmitting}
          onPress={onSubmit}
        />
      </Panel>

      <Panel>
        <Text selectable style={styles.panelTitle}>
          Expenses
        </Text>
        {data.expenses.length === 0 ? (
          <Text selectable style={styles.body}>
            No expenses entered.
          </Text>
        ) : (
          <View style={styles.expenseList}>
            {data.expenses.map((expense) => (
              <View key={expense.id} style={styles.expenseRow}>
                <Text selectable style={styles.expenseTitle}>
                  {formatExpenseCategory(expense.category)}
                </Text>
                <Text selectable style={styles.body}>
                  {formatNullableMoney(expense.amountCents)}
                  {expense.description ? ` - ${expense.description}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Panel>

      {summary.missingFields.length > 0 ? (
        <Panel>
          <Text selectable style={styles.panelTitle}>
            Missing fields
          </Text>
          {summary.missingFields.map((field) => (
            <Text selectable key={field} style={styles.body}>
              {formatMissingField(field)}
            </Text>
          ))}
        </Panel>
      ) : null}
    </>
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
  segmentedControl: {
    gap: 6,
  },
  segmentButton: {
    minHeight: 40,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
  },
  activeSegmentButton: {
    borderColor: "#047857",
    backgroundColor: "#ECFDF5",
  },
  segmentLabel: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "700",
  },
  activeSegmentLabel: {
    color: "#047857",
  },
  reasonInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    fontSize: 15,
  },
  expenseList: {
    gap: 8,
  },
  expenseRow: {
    gap: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F9FAFB",
  },
  expenseTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "700",
  },
});
