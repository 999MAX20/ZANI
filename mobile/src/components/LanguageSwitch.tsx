import { Pressable, StyleSheet, Text, View } from "react-native";

import { languages } from "../i18n/dictionaries";
import type { AppLanguage } from "../types/mobile";
import type { ZaniTheme } from "../theme/tokens";

type Props = {
  language: AppLanguage;
  onChange: (language: AppLanguage) => void;
  theme: ZaniTheme;
};

export function LanguageSwitch({ language, onChange, theme }: Props) {
  return (
    <View style={[styles.root, { borderColor: theme.border, backgroundColor: theme.panelSoft }]}>
      {languages.map((item) => {
        const active = item === language;
        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            style={[styles.item, active && { backgroundColor: theme.panel }]}
          >
            <Text style={[styles.text, { color: active ? theme.text : theme.muted }]}>{item.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
    gap: 2
  },
  item: {
    minWidth: 42,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  text: {
    fontSize: 12,
    fontWeight: "800"
  }
});
