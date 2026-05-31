import { Stack } from "expo-router/stack";

export default function TechLayout() {
  return (
    <Stack>
      <Stack.Screen name="tech/index" options={{ title: "Tech" }} />
      <Stack.Screen
        name="tech/conversations/index"
        options={{ title: "Conversations" }}
      />
      <Stack.Screen
        name="tech/conversations/[conversationId]"
        options={{ title: "Conversation" }}
      />
      <Stack.Screen
        name="tech/scheduling/index"
        options={{ title: "Scheduling" }}
      />
      <Stack.Screen
        name="tech/scheduling/[proposalId]"
        options={{ title: "Proposal" }}
      />
      <Stack.Screen
        name="tech/money/[jobId]"
        options={{ title: "Money Review" }}
      />
      <Stack.Screen
        name="tech/reminders/index"
        options={{ title: "Reminders" }}
      />
      <Stack.Screen
        name="tech/writebacks/index"
        options={{ title: "Writebacks" }}
      />
      <Stack.Screen
        name="tech/writebacks/[executionId]"
        options={{ title: "Writeback" }}
      />
    </Stack>
  );
}
