import { Stack } from "expo-router/stack";

export default function ManagerLayout() {
  return (
    <Stack>
      <Stack.Screen name="manager/index" options={{ title: "Manager" }} />
      <Stack.Screen
        name="manager/money/[jobId]"
        options={{ title: "Money Review" }}
      />
      <Stack.Screen
        name="manager/contact-card/[conversationId]"
        options={{ title: "Contact Card" }}
      />
      <Stack.Screen
        name="manager/reminders/stale"
        options={{ title: "Stale Reminders" }}
      />
    </Stack>
  );
}
