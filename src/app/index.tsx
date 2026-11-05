import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

export default function AppIndexRedirect() {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) { router.replace('/(tabs)'); return; }
      const hasSeenWellness = Boolean(data.user.user_metadata?.wellness_onboarding_seen_at);
      router.replace((hasSeenWellness ? '/(tabs)' : '/wellness-onboarding') as never);
    }).catch(() => { if (active) router.replace('/(tabs)'); });
    return () => { active = false; };
  }, [router]);

  return <View style={styles.container}><ActivityIndicator color="#D7F36A"/><ThemedText type="small">SportHub</ThemedText></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0B1110' } });