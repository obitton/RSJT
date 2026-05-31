import { StyleSheet, Text, TextInput, type TextInputProps } from "react-native";

type FormFieldProps = Pick<
  TextInputProps,
  | "autoCapitalize"
  | "autoComplete"
  | "keyboardType"
  | "onChangeText"
  | "placeholder"
  | "secureTextEntry"
  | "textContentType"
  | "value"
> & {
  label: string;
};

export function FormField({ label, ...inputProps }: FormFieldProps) {
  return (
    <>
      <Text selectable style={styles.label}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        placeholderTextColor="#6B7280"
        style={styles.input}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 14,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    fontSize: 16,
  },
});
