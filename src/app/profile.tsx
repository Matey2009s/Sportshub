import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { User } from '@supabase/supabase-js';

import { SupabaseDiagnostic } from '@/components/supabase-diagnostic';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, SportHubBrandColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadUser = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        setUser(null);
        setErrorMessage(error.message);
      } else {
        setUser(data.user);
      }
    } catch {
      setUser(null);
      setErrorMessage('Не успяхме да заредим профила.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadUser();
    }, [loadUser]),
  );

  async function handleLogout() {
    setLoggingOut(true);
    setErrorMessage('');

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setUser(null);
      router.replace('/login');
    } catch {
      setErrorMessage('Изходът не бе успешен. Опитай отново.');
    } finally {
      setLoggingOut(false);
    }
  }

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Потребител';

  const initial = displayName.trim().charAt(0).toUpperCase() || 'П';

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={SportHubBrandColors.accent} size="large" />
        <ThemedText>Зареждане на профила...</ThemedText>
      </ThemedView>
    );
  }

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.guestCard}>
          <ThemedView type="backgroundElement" style={styles.avatar}>
            <ThemedText type="subtitle">П</ThemedText>
          </ThemedView>

          <ThemedText type="subtitle" style={styles.centerText}>
            Добре дошъл в SportHub
          </ThemedText>

          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.centerText}
          >
            Влез в профила си или се регистрирай, за да публикуваш и да се
            записваш за спортни събития.
          </ThemedText>

          {!!errorMessage && (
            <ThemedText style={styles.error}>{errorMessage}</ThemedText>
          )}

          <Pressable
            onPress={() => router.push('/login')}
            style={styles.primaryButton}
          >
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Вход
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push('/register')}
            style={styles.secondaryButton}
          >
            <ThemedText type="smallBold">Регистрация</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => void loadUser()}
            style={styles.textButton}
          >
            <ThemedText type="small" themeColor="textSecondary">
              Провери отново
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <ThemedView type="backgroundElement" style={styles.avatar}>
          <ThemedText type="subtitle">{initial}</ThemedText>
        </ThemedView>

        <ThemedText type="subtitle">{displayName}</ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {user.email}
        </ThemedText>
      </View>

      {!!errorMessage && (
        <ThemedText style={styles.error}>{errorMessage}</ThemedText>
      )}

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Акаунт</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Влязъл си успешно със своя Supabase акаунт.
        </ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Спортни интереси</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Можеш да добавиш предпочитаните си спортове в следваща стъпка.
        </ThemedText>
      </ThemedView>

      <Pressable
        onPress={handleLogout}
        disabled={loggingOut}
        style={[styles.logoutButton, loggingOut && styles.disabled]}
      >
        {loggingOut ? (
          <ActivityIndicator color="#F4F7F4" />
        ) : (
          <ThemedText type="smallBold" style={styles.logoutText}>
            Изход от профила
          </ThemedText>
        )}
      </Pressable>

      <SupabaseDiagnostic />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  guestCard: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#29332B',
    borderRadius: 24,
    backgroundColor: '#141915',
    alignItems: 'stretch',
    gap: Spacing.three,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.two,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  centerText: {
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: SportHubBrandColors.accent,
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryButtonText: {
    color: '#080B09',
  },
  secondaryButton: {
    backgroundColor: '#080B09',
    borderWidth: 1,
    borderColor: '#29332B',
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  textButton: {
    alignItems: 'center',
    padding: 8,
  },
  logoutButton: {
    backgroundColor: '#141915',
    borderWidth: 1,
    borderColor: '#9B4444',
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  logoutText: {
    color: '#FF8F8F',
  },
  error: {
    color: '#FF8F8F',
  },
  disabled: {
    opacity: 0.6,
  },
});