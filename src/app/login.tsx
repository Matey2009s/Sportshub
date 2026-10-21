
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) {
      setErrorMessage('Моля, попълни имейла и паролата.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.replace('/(tabs)');
    } catch {
      setErrorMessage('Възникна грешка. Опитай отново.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>SportHub</Text>
        <Text style={styles.subtitle}>Влез и намери своята спортна общност.</Text>

        <Text style={styles.label}>Имейл</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#849087"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={styles.input}
        />

        <Text style={styles.label}>Парола</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Въведи паролата си"
          placeholderTextColor="#849087"
          secureTextEntry
          autoComplete="current-password"
          style={styles.input}
        />

        {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
        {!!successMessage && <Text style={styles.success}>{successMessage}</Text>}

        <Pressable
          onPress={handleLogin}
          disabled={loading}
          style={[styles.button, loading && styles.disabled]}
        >
          {loading ? (
            <ActivityIndicator color="#080B09" />
          ) : (
            <Text style={styles.buttonText}>Вход</Text>
          )}
        </Pressable>

        <Pressable
          onPress={async () => {
            setErrorMessage('');
            setSuccessMessage('');

            if (!email.trim()) {
              setErrorMessage('Въведи имейла си, за да получиш линк за възстановяване.');
              return;
            }

            setLoading(true);
            const { error } = await supabase.auth.resetPasswordForEmail(
              email.trim(),
            );
            setLoading(false);

            if (error) {
              setErrorMessage(error.message);
            } else {
              setSuccessMessage('Ако имейлът е регистриран, ще получиш инструкции за възстановяване.');
            }
          }}
          style={styles.forgotButton}
          disabled={loading}
        >
          <Text style={styles.linkText}>Забравена парола?</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Нямаш профил? </Text>
          <Link href="/register" style={styles.linkText}>
            Регистрация
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080B09',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#141915',
    borderColor: '#29332B',
    borderWidth: 1,
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  brand: {
    color: '#B8FF4D',
    fontSize: 34,
    fontWeight: '800',
  },
  subtitle: {
    color: '#A1ADA4',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  label: {
    color: '#F4F7F4',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    color: '#F4F7F4',
    backgroundColor: '#080B09',
    borderWidth: 1,
    borderColor: '#29332B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#B8FF4D',
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#080B09',
    fontWeight: '800',
    fontSize: 16,
  },
  error: {
    color: '#FF8F8F',
    fontSize: 13,
    lineHeight: 19,
  },
  success: {
    color: '#B8FF4D',
    fontSize: 13,
    lineHeight: 19,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  footerText: {
    color: '#A1ADA4',
  },
  linkText: {
    color: '#B8FF4D',
    fontWeight: '700',
  },
});
