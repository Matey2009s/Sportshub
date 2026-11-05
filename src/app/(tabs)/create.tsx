import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { Image } from 'expo-image';
import type { ImagePickerAsset } from 'expo-image-picker';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { SportHubBrandColors } from '@/constants/theme';
import { useLanguage } from '@/i18n/language-context';
import { pickPhotos, uploadPhoto } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { createEvent } from '@/lib/supabase-services';

const sports = [
  { value: 'running', bg: 'Бягане', en: 'Running', icon: 'walk' as const },
  { value: 'cycling', bg: 'Колоездене', en: 'Cycling', icon: 'bicycle' as const },
  { value: 'fitness', bg: 'Фитнес', en: 'Fitness', icon: 'fitness' as const },
  { value: 'group', bg: 'Групов спорт', en: 'Group', icon: 'people' as const },
  { value: 'custom', bg: 'Друг спорт', en: 'Other sport', icon: 'add-circle-outline' as const },
];

const levels = [
  { value: 'beginner', bg: 'Начинаещи', en: 'Beginner' },
  { value: 'intermediate', bg: 'Средно', en: 'Intermediate' },
  { value: 'advanced', bg: 'Напреднали', en: 'Advanced' },
];

const fieldStyle = {
  minHeight: 54,
  borderWidth: 1,
  borderRadius: 16,
  borderColor: 'rgba(221,235,225,0.12)',
  backgroundColor: 'rgba(255,255,255,0.045)',
  paddingHorizontal: 16,
  paddingVertical: 14,
  color: '#FFFFFF',
  fontSize: 16,
} as const;

function GlassPanel({ children, style }: React.PropsWithChildren<{ style?: object }>) {
  const supportsLiquidGlass = Platform.OS === 'ios' && Number(Platform.Version) >= 26;
  const panelStyle = [styles.panel, supportsLiquidGlass ? styles.glassPanel : styles.solidPanel, style];
  if (supportsLiquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" tintColor="rgba(215,243,106,0.12)" style={panelStyle}>
        {children}
      </GlassView>
    );
  }
  return <View style={panelStyle}>{children}</View>;
}

