import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { LanguageSwitch } from "../components/LanguageSwitch";
import { mobileLogin } from "../api/mobile";
import { translate } from "../i18n/dictionaries";
import type { AppLanguage, MobileAuthResponse } from "../types/mobile";
import type { ZaniTheme } from "../theme/tokens";

type Props = {
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  theme: ZaniTheme;
  onAuthenticated: (response: MobileAuthResponse) => void;
};

export function LoginScreen({ language, onLanguageChange, theme, onAuthenticated }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const t = (key: string) => translate(language, key);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const response = await mobileLogin({ email, password });
      onAuthenticated(response);
    } catch {
      setError(t("auth.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.root, { backgroundColor: theme.page }]}>
      <View style={styles.top}>
        <View style={[styles.logo, { backgroundColor: theme.primary }]}>
          <Text style={styles.logoText}>Z</Text>
        </View>
        <LanguageSwitch language={language} onChange={onLanguageChange} theme={theme} />
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]}>{t("auth.title")}</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>{t("auth.subtitle")}</Text>
      </View>

      <View style={[styles.form, { backgroundColor: theme.panel, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.muted }]}>{t("auth.email")}</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.panelSoft }]}
          placeholder={t("auth.email")}
          placeholderTextColor={theme.muted}
        />
        <Text style={[styles.label, { color: theme.muted }]}>{t("auth.password")}</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.panelSoft }]}
          placeholder={t("auth.password")}
          placeholderTextColor={theme.muted}
        />
        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
        <Pressable
          disabled={loading || !email || !password}
          onPress={submit}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary, opacity: pressed || loading || !email || !password ? 0.72 : 1 }
          ]}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t("auth.submit")}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 68,
    gap: 30
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900"
  },
  copy: {
    gap: 10
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900"
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600"
  },
  form: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12
  },
  label: {
    fontSize: 13,
    fontWeight: "800"
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "700"
  },
  error: {
    fontSize: 13,
    fontWeight: "800"
  },
  button: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900"
  }
});
