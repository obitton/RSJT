import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/action-button";
import { FormField } from "@/components/form-field";
import { Screen } from "@/components/screen";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type PreviewAccount = {
  username: string;
  passcode: string;
  label: string;
};

const previewAccounts: PreviewAccount[] = [
  { username: "manager", passcode: "manager-dev", label: "Manager" },
  { username: "tech", passcode: "tech-dev", label: "Tech" },
];

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");

  const mutation = useMutation({
    mutationFn: signIn,
    onSuccess: (session) => {
      router.replace(session.user.role === "manager" ? "/manager" : "/tech");
    },
  });

  const canSubmit = username.trim().length > 0 && passcode.length >= 4;
  const errorMessage = getErrorMessage(mutation.error);

  function applyPreviewAccount(account: PreviewAccount) {
    setUsername(account.username);
    setPasscode(account.passcode);
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.panel}>
        <Text selectable style={styles.title}>
          RSJT
        </Text>
        <View style={styles.form}>
          <FormField
            autoCapitalize="none"
            autoComplete="username"
            label="Username"
            onChangeText={setUsername}
            placeholder="manager or tech"
            textContentType="username"
            value={username}
          />
          <FormField
            autoCapitalize="none"
            autoComplete="current-password"
            label="Passcode"
            onChangeText={setPasscode}
            placeholder="Local passcode"
            secureTextEntry
            textContentType="password"
            value={passcode}
          />
          {__DEV__ ? (
            <View style={styles.previewBox}>
              <Text selectable style={styles.previewTitle}>
                Local preview
              </Text>
              <View style={styles.previewButtons}>
                {previewAccounts.map((account) => (
                  <Pressable
                    accessibilityRole="button"
                    key={account.username}
                    onPress={() => applyPreviewAccount(account)}
                    style={styles.previewButton}
                  >
                    <Text selectable={false} style={styles.previewButtonLabel}>
                      {account.label}
                    </Text>
                    <Text selectable={false} style={styles.previewButtonMeta}>
                      {account.username} / {account.passcode}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {errorMessage ? (
            <Text selectable style={styles.error}>
              {errorMessage}
            </Text>
          ) : null}
          <ActionButton
            disabled={!canSubmit}
            label="Sign in"
            loading={mutation.isPending}
            onPress={() =>
              mutation.mutate({
                username: username.trim(),
                passcode,
              })
            }
          />
        </View>
      </View>
    </Screen>
  );
}

function getErrorMessage(error: Error | null) {
  if (!error) {
    return null;
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return "Sign in failed";
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "center",
  },
  panel: {
    gap: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
  form: {
    gap: 10,
  },
  previewBox: {
    gap: 10,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F8FAFC",
  },
  previewTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  previewButtons: {
    gap: 8,
  },
  previewButton: {
    minHeight: 48,
    gap: 2,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  previewButtonLabel: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  previewButtonMeta: {
    color: "#4B5563",
    fontSize: 12,
  },
  error: {
    color: "#B42318",
    fontSize: 14,
    lineHeight: 20,
  },
});
