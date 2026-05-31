import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { Screen } from "@/components/screen";
import {
  formatExpenseCategory,
  formatMoneyInput,
  formatNullableMoney,
  formatPayoutReady,
  formatProfitBasis,
  parseMoneyInputToCents,
} from "@/money/money-format";
import type {
  ExpenseCategory,
  JobExpenseInput,
  JobMoneyResponse,
  UpdateJobMoneyRequest,
} from "@rsjt/shared";
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

type ExpenseDraft = {
  key: string;
  category: ExpenseCategory;
  amount: string;
  description: string;
};

const EXPENSE_CATEGORIES = [
  "parts",
  "materials",
  "subcontractor",
  "other",
] as const satisfies readonly ExpenseCategory[];

export default function TechMoneyScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { session } = useAuth();
  const token = session?.token;
  const queryClient = useQueryClient();
  const [loadedJobId, setLoadedJobId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [grossCharge, setGrossCharge] = useState("");
  const [reportedProfit, setReportedProfit] = useState("");
  const [expenses, setExpenses] = useState<ExpenseDraft[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const moneyQuery = useQuery({
    enabled: Boolean(token && jobId),
    queryKey: ["job-money", jobId, token],
    queryFn: () => apiClient.getJobMoney(requireToken(token), jobId),
  });

  const hydrateForm = useCallback((response: JobMoneyResponse) => {
    setLoadedJobId(response.summary.jobId);
    setCompleted(response.summary.isCompleted);
    setGrossCharge(formatMoneyInput(response.summary.grossChargeCents));
    setReportedProfit(formatMoneyInput(response.summary.reportedProfitCents));
    setExpenses(
      response.expenses.map((expense) => ({
        key: expense.id,
        category: expense.category,
        amount: formatMoneyInput(expense.amountCents),
        description: expense.description ?? "",
      })),
    );
  }, []);

  useEffect(() => {
    const data = moneyQuery.data;
    if (!data || loadedJobId === data.summary.jobId) {
      return;
    }
    const timer = setTimeout(() => hydrateForm(data), 0);
    return () => clearTimeout(timer);
  }, [moneyQuery.data, loadedJobId, hydrateForm]);

  const updateMutation = useMutation({
    mutationFn: (input: UpdateJobMoneyRequest) =>
      apiClient.updateJobMoney(requireToken(token), jobId, input),
    onSuccess: (response) => {
      hydrateForm(response);
      setValidationError(null);
      void queryClient.invalidateQueries({ queryKey: ["job-update-feed"] });
      void queryClient.invalidateQueries({ queryKey: ["job-money", jobId] });
    },
  });

  function submit() {
    const input = buildUpdateInput();
    if (!input) {
      return;
    }
    updateMutation.mutate(input);
  }

  function buildUpdateInput(): UpdateJobMoneyRequest | null {
    const gross = parseOptionalMoney("Charge", grossCharge);
    if (!gross.ok) {
      setValidationError(gross.message);
      return null;
    }
    const profit = parseOptionalMoney("Reported profit", reportedProfit);
    if (!profit.ok) {
      setValidationError(profit.message);
      return null;
    }

    const expenseInputs: JobExpenseInput[] = [];
    for (const draft of expenses) {
      const hasAmount = draft.amount.trim().length > 0;
      const hasDescription = draft.description.trim().length > 0;
      if (!hasAmount && !hasDescription) {
        continue;
      }
      const amount = parseOptionalMoney("Expense", draft.amount);
      if (!amount.ok || amount.value === null) {
        setValidationError(
          amount.ok ? "Expense amount is required." : amount.message,
        );
        return null;
      }
      expenseInputs.push({
        category: draft.category,
        amountCents: amount.value,
        ...(hasDescription ? { description: draft.description.trim() } : {}),
      });
    }

    setValidationError(null);
    return {
      completed,
      grossChargeCents: gross.value,
      reportedProfitCents: profit.value,
      expenses: expenseInputs,
    };
  }

  function addExpense() {
    setExpenses((current) => [
      ...current,
      {
        key: `new-${Date.now()}`,
        category: "parts",
        amount: "",
        description: "",
      },
    ]);
  }

  function updateExpense(key: string, patch: Partial<ExpenseDraft>) {
    setExpenses((current) =>
      current.map((expense) =>
        expense.key === key ? { ...expense, ...patch } : expense,
      ),
    );
  }

  function removeExpense(key: string) {
    setExpenses((current) => current.filter((expense) => expense.key !== key));
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
        <>
          <Panel>
            <Text selectable style={styles.eyebrow}>
              Money review
            </Text>
            <Text selectable style={styles.title}>
              Tech closeout
            </Text>
            <Row
              label="Payout"
              value={formatPayoutReady(moneyQuery.data.summary.payoutReady)}
            />
            <Row
              label="Profit basis"
              value={formatProfitBasis(moneyQuery.data.summary.profitBasis)}
            />
            <Row
              label="Calculated profit"
              value={formatNullableMoney(
                moneyQuery.data.summary.calculatedProfitCents,
              )}
            />
          </Panel>

          <Panel>
            <ToggleRow
              active={completed}
              label="Completed"
              onPress={() => setCompleted((value) => !value)}
            />
            <MoneyField
              label="Charge"
              onChangeText={setGrossCharge}
              value={grossCharge}
            />
            <MoneyField
              label="Reported profit"
              onChangeText={setReportedProfit}
              value={reportedProfit}
            />
          </Panel>

          <Panel>
            <View style={styles.sectionHeader}>
              <Text selectable style={styles.panelTitle}>
                Expenses
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={addExpense}
                style={styles.smallButton}
              >
                <Text selectable={false} style={styles.smallButtonText}>
                  Add
                </Text>
              </Pressable>
            </View>
            {expenses.length === 0 ? (
              <Text selectable style={styles.body}>
                No expenses entered.
              </Text>
            ) : (
              <View style={styles.expenseList}>
                {expenses.map((expense) => (
                  <ExpenseEditor
                    draft={expense}
                    key={expense.key}
                    onChange={updateExpense}
                    onRemove={removeExpense}
                  />
                ))}
              </View>
            )}
          </Panel>

          {validationError ? (
            <Text selectable style={styles.errorText}>
              {validationError}
            </Text>
          ) : updateMutation.error ? (
            <Text selectable style={styles.errorText}>
              {getErrorMessage(updateMutation.error)}
            </Text>
          ) : null}

          <ActionButton
            label="Save money details"
            loading={updateMutation.isPending}
            onPress={submit}
          />
        </>
      ) : null}
    </Screen>
  );
}

