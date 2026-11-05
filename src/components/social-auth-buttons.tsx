import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/language-context';
import { supabase } from '@/lib/supabase';

type Provider = 'google' | 'apple';

async function completeAuthUrl(url: string) {
  const parsed = new URL(url);
  const providerError = parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error');
  if (providerError) throw new Error(providerError);

  const code = parsed.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    return;
  }
  throw new Error('The sign-in provider did not return a session.');
}

export function SocialAuthButtons({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const [provider, setProvider] = useState<Provider | null>(null);
  const [error, setError] = useState('');

  async function signIn(selectedProvider: Provider) {
    setProvider(selectedProvider);
    setError('');
    try {
      const redirectTo = Platform.OS === 'web'
        ? `${window.location.origin}/auth/callback`
        : Linking.createURL('auth/callback');
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: selectedProvider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (signInError) throw signInError;
      if (!data.url) throw new Error('Could not start social sign-in.');

      if (Platform.OS === 'web') {
        window.location.assign(data.url);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        await completeAuthUrl(result.url);
        const { data: auth } = await supabase.auth.getUser();
        const hasSeenWellness = Boolean(auth.user?.user_metadata?.wellness_onboarding_seen_at);
        router.replace((hasSeenWellness ? '/(tabs)' : '/wellness-onboarding') as never);
      } else {
        setError(isBg
          ? 'Входът не се върна към приложението. В Supabase → Authentication → URL Configuration добави exp://** към Redirect URLs. За Google callback използвай URL адреса /auth/v1/callback от Supabase, не localhost.'
          : 'Sign-in did not return to the app. In Supabase → Authentication → URL Configuration, add exp://** to Redirect URLs. For Google, use the /auth/v1/callback URL shown by Supabase, not localhost.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isBg ? 'Входът не бе успешен. Опитай отново.' : 'Sign-in failed. Please try again.'));
    } finally {
      setProvider(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.separator}><View style={styles.rule} /><ThemedText type="small" themeColor="textSecondary">{isBg ? 'или продължи с' : 'or continue with'}</ThemedText><View style={styles.rule} /></View>
      <View style={styles.buttons}>
        <Pressable accessibilityRole="button" accessibilityLabel={isBg ? 'Вход с Google' : 'Continue with Google'} disabled={disabled || provider !== null} onPress={() => void signIn('google')} style={[styles.button, (disabled || provider !== null) && styles.disabled]}>
          {provider === 'google' ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="logo-google" size={18} color="#FFFFFF" /><ThemedText type="smallBold" style={styles.buttonText}>Google</ThemedText></>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={isBg ? 'Вход с Apple' : 'Continue with Apple'} disabled={disabled || provider !== null} onPress={() => void signIn('apple')} style={[styles.button, styles.appleButton, (disabled || provider !== null) && styles.disabled]}>
          {provider === 'apple' ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="logo-apple" size={20} color="#FFFFFF" /><ThemedText type="smallBold" style={styles.buttonText}>Apple</ThemedText></>}
        </Pressable>
      </View>
      {!!error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 5 },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rule: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.13)' },
  buttons: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 15, borderWidth: 1, borderColor: '#3E314B', backgroundColor: '#202A26' },
  appleButton: { backgroundColor: '#0B1110' },
  buttonText: { color: '#FFFFFF' },
  error: { color: '#FF8F8F', lineHeight: 19 },
  disabled: { opacity: 0.6 },
});
