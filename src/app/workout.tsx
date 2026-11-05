import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLanguage } from '@/i18n/language-context';
import { supabase } from '@/lib/supabase';
import type { TrainingLog as TrainingLogRecord } from '@/lib/supabase';


const sports = [
  { key: 'running', icon: 'walk-outline' as const, bg: 'Бягане', en: 'Run' },
  { key: 'cycling', icon: 'bicycle-outline' as const, bg: 'Колоездене', en: 'Ride' },
  { key: 'fitness', icon: 'barbell-outline' as const, bg: 'Фитнес', en: 'Gym' },
  { key: 'football', icon: 'football-outline' as const, bg: 'Футбол', en: 'Football' },
  { key: 'hiking', icon: 'trail-sign-outline' as const, bg: 'Преход', en: 'Hike' },
  { key: 'other', icon: 'flash-outline' as const, bg: 'Друго', en: 'Other' },
];

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function WorkoutScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const [userId, setUserId] = useState<string | null>(null);
  const [logs, setLogs] = useState<TrainingLogRecord[]>([]);
  const [sport, setSport] = useState('running');
  const [minutes, setMinutes] = useState('45');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      setUserId(auth.user?.id ?? null);
      if (!auth.user) { setLogs([]); return; }
      const { data, error: queryError } = await supabase.from('training_logs')
        .select('id,sport_category,duration_minutes,note,performed_at')
        .eq('user_id', auth.user.id).order('performed_at', { ascending: false }).limit(40);
      if (queryError) throw queryError;
      setLogs((data ?? []) as TrainingLogRecord[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isBg ? 'Тренировките не се заредиха.' : 'Could not load your training log.'));
    } finally {
      setLoading(false);
    }
  }, [isBg]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const weekStats = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const startKey = localDateKey(start);
    const week = logs.filter((log) => log.performed_at >= startKey && log.performed_at <= localDateKey(today));
    const dates = new Set(logs.map((log) => log.performed_at));
    let streak = 0;
    const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!dates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (dates.has(localDateKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    return { sessions: week.length, minutes: week.reduce((sum, log) => sum + log.duration_minutes, 0), streak };
  }, [logs]);

  async function saveWorkout() {
    if (!userId) { router.push('/login'); return; }
    const parsedMinutes = Number(minutes);
    if (!Number.isInteger(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 600) {
      setError(isBg ? 'Въведи време от 1 до 600 минути.' : 'Enter a duration from 1 to 600 minutes.');
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const { error: insertError } = await supabase.from('training_logs').insert({
        user_id: userId,
        sport_category: sport,
        duration_minutes: parsedMinutes,
        note: note.trim() || null,
        performed_at: localDateKey(),
      });
      if (insertError) throw insertError;
      setNote('');
      setSaved(true);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isBg ? 'Тренировката не можа да се запише.' : 'Could not save this session.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.back} accessibilityRole="button"><Ionicons name="arrow-back" size={18} color="#EAF2E9" /><ThemedText type="smallBold">{isBg ? 'Назад' : 'Back'}</ThemedText></Pressable>
        <View style={styles.heading}><ThemedText type="smallBold" style={styles.eyebrow}>{isBg ? 'ДВИЖЕНИЕТО СЕ НАТРУПВА' : 'EVERY SESSION COUNTS'}</ThemedText><ThemedText type="title" style={styles.title}>{isBg ? 'Дневник' : 'Training log'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Запиши тренировката. Виж колко си постоянен.' : 'Log a session. See your consistency grow.'}</ThemedText></View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statMain]}><Ionicons name="barbell" size={18} color="#0B1110" /><ThemedText type="title" style={styles.statNumber}>{weekStats.sessions}</ThemedText><ThemedText type="smallBold" style={styles.statLabel}>{isBg ? 'тренировки тази седмица' : 'sessions this week'}</ThemedText></View>
          <View style={styles.statStack}><View style={styles.smallStat}><Ionicons name="time-outline" size={17} color="#D7F36A" /><View><ThemedText type="subtitle" style={styles.smallNumber}>{weekStats.minutes}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'минути' : 'minutes'}</ThemedText></View></View><View style={styles.smallStat}><Ionicons name="flame-outline" size={17} color="#FF9B70" /><View><ThemedText type="subtitle" style={styles.smallNumber}>{weekStats.streak}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'дни серия' : 'day streak'}</ThemedText></View></View></View>
        </View>

        {!userId && !loading ? <Pressable onPress={() => router.push('/login')} style={styles.signIn}><Ionicons name="person-circle-outline" size={21} color="#D7F36A" /><ThemedText type="smallBold">{isBg ? 'Влез, за да пазиш тренировките си' : 'Sign in to save your sessions'}</ThemedText><Ionicons name="arrow-forward" size={16} color="#D7F36A" /></Pressable> : <View style={styles.form}>
          <View style={styles.formTitle}><View style={styles.formIcon}><Ionicons name="add" size={20} color="#0B1110" /></View><View><ThemedText type="subtitle" style={styles.formHeading}>{isBg ? 'Запиши тренировка' : 'Log a session'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Какво направи днес?' : 'What did you do today?'}</ThemedText></View></View>
          <View style={styles.sportGrid}>{sports.map((item) => <Pressable key={item.key} onPress={() => setSport(item.key)} accessibilityRole="button" accessibilityState={{ selected: sport === item.key }} style={[styles.sportChip, sport === item.key && styles.sportChipActive]}><Ionicons name={item.icon} size={17} color={sport === item.key ? '#0B1110' : '#D7F36A'} /><ThemedText type="smallBold" style={sport === item.key ? styles.sportTextActive : undefined}>{isBg ? item.bg : item.en}</ThemedText></Pressable>)}</View>
          <ThemedText type="smallBold">{isBg ? 'Продължителност' : 'Duration'}</ThemedText>
          <View style={styles.durationRow}><TextInput value={minutes} onChangeText={setMinutes} keyboardType="number-pad" maxLength={3} style={styles.minutesInput} /><ThemedText type="small" themeColor="textSecondary">{isBg ? 'минути' : 'minutes'}</ThemedText><View style={styles.durationPresets}>{['30','45','60'].map((value) => <Pressable key={value} onPress={() => setMinutes(value)} style={[styles.preset, minutes === value && styles.presetActive]}><ThemedText type="smallBold" style={minutes === value ? styles.presetTextActive : undefined}>{value}</ThemedText></Pressable>)}</View></View>
          <TextInput value={note} onChangeText={setNote} placeholder={isBg ? 'Кратка бележка (по желание)' : 'Add a note (optional)'} placeholderTextColor="#87948A" style={styles.noteInput} maxLength={240} />
          {!!error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
          {saved ? <ThemedText type="smallBold" style={styles.saved}>{isBg ? 'Записано. Браво за постоянството!' : 'Saved. Nice work showing up!'}</ThemedText> : null}
          <Pressable onPress={() => void saveWorkout()} disabled={saving || loading} accessibilityRole="button" style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, (saving || loading) && styles.disabled]}>{saving ? <ActivityIndicator color="#0B1110" /> : <><Ionicons name="checkmark-circle-outline" size={19} color="#0B1110" /><ThemedText type="smallBold" style={styles.saveText}>{isBg ? 'Запиши тренировката' : 'Save session'}</ThemedText></>}</Pressable>
        </View>}

        <View style={styles.historyHeader}><ThemedText type="subtitle" style={styles.historyTitle}>{isBg ? 'Последни тренировки' : 'Recent sessions'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{logs.length}</ThemedText></View>
        {loading ? <ActivityIndicator color="#D7F36A" /> : logs.length ? logs.slice(0, 12).map((log) => {
          const activity = sports.find((item) => item.key === log.sport_category);
          return <View key={log.id} style={styles.logRow}><View style={styles.logIcon}><Ionicons name={activity?.icon ?? 'fitness-outline'} size={19} color="#D7F36A" /></View><View style={styles.logCopy}><ThemedText type="smallBold">{activity?.[isBg ? 'bg' : 'en'] ?? log.sport_category}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{log.note || new Date(`${log.performed_at}T12:00:00`).toLocaleDateString(isBg ? 'bg-BG' : 'en-GB', { day: 'numeric', month: 'short' })}</ThemedText></View><ThemedText type="smallBold" style={styles.logMinutes}>{log.duration_minutes} {isBg ? 'мин' : 'min'}</ThemedText></View>;
        }) : !loading && userId ? <View style={styles.empty}><Ionicons name="footsteps-outline" size={26} color="#D7F36A" /><ThemedText type="smallBold">{isBg ? 'Първата тренировка започва с теб.' : 'Your first session starts here.'}</ThemedText></View> : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1110' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingTop: 18, paddingBottom: 140, gap: 18 },
  back: { minHeight: 40, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, paddingHorizontal: 11, borderRadius: 99, backgroundColor: '#151D1B' },
  heading: { gap: 5, paddingVertical: 4 },
  eyebrow: { color: '#D7F36A', fontSize: 10, letterSpacing: 1.5 },
  title: { fontSize: 36, lineHeight: 43 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { borderRadius: 21, padding: 16 },
  statMain: { flex: 1.1, minHeight: 148, justifyContent: 'space-between', backgroundColor: '#D7F36A' },
  statNumber: { color: '#0B1110', fontSize: 38 },
  statLabel: { color: '#26321D', maxWidth: 150, lineHeight: 17 },
  statStack: { flex: 1, gap: 10 },
  smallStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 19, backgroundColor: '#151D1B', borderWidth: 1, borderColor: '#2D3932' },
  smallNumber: { fontSize: 21 },
  form: { padding: 17, gap: 13, borderRadius: 24, backgroundColor: '#151D1B', borderWidth: 1, borderColor: '#2D3932' },
  formTitle: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 2 },
  formIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#D7F36A' },
  formHeading: { fontSize: 18 },
  sportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sportChip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#202A26', borderWidth: 1, borderColor: '#2D3932' },
  sportChipActive: { backgroundColor: '#D7F36A', borderColor: '#D7F36A' },
  sportTextActive: { color: '#0B1110' },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  minutesInput: { width: 74, height: 46, paddingHorizontal: 12, borderRadius: 13, backgroundColor: '#0B1110', borderWidth: 1, borderColor: '#2D3932', color: '#FFFFFF', fontSize: 19, fontWeight: '700', textAlign: 'center' },
  durationPresets: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  preset: { minWidth: 39, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#202A26' },
  presetActive: { backgroundColor: '#D7F36A' },
  presetTextActive: { color: '#0B1110' },
  noteInput: { minHeight: 46, paddingHorizontal: 13, borderRadius: 13, backgroundColor: '#0B1110', borderWidth: 1, borderColor: '#2D3932', color: '#FFFFFF' },
  saveButton: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, backgroundColor: '#D7F36A' },
  saveText: { color: '#0B1110' },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.55 },
  error: { color: '#FF9A9A' },
  saved: { color: '#D7F36A' },
  signIn: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: '#151D1B', borderWidth: 1, borderColor: '#2D3932' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  historyTitle: { fontSize: 20 },
  logRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, borderRadius: 16, backgroundColor: '#151D1B', borderWidth: 1, borderColor: '#25302B' },
  logIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(215,243,106,0.1)' },
  logCopy: { flex: 1, gap: 2 },
  logMinutes: { color: '#D7F36A' },
  empty: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 18, backgroundColor: '#151D1B' },
});
