
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { useEffect, useState } from 'react';

import { LanguageProvider } from '@/i18n/language-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const resolvedTheme = !hasMounted
    ? DarkTheme
    : colorScheme === 'dark'
      ? DarkTheme
      : DefaultTheme;

  return (
    <ThemeProvider value={resolvedTheme}>
      <LanguageProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </LanguageProvider>
    </ThemeProvider>
  );
}
