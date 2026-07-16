import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";

import { refreshMobileSession } from "./src/api/client";
import { getMobileBootstrap } from "./src/api/mobile";
import { translate } from "./src/i18n/dictionaries";
import { parseZaniDeepLink, type MobileDeepLinkTarget } from "./src/navigation/deepLinks";
import { initMobileObservability, wrapMobileApp } from "./src/observability/sentry";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { darkTheme, lightTheme } from "./src/theme/tokens";
import type { AppLanguage, MobileAuthResponse } from "./src/types/mobile";

initMobileObservability();

function App() {
  const scheme = useColorScheme();
  const [language, setLanguage] = useState<AppLanguage>("ru");
  const [authenticated, setAuthenticated] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [pendingLinkTarget, setPendingLinkTarget] = useState<MobileDeepLinkTarget | null>(null);
  const theme = useMemo(() => (scheme === "dark" ? darkTheme : lightTheme), [scheme]);

  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        if (url) setPendingLinkTarget(parseZaniDeepLink(url));
      })
      .catch(() => undefined);
    const subscription = Linking.addEventListener("url", ({ url }) => {
      setPendingLinkTarget(parseZaniDeepLink(url));
    });
    async function restore() {
      try {
        const refreshed = await refreshMobileSession();
        if (refreshed) {
          await getMobileBootstrap();
          setAuthenticated(true);
        }
      } catch {
        setAuthenticated(false);
      } finally {
        setRestoring(false);
      }
    }
    void restore();
    return () => subscription.remove();
  }, []);

  function onAuthenticated(_response: MobileAuthResponse) {
    setAuthenticated(true);
  }

  if (restoring) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.page }]}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <ActivityIndicator color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.muted }]}>{translate(language, "state.loading")}</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {authenticated ? (
        <HomeScreen
          language={language}
          onLanguageChange={setLanguage}
          theme={theme}
          onLogout={() => setAuthenticated(false)}
          deepLinkTarget={pendingLinkTarget}
          onDeepLinkHandled={() => setPendingLinkTarget(null)}
        />
      ) : (
        <LoginScreen language={language} onLanguageChange={setLanguage} theme={theme} onAuthenticated={onAuthenticated} />
      )}
    </>
  );
}

export default wrapMobileApp(App);

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "800"
  }
});
