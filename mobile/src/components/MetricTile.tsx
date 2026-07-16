import { StyleSheet, Text, View } from "react-native";

import type { ZaniTheme } from "../theme/tokens";

type Props = {
  label: string;
  value: string | number;
  theme: ZaniTheme;
};

export function MetricTile({ label, value, theme }: Props) {
  return (
    <View style={[styles.root, { backgroundColor: theme.panel, borderColor: theme.border }]}>
      <Text numberOfLines={1} style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.value, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "48%",
    minHeight: 94,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    justifyContent: "space-between"
  },
  label: {
    fontSize: 13,
    fontWeight: "700"
  },
  value: {
    fontSize: 28,
    fontWeight: "900"
  }
});
