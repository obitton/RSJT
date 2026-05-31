import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
} from "react-native";

type ActionButtonProps = Pick<PressableProps, "disabled" | "onPress"> & {
  label: string;
  loading?: boolean;
  variant?: "primary" | "secondary";
};

export function ActionButton({
  disabled,
  label,
  loading,
  onPress,
  variant = "primary",
}: ActionButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.button,
        variant === "secondary" && styles.secondaryButton,
        isDisabled && styles.disabledButton,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#FFFFFF" : "#111827"}
        />
      ) : (
        <Text
          selectable={false}
          style={[
            styles.label,
            variant === "secondary" && styles.secondaryLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 18,
    backgroundColor: "#111827",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
  },
  disabledButton: {
    opacity: 0.55,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryLabel: {
    color: "#111827",
  },
});
