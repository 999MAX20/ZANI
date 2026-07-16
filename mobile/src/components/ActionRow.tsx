import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ZaniTheme } from "../theme/tokens";

type Props = {
  label: string;
  value?: string | number;
  tone?: "default" | "warning" | "danger";
  theme: ZaniTheme;
  disabled?: boolean;
  onPress?: () => void;
};

export function ActionRow({ label, value, tone = "default", theme, disabled = false, onPress }: Props) {
  const accent = tone === "danger" ? theme.danger : tone === "warning" ? theme.warning : theme.primary;
  const content = (
    <>
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <Text style={[styles.label, { color: theme.text }]} numberOfLines={2}>{label}</Text>
      {value !== undefined ? <Text style={[styles.value, { color: accent }]}>{value}</Text> : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.root,
          { backgroundColor: theme.panel, borderColor: theme.border, opacity: disabled ? 0.58 : pressed ? 0.82 : 1 }
        ]}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View style={[styles.root, { backgroundColor: theme.panel, borderColor: theme.border }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800"
  },
  value: {
    fontSize: 16,
    fontWeight: "900"
  }
});
