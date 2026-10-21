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

import GoogleLocationPicker from '@/components/google-location-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, SportHubBrandColors } from '@/constants/theme';
import { useLanguage } from '@/i18n/language-context';
import { supabase } from '@/lib/supabase';
import { createEvent } from '@/lib/supabase-services';

const fieldStyle = {
  borderWidth: 1,
  borderRadius: 16,
  paddingHorizontal: 14,
  paddingVertical: 12,
  minHeight: 48,
  borderColor: '#29332B',
  backgroundColor: '#121812',
  color: '#F4F7F4',
  fontSize: 15,
};

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
  { label: 'Всички', value: 'all' },
];

export default function CreateScreen() {
  const { t } = useLanguage();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('running');
  const [level, setLevel] = useState('all');
  const [capacity, setCapacity] = useState('10');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  async function handlePublish() {
    setErrorMessage('');

    if (!title.trim() || !venue.trim() || !date.trim() || !time.trim()) {
      setErrorMessage('Попълни заглавието, мястото, датата и часа.');
      return;
    }


    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(date)) {
      setErrorMessage('Въведи датата във формат ГГГГ/ММ/ДД, например 2026/12/22.');
      return;
    }

    if (!/^\d{2}:\d{2}$/.test(time)) {
      setErrorMessage('Въведи часа във формат ЧЧ:ММ, например 17:30.');
      return;
    }

    const start = new Date(`${date}T${time}:00`);
    const parsedCapacity = Number(capacity);

    if (
      Number.isNaN(start.getTime()) ||
      start.getFullYear() !== Number(date.slice(0, 4)) ||
      start.getMonth() + 1 !== Number(date.slice(5, 7)) ||
      start.getDate() !== Number(date.slice(8, 10)) ||
      Number(time.slice(0, 2)) > 23 ||
      Number(time.slice(3, 5)) > 59
    ) {
      setErrorMessage('Въведи валидна дата и час.');
      return;
    }

    if (start.getTime() <= Date.now()) {
      setErrorMessage('Избери дата и час в бъдещето.');
      return;
    }

    if (
      !Number.isInteger(parsedCapacity) ||
      parsedCapacity < 2 ||
      parsedCapacity > 10000
    ) {
      setErrorMessage('Броят участници трябва да е между 2 и 10000.');
      return;
    }

    const hasLat = latitude.trim() !== '';
    const hasLng = longitude.trim() !== '';

    if (hasLat !== hasLng) {
      setErrorMessage('Избери точка на картата.');
      return;
    }

    if (hasLat && hasLng) {
      const lat = Number(latitude);
      const lng = Number(longitude);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        setErrorMessage('Местоположението на картата е невалидно.');
        return;
      }
    }

    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        setErrorMessage(sessionError.message);
        return;
      }

      const currentUser = sessionData.session?.user;

      if (!currentUser) {
        setErrorMessage('Влез в профила си, за да публикуваш събитие.');
        return;
      }

      await createEvent({
        organizer_id: currentUser.id,
        title: title.trim(),
        description: description.trim() || null,
        sport_category: sport,
        starts_at: start.toISOString(),
        duration_minutes: null,
        venue: venue.trim(),
        latitude: hasLat ? Number(latitude) : null,
        longitude: hasLng ? Number(longitude) : null,
        participant_capacity: parsedCapacity,
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
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Назад"
        >
          <ThemedText type="smallBold">← Назад</ThemedText>
        </Pressable>

        <ThemedText type="subtitle" style={styles.title}>
          {t.createEvent}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          Създай спортно събитие и избери мястото му върху картата.
        </ThemedText>

        <View style={styles.form}>
          <ThemedText type="smallBold">{t.eventTitle} *</ThemedText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Например: Вело излет към Витоша"
            placeholderTextColor="#A1ADA4"
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
                  themeColor={sport === item.value ? 'text' : 'textSecondary'}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText type="smallBold">{t.location} *</ThemedText>
          <TextInput
            value={venue}
            onChangeText={setVenue}
            placeholder="Витоша, Боровец"
            placeholderTextColor="#A1ADA4"
            maxLength={200}
            style={fieldStyle}
          />

          <ThemedText type="smallBold">Избери точка на картата</ThemedText>

          <GoogleLocationPicker
            latitude={latitude.trim() ? Number(latitude) : null}
            longitude={longitude.trim() ? Number(longitude) : null}
            onSelect={(lat, lng) => {
              setLatitude(lat.toFixed(6));
              setLongitude(lng.toFixed(6));
            }}
          />

          <ThemedText type="small" themeColor="textSecondary">
            Натисни върху картата, за да избереш мястото. Координатите се
            запазват автоматично.
          </ThemedText>

          <ThemedText type="smallBold">{t.date} * (ГГГГ/ММ/ДД)</ThemedText>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="2026-12-22"
            placeholderTextColor="#A1ADA4"
            style={fieldStyle}
          />

          <ThemedText type="smallBold">{t.time} * (ЧЧ:ММ)</ThemedText>
          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="17:30"
            placeholderTextColor="#A1ADA4"
            style={fieldStyle}
          />

          <ThemedText type="smallBold">{t.description}</ThemedText>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
            placeholder="Кратко описание на активността..."
            placeholderTextColor="#A1ADA4"
            style={[fieldStyle, styles.description]}
          />

          <ThemedText type="smallBold">{t.level}</ThemedText>
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
                  themeColor={level === item.value ? 'text' : 'textSecondary'}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText type="smallBold">Максимум участници *</ThemedText>
          <TextInput
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="number-pad"
            placeholder="10"
            placeholderTextColor="#A1ADA4"
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
              <ThemedText type="smallBold" style={styles.buttonText}>
                {t.publish}
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
  },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#29332B',
    backgroundColor: '#121812',
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
    backgroundColor: '#121812',
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
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#29332B',
    backgroundColor: SportHubBrandColors.accent,
  },
  buttonText: {
    color: '#080B09',
  },
  disabled: {
    opacity: 0.6,
  },
});