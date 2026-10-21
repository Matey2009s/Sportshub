
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
        setErrorMessage('Не успяхме да заредим профила. Опитай да влезеш отново.');
      } else {
        setUser(data.user);
      }
    } catch {
      setUser(null);
      setErrorMessage('Възникна грешка при зареждането на профила.');
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
      setErrorMessage('Не успяхме да излезем от профила.');
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator
          size="large"
          color={SportHubBrandColors.accent}
        />
        <ThemedText>Зареждане на профила...</ThemedText>
      </ThemedView>
    );
  }

  if (!user) {
    return (
      <ScrollView contentContainerStyle={styles.guestContainer}>
        <ThemedView type="backgroundElement" style={styles.guestCard}>
          <ThemedView type="backgroundElement" style={styles.avatar}>
            <ThemedText type="subtitle">S</ThemedText>
          </ThemedView>

          <ThemedText type="subtitle" style={styles.centerText}>
            Добре дошъл в SportHub
          </ThemedText>

          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.centerText}
          >
            Влез в профила си или създай нов, за да участваш в спортни събития.
          </ThemedText>

          {!!errorMessage && (
            <ThemedText style={styles.error}>{errorMessage}</ThemedText>
          )}

          <Pressable
            onPress={() => router.push('/login')}
            style={styles.primaryButton}
            accessibilityRole="button"
          >
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Вход
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push('/register')}
            style={styles.secondaryButton}
            accessibilityRole="button"
          >
            <ThemedText type="smallBold">Регистрация</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => void loadUser()}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <ThemedText type="small" themeColor="textSecondary">
              Провери отново
            </ThemedText>
          </Pressable>
        </ThemedView>

        <SupabaseDiagnostic />
      </ScrollView>
    );
  }

  const metadataName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name;

  const displayName =
    typeof metadataName === 'string' && metadataName.trim()
      ? metadataName.trim()
      : user.email?.split('@')[0] || 'Потребител';

  const initial = displayName.charAt(0).toUpperCase() || 'S';

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

        {!!user.email && (
          <ThemedText type="small" themeColor="textSecondary">
            {user.email}
          </ThemedText>
        )}
      </View>

      {!!errorMessage && (
        <ThemedText style={styles.error}>{errorMessage}</ThemedText>
      )}

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Акаунт</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Профилът е свързан с твоя реален акаунт.
        </ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Спортни интереси</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Настрой предпочитаните си спортове в следваща стъпка.
        </ThemedText>
      </ThemedView>

      <Pressable
        onPress={handleLogout}
        disabled={loggingOut}
        style={[styles.logoutButton, loggingOut && styles.disabled]}
        accessibilityRole="button"
      >
        {loggingOut ? (
          <ActivityIndicator color="#FF8F8F" />
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
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  guestContainer: {
    flexGrow: 1,
    justifyContent: 'center',
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
    padding: Spacing.four,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#29332B',
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
    borderWidth: 1,
    borderColor: '#29332B',
  },
  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: '#29332B',
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
  retryButton: {
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