function ExpenseEditor({
  draft,
  onChange,
  onRemove,
}: {
  draft: ExpenseDraft;
  onChange: (key: string, patch: Partial<ExpenseDraft>) => void;
  onRemove: (key: string) => void;
}) {
  const categoryIndex = EXPENSE_CATEGORIES.indexOf(draft.category);
  const nextCategory =
    EXPENSE_CATEGORIES[(categoryIndex + 1) % EXPENSE_CATEGORIES.length] ??
    "parts";

  return (
    <View style={styles.expenseRow}>
      <View style={styles.expenseHeader}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(draft.key, { category: nextCategory })}
          style={styles.categoryButton}
        >
          <Text selectable={false} style={styles.categoryText}>
            {formatExpenseCategory(draft.category)}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onRemove(draft.key)}
          style={styles.removeButton}
        >
          <Text selectable={false} style={styles.removeButtonText}>
            Remove
          </Text>
        </Pressable>
      </View>
      <MoneyField
        label="Amount"
        onChangeText={(value) => onChange(draft.key, { amount: value })}
        value={draft.amount}
      />
      <TextInput
        onChangeText={(value) => onChange(draft.key, { description: value })}
        placeholder="Description"
        placeholderTextColor="#6B7280"
        style={styles.input}
        value={draft.description}
      />
    </View>
  );
}

function MoneyField({
  label,
  onChangeText,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text selectable style={styles.fieldLabel}>
        {label}
      </Text>
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={onChangeText}
        placeholder="0.00"
        placeholderTextColor="#6B7280"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function ToggleRow({
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
      style={styles.toggleRow}
    >
      <View style={[styles.checkbox, active && styles.checkboxActive]}>
        <Text selectable={false} style={styles.checkboxText}>
          {active ? "x" : ""}
        </Text>
      </View>
      <Text selectable={false} style={styles.toggleLabel}>
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

function parseOptionalMoney(label: string, value: string) {
  if (value.trim().length === 0) {
    return { ok: true, value: null } as const;
  }
  const cents = parseMoneyInputToCents(value);
  if (cents === null) {
    return { ok: false, message: `${label} must be a dollar amount.` } as const;
  }
  return { ok: true, value: cents } as const;
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
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  sectionHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    fontSize: 15,
  },
  toggleRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#9CA3AF",
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  checkboxActive: {
    borderColor: "#047857",
    backgroundColor: "#047857",
  },
  checkboxText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  toggleLabel: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  smallButton: {
    minHeight: 32,
    justifyContent: "center",
    borderRadius: 6,
    paddingHorizontal: 12,
    backgroundColor: "#111827",
  },
  smallButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  expenseList: {
    gap: 10,
  },
  expenseRow: {
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F9FAFB",
  },
  expenseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryButton: {
    minHeight: 32,
    justifyContent: "center",
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: "#E0F2FE",
  },
  categoryText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  removeButton: {
    minHeight: 32,
    justifyContent: "center",
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: "#FEE2E2",
  },
  removeButtonText: {
    color: "#991B1B",
    fontSize: 13,
    fontWeight: "700",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "700",
  },
});
