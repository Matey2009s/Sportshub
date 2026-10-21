
import GoogleLocationPicker from '@/components/google-location-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, SportHubBrandColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { createEvent } from '@/lib/supabase-services';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

const sports = [
  { label: 'Бягане', value: 'running' },
  { label: 'Колоездене', value: 'cycling' },
  { label: 'Фитнес', value: 'fitness' },
  { label: 'Групов спорт', value: 'group' },
];

const levels = [
  { label: 'Начинаещи', value: 'beginner' },
  { label: 'Средно', value: 'intermediate' },
  { label: 'Напреднали', value: 'advanced' },
];

const fieldStyle = {
  borderWidth: 1,
  borderRadius: 16,
  paddingHorizontal: 14,
  paddingVertical: 12,
  minHeight: 48,
  borderColor: '#29332B',
  backgroundColor: '#141915',
  color: '#F4F7F4',
  fontSize: 15,
} as const;

export default function CreateScreen() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [sport, setSport] = useState('running');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('beginner');
  const [capacity, setCapacity] = useState('10');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function validateForm(): string {
    if (
      !title.trim() ||
      !date.trim() ||
      !time.trim() ||
      !venue.trim()
    ) {
      return 'Попълни заглавието, датата, часа и мястото.';
    }

    const dateValue = date.trim();
    const timeValue = time.trim();

    // Формат на датата: YYYY/MM/DD
    const dateMatch = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(dateValue);

    if (!dateMatch) {
      return 'Датата трябва да е във формат ГГГГ/ММ/ДД, например 2026/12/13.';
    }

    // Формат на часа: HH:MM
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);

    if (!timeMatch) {
      return 'Часът трябва да е във формат ЧЧ:ММ, например 17:30.';
    }

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return 'Въведи валидна дата и час.';
    }

    const start = new Date(
      year,
      month - 1,
      day,
      hour,
      minute,
      0,
      0,
    );

    // Проверка за невалидни календарни дати.
    if (
      start.getFullYear() !== year ||
      start.getMonth() !== month - 1 ||
      start.getDate() !== day
    ) {
      return 'Въведи валидна дата и час.';
    }

    if (start.getTime() <= Date.now()) {
      return 'Избери дата и час в бъдещето.';
    }

    const parsedCapacity = Number(capacity);

    if (
      !Number.isInteger(parsedCapacity) ||
      parsedCapacity < 2 ||
      parsedCapacity > 10000
    ) {
      return 'Броят участници трябва да е цяло число между 2 и 10000.';
    }

    if ((latitude === null) !== (longitude === null)) {
      return 'Избери място от картата.';
    }

    if (
      latitude !== null &&
      longitude !== null &&
      (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      )
    ) {
      return 'Избраната локация не е валидна.';
    }

    return '';
  }

  async function handlePublish() {
    if (loading) return;

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        setErrorMessage(
          'За да публикуваш събитие, първо влез в профила си.',
        );
        return;
      }

      const [year, month, day] = date.trim().split('/').map(Number);
      const [hour, minute] = time.trim().split(':').map(Number);

      const start = new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        0,
        0,
      );

      // Повторна проверка непосредствено преди изпращането.
      if (
        !Number.isFinite(start.getTime()) ||
        start.getFullYear() !== year ||
        start.getMonth() !== month - 1 ||
        start.getDate() !== day ||
        start.getHours() !== hour ||
        start.getMinutes() !== minute ||
        start.getTime() <= Date.now()
      ) {
        setErrorMessage('Въведи валидна бъдеща дата и час.');
        return;
      }

      await createEvent({
        organizer_id: authData.user.id,
        title: title.trim(),
        description: description.trim() || null,
        sport_category: sport,
        starts_at: start.toISOString(),
        duration_minutes: null,
        venue: venue.trim(),
        latitude,
        longitude,
        participant_capacity: Number(capacity),
        skill_level: level,
        status: 'scheduled',
      });

      if (Platform.OS !== 'web') {
        Alert.alert('Успех', 'Събитието е публикувано.');
      }

      router.replace('/(tabs)');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Събитието не можа да бъде публикувано.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Назад"
        >
          <ThemedText type="smallBold">← Назад</ThemedText>
        </Pressable>

        <ThemedText type="subtitle" style={styles.title}>
          Създай събитие
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          Попълни информацията и посочи мястото на провеждане.
        </ThemedText>

        <View style={styles.form}>
          <ThemedText type="smallBold">Заглавие *</ThemedText>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Например: Вело излет към Витоша"
            placeholderTextColor="#9AA9A2"
            maxLength={100}
            style={fieldStyle}
          />

          <ThemedText type="smallBold">Спорт *</ThemedText>

          <View style={styles.options}>
            {sports.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => setSport(item.value)}
                style={[
                  styles.option,
                  sport === item.value && styles.optionActive,
                ]}
              >
                <ThemedText
                  type="smallBold"
                  themeColor={
                    sport === item.value ? 'text' : 'textSecondary'
                  }
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText type="smallBold">
            Дата * (ГГГГ/ММ/ДД)
          </ThemedText>

          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="2026/12/13"
            placeholderTextColor="#9AA9A2"
            keyboardType="numbers-and-punctuation"
            style={fieldStyle}
          />

          <ThemedText type="smallBold">Час * (ЧЧ:ММ)</ThemedText>

          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="18:10"
            placeholderTextColor="#9AA9A2"
            keyboardType="numbers-and-punctuation"
            style={fieldStyle}
          />

          <ThemedText type="smallBold">Място *</ThemedText>

          <TextInput
            value={venue}
            onChangeText={setVenue}
            placeholder="Например: Национален стадион"
            placeholderTextColor="#9AA9A2"
            style={fieldStyle}
            maxLength={200}
          />

          <ThemedText type="smallBold">
            Избери място на картата
          </ThemedText>

          <GoogleLocationPicker
            latitude={latitude}
            longitude={longitude}
            onSelect={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />

          <ThemedText type="small" themeColor="textSecondary">
            Натисни върху картата, за да избереш мястото.
            Координатите се запазват автоматично.
          </ThemedText>

          <ThemedText type="smallBold">Описание</ThemedText>

          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
            placeholder="Опиши активността, маршрута и какво трябва да знаят участниците."
            placeholderTextColor="#9AA9A2"
            style={[fieldStyle, styles.description]}
          />

          <ThemedText type="smallBold">Ниво</ThemedText>

          <View style={styles.options}>
            {levels.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => setLevel(item.value)}
                style={[
                  styles.option,
                  level === item.value && styles.optionActive,
                ]}
              >
                <ThemedText
                  type="smallBold"
                  themeColor={
                    level === item.value ? 'text' : 'textSecondary'
                  }
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText type="smallBold">
            Максимум участници *
          </ThemedText>

          <TextInput
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="number-pad"
            placeholder="10"
            placeholderTextColor="#9AA9A2"
            style={fieldStyle}
          />

          {!!errorMessage && (
            <ThemedView style={styles.errorBox}>
              <ThemedText type="small">{errorMessage}</ThemedText>
            </ThemedView>
          )}

          <Pressable
            onPress={handlePublish}
            disabled={loading}
            style={[styles.button, loading && styles.disabled]}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#080B09" />
            ) : (
              <ThemedText
                type="smallBold"
                style={styles.buttonText}
              >
                Публикувай събитието
              </ThemedText>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080B09',
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#29332B',
    backgroundColor: '#141915',
    marginBottom: 8,
  },
  title: {
    marginTop: Spacing.three,
  },
  form: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#29332B',
    backgroundColor: '#141915',
  },
  optionActive: {
    backgroundColor: '#B8FF4D',
    borderColor: '#B8FF4D',
  },
  description: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  errorBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#9B4444',
    padding: 12,
  },
  button: {
    marginTop: Spacing.three,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    backgroundColor: SportHubBrandColors.accent,
  },
  buttonText: {
    color: '#080B09',
  },
  disabled: {
    opacity: 0.6,
  },
});