export default function CreateScreen() {
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('running');
  const [level, setLevel] = useState('beginner');
  const [capacity, setCapacity] = useState('10');
  const [eventPhotos, setEventPhotos] = useState<ImagePickerAsset[]>([]);
  const [customSport, setCustomSport] = useState('');
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handlePublish() {
    if (loading) return;
    setErrorMessage('');

    if (!title.trim() || !venue.trim() || !date.trim() || !time.trim()) {
      setErrorMessage(isBg ? 'Попълни заглавие, място, дата и час.' : 'Add a title, location, date, and time.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      setErrorMessage(isBg ? 'Използвай дата ГГГГ-ММ-ДД и час ЧЧ:ММ.' : 'Use date YYYY-MM-DD and time HH:MM.');
      return;
    }

    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const startsAt = new Date(year, month - 1, day, hour, minute);
    if (
      startsAt.getFullYear() !== year || startsAt.getMonth() !== month - 1 ||
      startsAt.getDate() !== day || hour > 23 || minute > 59 || startsAt.getTime() <= Date.now()
    ) {
      setErrorMessage(isBg ? 'Избери валидна дата и час в бъдещето.' : 'Choose a valid date and time in the future.');
      return;
    }

    const parsedCapacity = Number(capacity);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 2 || parsedCapacity > 10000) {
      setErrorMessage(isBg ? 'Капацитетът трябва да е цяло число между 2 и 10 000.' : 'Capacity must be a whole number between 2 and 10,000.');
      return;
    }
    if (latitude === null || longitude === null) {
      setErrorMessage(isBg ? 'Избери точка на картата, за да могат участниците да намерят мястото.' : 'Select a point on the map so participants can find the location.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error(isBg ? 'Влез в профила си, за да създадеш събитие.' : 'Sign in to create an event.');

      if (sport === 'custom' && !customSport.trim()) throw new Error(isBg ? 'Въведи име на спорта.' : 'Enter the sport name.');
      const imageUrls = await Promise.all(eventPhotos.map((photo) => uploadPhoto(photo.uri, data.user.id, 'events', photo.mimeType)));

      const event = await createEvent({
        organizer_id: data.user.id,
        title: title.trim(),
        description: description.trim() || null,
        sport_category: sport === 'custom' ? customSport.trim().replace(/\s+/g, ' ').slice(0, 40) : sport,
        starts_at: startsAt.toISOString(),
        duration_minutes: null,
        venue: venue.trim(),
        image_url: imageUrls[0] ?? null,
        image_urls: imageUrls,
        latitude,
        longitude,
        participant_capacity: parsedCapacity,
        skill_level: level,
        status: 'scheduled',
      });
      router.replace(`/event/${event.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : (isBg ? 'Събитието не можа да се публикува.' : 'Could not publish the event.'));
    } finally {
      setLoading(false);
    }
  }

  async function chooseEventPhotos() {
    if (pickingPhoto) return;
    setPickingPhoto(true);
    setErrorMessage('');
    try {
      const remaining = 8 - eventPhotos.length;
      if (remaining <= 0) return;
      const images = await pickPhotos(remaining);
      if (images.length) setEventPhotos((current) => [...current, ...images].slice(0, 8));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : (isBg ? 'Снимката не може да бъде отворена.' : 'Could not open the photo library.'));
    } finally {
      setPickingPhoto(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} accessibilityRole="button" style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            <ThemedText type="smallBold">{isBg ? 'Назад' : 'Back'}</ThemedText>
          </Pressable>

          <View style={styles.heading}>
            <ThemedText type="smallBold" style={styles.eyebrow}>{isBg ? 'СЪБЕРИ СЕ С ХОРА' : 'MEET UP OUTSIDE'}</ThemedText>
            <ThemedText type="subtitle" style={styles.title}>{isBg ? 'Ново събитие' : 'New event'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Избери активност, място и час. Останалото ще намерим заедно.' : 'Choose an activity, place, and time. We’ll take it from there.'}</ThemedText>
          </View>

          <GlassPanel style={styles.formPanel}>
            <View style={styles.sectionHeading}>
              <View style={styles.step}><ThemedText type="smallBold" style={styles.stepText}>01</ThemedText></View>
              <View><ThemedText type="smallBold">{isBg ? 'Основна информация' : 'Event details'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Какво и кога?' : 'What and when?'}</ThemedText></View>
            </View>

            <FieldLabel>{isBg ? 'Заглавие' : 'Event name'}</FieldLabel>
            <TextInput value={title} onChangeText={setTitle} placeholder={isBg ? 'Напр. Велоразходка във Витоша' : 'e.g. Sunday trail run'} placeholderTextColor="#929D94" maxLength={100} style={styles.input} returnKeyType="next" />

            <FieldLabel>{isBg ? 'Снимки на събитието (до 8)' : 'Event photos (up to 8)'}</FieldLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
              {eventPhotos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.photoThumbWrap}><Image source={{ uri: photo.uri }} style={styles.photoThumb} contentFit="cover" /><Pressable accessibilityRole="button" accessibilityLabel={isBg ? 'Премахни снимка' : 'Remove photo'} onPress={() => setEventPhotos((current) => current.filter((_, i) => i !== index))} style={styles.removeThumb}><Ionicons name="close" size={17} color="#FFFFFF" /></Pressable>{index === 0 ? <View style={styles.coverBadge}><ThemedText type="smallBold" style={styles.coverBadgeText}>{isBg ? 'Обложка' : 'Cover'}</ThemedText></View> : null}</View>)}
              {eventPhotos.length < 8 ? <Pressable disabled={pickingPhoto} onPress={() => void chooseEventPhotos()} style={({ pressed }) => [styles.addPhotoTile, pressed && styles.photoPickerPressed]} accessibilityRole="button">{pickingPhoto ? <ActivityIndicator color="#D7F36A" /> : <Ionicons name="add" size={28} color="#D7F36A" />}<ThemedText type="smallBold">{isBg ? 'Добави' : 'Add photos'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{eventPhotos.length}/8</ThemedText></Pressable> : null}
            </ScrollView>

            <FieldLabel>{isBg ? 'Спорт' : 'Sport'}</FieldLabel>
            <View style={styles.chipGrid}>
              {sports.map((item) => {
                const active = sport === item.value;
                return <Pressable key={item.value} onPress={() => setSport(item.value)} style={[styles.sportChip, active && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                  <Ionicons name={item.icon} size={18} color={active ? '#0B1110' : '#D7F36A'} />
                  <ThemedText type="smallBold" style={active ? styles.activeChipText : undefined}>{isBg ? item.bg : item.en}</ThemedText>
                </Pressable>;
              })}
            </View>
            {sport === 'custom' ? <TextInput value={customSport} onChangeText={setCustomSport} placeholder={isBg ? 'Напр. Катерене или рафтинг' : 'e.g. Climbing or rafting'} placeholderTextColor="#929D94" maxLength={40} style={styles.input} accessibilityLabel={isBg ? 'Име на спорта' : 'Sport name'} /> : null}

            <View style={styles.row}>
              <View style={styles.halfField}>
                <FieldLabel>{isBg ? 'Дата' : 'Date'}</FieldLabel>
                <TextInput value={date} onChangeText={setDate} placeholder="2026-12-22" placeholderTextColor="#929D94" keyboardType="numbers-and-punctuation" style={styles.input} />
              </View>
              <View style={styles.halfField}>
                <FieldLabel>{isBg ? 'Час' : 'Time'}</FieldLabel>
                <TextInput value={time} onChangeText={setTime} placeholder="17:30" placeholderTextColor="#929D94" keyboardType="numbers-and-punctuation" style={styles.input} />
              </View>
            </View>

            <View style={styles.divider} />
            <View style={styles.sectionHeading}>
              <View style={styles.step}><ThemedText type="smallBold" style={styles.stepText}>02</ThemedText></View>
              <View><ThemedText type="smallBold">{isBg ? 'Място на срещата' : 'Meeting point'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Постави точен маркер на картата' : 'Drop a pin on the map'}</ThemedText></View>
            </View>
            <FieldLabel>{isBg ? 'Име на мястото' : 'Location name'}</FieldLabel>
            <GoogleLocationPicker
              venue={venue}
              onVenueChange={(value) => {
                setVenue(value);
                setLatitude(null);
                setLongitude(null);
              }}
              latitude={latitude}
              longitude={longitude}
              onSelect={(lat, lng, address) => {
                if (address) setVenue(address);
                setLatitude(lat);
                setLongitude(lng);
              }}
            />
            <View style={styles.coordinateRow}>
              <Ionicons name={latitude === null ? 'location-outline' : 'checkmark-circle'} size={16} color={latitude === null ? '#ACB6AD' : '#D7F36A'} />
              <ThemedText type="small" themeColor="textSecondary">
                {latitude === null ? (isBg ? 'Натисни картата, за да поставиш маркер.' : 'Tap the map to drop a pin.') : `${latitude.toFixed(5)}, ${longitude?.toFixed(5)}`}
              </ThemedText>
            </View>

            <View style={styles.divider} />
            <View style={styles.sectionHeading}>
              <View style={styles.step}><ThemedText type="smallBold" style={styles.stepText}>03</ThemedText></View>
              <View><ThemedText type="smallBold">{isBg ? 'За участниците' : 'For participants'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Добави контекст и размер на групата' : 'Add context and group size'}</ThemedText></View>
            </View>
            <FieldLabel>{isBg ? 'Описание' : 'Description'}</FieldLabel>
            <TextInput value={description} onChangeText={setDescription} multiline maxLength={2000} placeholder={isBg ? 'Какво да носят участниците? Какво е темпото?' : 'What should people bring? What’s the pace?'} placeholderTextColor="#929D94" style={[styles.input, styles.description]} />
            <FieldLabel>{isBg ? 'Ниво' : 'Skill level'}</FieldLabel>
            <View style={styles.levelRow}>
              {levels.map((item) => <Pressable key={item.value} onPress={() => setLevel(item.value)} style={[styles.levelChip, level === item.value && styles.levelChipActive]} accessibilityRole="button" accessibilityState={{ selected: level === item.value }}><ThemedText type="smallBold" style={level === item.value ? styles.activeChipText : styles.mutedText}>{isBg ? item.bg : item.en}</ThemedText></Pressable>)}
            </View>
            <FieldLabel>{isBg ? 'Максимум участници' : 'Participant limit'}</FieldLabel>
            <TextInput value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholder="10" placeholderTextColor="#929D94" style={styles.input} />

            {!!errorMessage && <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={18} color="#FF7777" /><ThemedText type="small" style={styles.errorText}>{errorMessage}</ThemedText></View>}

            <Pressable onPress={handlePublish} disabled={loading} accessibilityRole="button" style={({ pressed }) => [styles.publishButton, pressed && styles.pressed, loading && styles.disabled]}>
              {loading ? <ActivityIndicator color="#0B1110" /> : <><ThemedText type="smallBold" style={styles.publishText}>{isBg ? 'Публикувай събитието' : 'Publish event'}</ThemedText><Ionicons name="arrow-forward" size={18} color="#0B1110" /></>}
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>{isBg ? 'Координатите ще се показват на участниците в детайлите на събитието.' : 'The map pin will appear on your event details.'}</ThemedText>
          </GlassPanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ children }: React.PropsWithChildren) {
  return <ThemedText type="smallBold" style={styles.fieldLabel}>{children}</ThemedText>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1110' },
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 220, gap: 24 },
  backButton: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  heading: { gap: 8, paddingTop: 4 },
  eyebrow: { color: '#D7F36A', letterSpacing: 1.5, fontSize: 11 },
  title: { fontSize: 34, lineHeight: 40 },
  panel: { borderRadius: 28, padding: 20, gap: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  glassPanel: { backgroundColor: 'transparent' },
  solidPanel: { backgroundColor: '#151D1B' },
  formPanel: { gap: 14 },
  sectionHeading: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 2 },
  step: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(215,243,106,0.12)', alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#D7F36A' },
  fieldLabel: { marginTop: 5 },
  input: { ...fieldStyle },
  photoPicker: { minHeight: 170, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#654D7C', backgroundColor: 'rgba(215,243,106,0.07)' },
  photoPickerPressed: { borderColor: '#D7F36A', backgroundColor: 'rgba(215,243,106,0.14)' },
  photoStrip: { gap: 10, paddingVertical: 2 },
  photoThumbWrap: { width: 126, height: 126, position: 'relative' },
  photoThumb: { width: 126, height: 126, borderRadius: 18, backgroundColor: '#202A26' },
  removeThumb: { position: 'absolute', top: 7, right: 7, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,10,20,0.78)' },
  coverBadge: { position: 'absolute', left: 7, bottom: 7, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(13,10,20,0.78)' },
  coverBadgeText: { color: '#FFFFFF', fontSize: 10 },
  addPhotoTile: { width: 126, height: 126, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#654D7C', backgroundColor: 'rgba(215,243,106,0.07)' },
  photoPlaceholder: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 8 },
  removePhoto: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 5 },
  removePhotoText: { color: '#FF8F8F' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1, gap: 10 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  sportChip: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(221,235,225,0.12)' },
  chipActive: { backgroundColor: SportHubBrandColors.accent, borderColor: SportHubBrandColors.accent },
  activeChipText: { color: '#0B1110' },
  mutedText: { color: '#ACB6AD' },
  divider: { height: 1, backgroundColor: 'rgba(221,235,225,0.10)', marginVertical: 5 },
  coordinateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  description: { minHeight: 112, textAlignVertical: 'top' },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelChip: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(221,235,225,0.14)', backgroundColor: 'rgba(255,255,255,0.035)' },
  levelChipActive: { borderColor: 'rgba(215,243,106,0.55)', backgroundColor: 'rgba(215,243,106,0.12)' },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: 14, backgroundColor: 'rgba(255,100,100,0.10)', borderWidth: 1, borderColor: 'rgba(255,100,100,0.24)' },
  errorText: { color: '#FFB0B0', flex: 1 },
  publishButton: { minHeight: 56, marginTop: 5, borderRadius: 17, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: SportHubBrandColors.accent },
  publishText: { color: '#0B1110' },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.9 },
  disabled: { opacity: 0.65 },
  footnote: { textAlign: 'center', paddingHorizontal: 10 },
});
