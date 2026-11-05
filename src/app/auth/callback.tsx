import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function finish() {
      try {
        const url = Platform.OS === 'web' ? window.location.href : await (await import('expo-linking')).getInitialURL();
        if (!url) throw new Error('The sign-in link is missing.');
        const parsed = new URL(url);
        const providerError = parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error');
        if (providerError) throw new Error(providerError);
        const code = parsed.searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
          const accessToken = hash.get('access_token');
          const refreshToken = hash.get('refresh_token');
          if (!accessToken || !refreshToken) throw new Error('The sign-in provider did not return a session.');
          const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessionError) throw sessionError;
        }
        const { data: auth } = await supabase.auth.getUser();
        const hasSeenWellness = Boolean(auth.user?.user_metadata?.wellness_onboarding_seen_at);
        if (active) router.replace((hasSeenWellness ? '/(tabs)' : '/wellness-onboarding') as never);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not finish signing in.');
      }
    }
    void finish();
    return () => { active = false; };
  }, [router]);

  return <View style={styles.container}>{error ? <ThemedText style={styles.error}>{error}</ThemedText> : <><ActivityIndicator color="#D7F36A" /><ThemedText>Finishing sign-in…</ThemedText></>}</View>;
}

const styles = StyleSheet.create({ container: { flex: 1, gap: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1110', padding: 24 }, error: { color: '#FF8F8F', textAlign: 'center' } });
