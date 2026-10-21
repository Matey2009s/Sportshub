
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

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage('Попълни името, имейла и паролата.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Паролата трябва да е поне 6 символа.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: name.trim(),
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        router.replace('/(tabs)');
      } else {
        setSuccessMessage(
          'Регистрацията е приета. Провери имейла си за линк за потвърждение, ако се изисква.',
        );
      }
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
        <Text style={styles.subtitle}>
          Създай профил и се включи в следващото спортно събитие.
        </Text>

        <Text style={styles.label}>Име</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Твоето име"
          placeholderTextColor="#849087"
          autoCapitalize="words"
          autoComplete="name"
          style={styles.input}
        />

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
          placeholder="Поне 6 символа"
          placeholderTextColor="#849087"
          secureTextEntry
          autoComplete="new-password"
          style={styles.input}
        />

        {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
        {!!successMessage && (
          <Text style={styles.success}>{successMessage}</Text>
        )}

        <Pressable
          onPress={handleRegister}
          disabled={loading}
          style={[styles.button, loading && styles.disabled]}
        >
          {loading ? (
            <ActivityIndicator color="#080B09" />
          ) : (
            <Text style={styles.buttonText}>Създай профил</Text>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Вече имаш профил? </Text>
          <Link href="/login" style={styles.linkText}>
            Вход
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
