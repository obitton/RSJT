import { Stack } from "expo-router/stack";

export default function SharedLayout() {
  return (
    <Stack>
      <Stack.Screen name="jobs/[jobId]" options={{ title: "Job" }} />
    </Stack>
  );
}
