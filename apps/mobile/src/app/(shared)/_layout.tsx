import { Stack } from "expo-router/stack";

export default function SharedLayout() {
  return (
    <Stack>
      <Stack.Screen name="jobs/[jobId]" options={{ title: "Job" }} />
      <Stack.Screen name="leads/[conversationId]" options={{ title: "Lead" }} />
    </Stack>
  );
}
