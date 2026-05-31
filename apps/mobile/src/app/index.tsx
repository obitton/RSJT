import { useAuth } from "@/auth/auth-context";
import { Screen } from "@/components/screen";
import { Redirect } from "expo-router";
import { StyleSheet, Text } from "react-native";

export default function IndexScreen() {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text selectable style={styles.title}>
          RSJT
        </Text>
        <Text selectable style={styles.body}>
          Loading session
        </Text>
      </Screen>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  if (session.user.role === "manager") {
    return <Redirect href="/manager" />;
  }

  return <Redirect href="/tech" />;
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: "center",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    color: "#4B5563",
    fontSize: 16,
    textAlign: "center",
  },
});
