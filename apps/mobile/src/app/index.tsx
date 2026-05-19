import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <View style={styles.panel}>
        <Text selectable style={styles.title}>
          RSJT
        </Text>
        <Text selectable style={styles.body}>
          Local mobile shell for the service referral ops agent.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F7F8FA",
  },
  panel: {
    gap: 8,
    padding: 20,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
  body: {
    color: "#4B5563",
    fontSize: 16,
    lineHeight: 22,
  },
});
