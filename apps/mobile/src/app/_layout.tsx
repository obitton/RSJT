import { AuthProvider, useAuth } from "@/auth/auth-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { isLoading, session } = useAuth();
  const isManager = session?.user.role === "manager";
  const isTech = session?.user.role === "tech";
  const canReviewConversations = isManager || isTech;
  const isSignedIn = Boolean(session);

  if (isLoading) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ title: "RSJT" }} />
      </Stack>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="index" options={{ title: "RSJT" }} />
        <Stack.Screen name="(shared)" />
      </Stack.Protected>
      <Stack.Protected guard={isManager}>
        <Stack.Screen name="(manager)" />
      </Stack.Protected>
      <Stack.Protected guard={canReviewConversations}>
        <Stack.Screen name="(tech)" />
      </Stack.Protected>
    </Stack>
  );
}
