import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, type ViewStyle } from "react-native";

type ScreenProps = PropsWithChildren<{
  contentStyle?: ViewStyle;
}>;

export function Screen({ children, contentStyle }: ScreenProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, contentStyle]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: 16,
    padding: 20,
    backgroundColor: "#F7F8FA",
  },
});
