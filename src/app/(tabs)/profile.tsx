import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { User } from '@supabase/supabase-js';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, SportHubBrandColors } from '@/constants/theme';
import { useLanguage } from '@/i18n/language-context';
import { pickPhoto, uploadPhoto } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { fetchProfile, upsertProfile } from '@/lib/supabase-services';

const SPORTS = [
  { key: 'running', en: 'Running', bg: 'Бягане', icon: 'walk-outline' as const },
  { key: 'football', en: 'Football', bg: 'Футбол', icon: 'football-outline' as const },
  { key: 'basketball', en: 'Basketball', bg: 'Баскетбол', icon: 'basketball-outline' as const },
  { key: 'cycling', en: 'Cycling', bg: 'Колоездене', icon: 'bicycle-outline' as const },
  { key: 'fitness', en: 'Fitness', bg: 'Фитнес', icon: 'barbell-outline' as const },
  { key: 'tennis', en: 'Tennis', bg: 'Тенис', icon: 'tennisball-outline' as const },
  { key: 'volleyball', en: 'Volleyball', bg: 'Волейбол', icon: 'radio-button-on-outline' as const },
  { key: 'hiking', en: 'Hiking', bg: 'Планински преходи', icon: 'trail-sign-outline' as const },
];
const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const glassAvailable = Platform.OS === 'ios' && Number(Platform.Version) >= 26;

function ProfileCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const cardStyle = [styles.card, glassAvailable ? styles.glassCard : styles.solidCard, style];
  if (glassAvailable) {
    return <GlassView glassEffectStyle="regular" tintColor="rgba(215,243,106,0.12)" style={cardStyle}>{children}</GlassView>;
  }
  return <ThemedView type="backgroundElement" style={cardStyle}>{children}</ThemedView>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [biography, setBiography] = useState('');
  const [locationName, setLocationName] = useState('');
  const [skillLevel, setSkillLevel] = useState<(typeof LEVELS)[number]>('beginner');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [avatarAsset, setAvatarAsset] = useState<ImagePickerAsset | null>(null);
  const [coverAsset, setCoverAsset] = useState<ImagePickerAsset | null>(null);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');

  const loadUser = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      setUser(data.user);
      if (data.user) {
        const { data: moderatorStatus, error: moderatorError } = await supabase.rpc('is_sporthub_moderator');
        setIsModerator(!moderatorError && moderatorStatus === true);
        const profile = await fetchProfile(data.user.id);
        setDisplayName(profile?.display_name || String(data.user.user_metadata?.display_name || data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || ''));
        setBiography(profile?.biography ?? '');
        setLocationName(profile?.location ?? '');
        setSkillLevel(LEVELS.includes(profile?.skill_level as (typeof LEVELS)[number]) ? profile?.skill_level as (typeof LEVELS)[number] : 'beginner');
        const metadataAvatar = data.user.user_metadata?.avatar_url ?? data.user.user_metadata?.picture;
        setAvatarUrl(profile?.avatar_url ?? (typeof metadataAvatar === 'string' ? metadataAvatar : null));
        setCoverUrl(profile?.cover_url ?? null);
        setInterests(profile?.favorite_sports ?? []);
        setAvatarAsset(null);
        setCoverAsset(null);
      } else {
        setIsModerator(false);
        setInterests([]);
      }
    } catch (error) {
      setUser(null);
      setErrorMessage(error instanceof Error ? error.message : (isBg ? 'Не успяхме да заредим профила.' : 'Could not load your profile.'));
    } finally {
      setLoading(false);
    }
  }, [isBg]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useFocusEffect(useCallback(() => { setEditing(false); void loadUser(); }, [loadUser]));

  const toggleInterest = (key: string) => {
    setNotice('');
    setInterests((current) => current.some((item) => item.toLowerCase() === key.toLowerCase())
      ? current.filter((item) => item.toLowerCase() !== key.toLowerCase())
      : [...current, key]);
  };

  const addCustomInterest = () => {
    const value = customInterest.trim().replace(/\s+/g, ' ');
    if (!value || interests.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    setInterests((current) => [...current, value]);
    setCustomInterest('');
    setNotice('');
  };

  async function chooseAvatar() {
    if (pickingAvatar) return;
    setPickingAvatar(true);
    setErrorMessage('');
    try {
      const image = await pickPhoto([1, 1]);
      if (image) { setAvatarAsset(image); setNotice(''); }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : (isBg ? 'Снимката не може да бъде отворена.' : 'Could not open the photo library.'));
    } finally {
      setPickingAvatar(false);
    }
  }

  async function chooseCover() {
    if (pickingAvatar) return;
    setPickingAvatar(true);
    setErrorMessage('');
    try {
      const image = await pickPhoto([16, 7]);
      if (image) { setCoverAsset(image); setNotice(''); }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not open the photo library.');
    } finally {
      setPickingAvatar(false);
    }
  }

  async function saveProfile() {
    if (!user) return;
    if (!displayName.trim()) { setErrorMessage(isBg ? 'Името не може да бъде празно.' : 'Your name cannot be empty.'); return; }
    setSaving(true);
    setErrorMessage('');
    setNotice('');
    try {
      const nextAvatar = avatarAsset ? await uploadPhoto(avatarAsset.uri, user.id, 'profiles', avatarAsset.mimeType) : avatarUrl;
      const nextCover = coverAsset ? await uploadPhoto(coverAsset.uri, user.id, 'profiles', coverAsset.mimeType) : coverUrl;
      await upsertProfile({
        id: user.id,
        display_name: displayName.trim(),
        avatar_url: nextAvatar,
        cover_url: nextCover,
        biography: biography.trim() || null,
        location: locationName.trim() || null,
        skill_level: skillLevel,
        favorite_sports: interests,
      });
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName.trim(), avatar_url: nextAvatar } });
      if (error) throw error;
      setAvatarUrl(nextAvatar);
      setCoverUrl(nextCover);
      setAvatarAsset(null);
      setCoverAsset(null);
      setNotice(isBg ? 'Профилът е запазен.' : 'Your profile has been saved.');
      setEditing(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : (isBg ? 'Не успяхме да запазим профила.' : 'Could not save your profile.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      router.replace('/login');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : (isBg ? 'Изходът не беше успешен.' : 'Could not sign out.'));
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center} edges={['top']}><ActivityIndicator size="large" color={SportHubBrandColors.accent} /><ThemedText>{isBg ? 'Зареждане на профила…' : 'Loading profile…'}</ThemedText></SafeAreaView>;

  if (!user) return (
    <SafeAreaView style={styles.scroll} edges={['top']}><ScrollView contentContainerStyle={styles.guestContainer}>
      <ProfileCard style={styles.guestCard}>
        <View style={styles.avatar}><ThemedText type="subtitle">S</ThemedText></View>
        <ThemedText type="subtitle" style={styles.centerText}>{isBg ? 'Добре дошъл в SportHub' : 'Welcome to SportHub'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>{isBg ? 'Влез или създай профил, за да се включиш в спортни събития.' : 'Sign in or create an account to join sports events.'}</ThemedText>
        {!!errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}
        <Pressable onPress={() => router.push('/login')} style={styles.primaryButton} accessibilityRole="button"><ThemedText type="smallBold" style={styles.primaryButtonText}>{isBg ? 'Вход' : 'Sign in'}</ThemedText></Pressable>
        <Pressable onPress={() => router.push('/register')} style={styles.secondaryButton} accessibilityRole="button"><ThemedText type="smallBold">{isBg ? 'Регистрация' : 'Create account'}</ThemedText></Pressable>
      </ProfileCard>
    </ScrollView></SafeAreaView>
  );

  const imageSource = avatarAsset?.uri ?? avatarUrl;
  const coverSource = coverAsset?.uri ?? coverUrl;
  const displayInitial = displayName.trim().charAt(0).toUpperCase() || 'S';

  return (
    <SafeAreaView style={styles.scroll} edges={['top']}><ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.profileHero}>
        <View style={styles.coverFrame}>
          {coverSource ? <Image source={{ uri: coverSource }} style={styles.coverImage} contentFit="cover" /> : <View style={styles.coverFallback}><Ionicons name="fitness-outline" size={42} color="rgba(255,255,255,0.62)" /><ThemedText type="smallBold" style={styles.coverHint}>{isBg ? 'ТВОЯТА СПОРТНА ИСТОРИЯ' : 'YOUR SPORTING STORY'}</ThemedText></View>}
          <View style={styles.coverShade} />
          {editing ? <Pressable disabled={pickingAvatar} onPress={() => void chooseCover()} accessibilityRole="button" style={styles.coverButton} hitSlop={8}><Ionicons name="camera-outline" size={16} color="#FFFFFF" /><ThemedText type="smallBold" style={styles.coverButtonText}>{isBg ? 'Смени корицата' : 'Edit cover'}</ThemedText></Pressable> : null}
        </View>
        <View style={styles.heroIdentity}>
        <Pressable disabled={!editing || pickingAvatar} accessibilityRole="button" accessibilityLabel={isBg ? 'Смени профилната снимка' : 'Change profile photo'} onPress={() => void chooseAvatar()} style={styles.avatarPress} hitSlop={12}>
          {imageSource ? <Image source={{ uri: imageSource }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatar}><ThemedText type="subtitle">{displayInitial}</ThemedText></View>}
          {editing ? <View style={styles.cameraBadge}>{pickingAvatar ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="camera" size={16} color="#FFFFFF" />}</View> : null}
        </Pressable>
        <ThemedText type="subtitle" style={styles.name}>{displayName || (isBg ? 'Спортист' : 'Athlete')}</ThemedText>
        {!!user.email && <ThemedText type="small" themeColor="textSecondary">{user.email}</ThemedText>}
        <View style={styles.memberBadge}><Ionicons name="sparkles" size={15} color="#D7F36A" /><ThemedText type="smallBold" style={styles.memberText}>{isBg ? 'СПОРТНА ОБЩНОСТ' : 'SPORTS COMMUNITY'}</ThemedText></View>
        </View>
      </View>

      {!!errorMessage && <View style={styles.messageError}><ThemedText style={styles.error}>{errorMessage}</ThemedText></View>}
      {!!notice && <View style={styles.messageSuccess}><Ionicons name="checkmark-circle" size={17} color="#D7F36A" /><ThemedText type="small" style={styles.successText}>{notice}</ThemedText></View>}
      {!editing && isModerator ? <Pressable onPress={() => router.push('/moderation')} accessibilityRole="button" style={styles.moderatorButton}>
        <View style={styles.moderatorIcon}><Ionicons name="shield-checkmark" size={20} color="#E9D8FF" /></View>
        <View style={styles.moderatorCopy}><ThemedText type="smallBold" style={styles.moderatorButtonText}>{isBg ? 'Модераторски инструменти' : 'Moderator tools'}</ThemedText><ThemedText type="small" style={styles.moderatorSubtitle}>{isBg ? 'Профили · събития · публикации · коментари' : 'Members · events · posts · comments'}</ThemedText></View>
        <Ionicons name="chevron-forward" size={19} color="#E9D8FF" />
      </Pressable> : null}

      {!editing ? <>
        <ProfileCard>
          <View style={styles.cardHeading}><View style={styles.sectionIcon}><Ionicons name="person-outline" size={19} color="#D7F36A" /></View><View style={styles.sectionCopy}><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'За теб' : 'About you'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{biography || (isBg ? 'Добави кратка биография, за да се представиш.' : 'Add a short bio to introduce yourself.')}</ThemedText></View></View>
          <View style={styles.summaryRow}><Ionicons name="location-outline" size={17} color="#D7F36A" /><ThemedText type="small" themeColor="textSecondary">{locationName || (isBg ? 'Градът не е добавен' : 'City not added')}</ThemedText></View>
          <View style={styles.summaryRow}><Ionicons name="speedometer-outline" size={17} color="#D7F36A" /><ThemedText type="small" themeColor="textSecondary">{skillLevel === 'beginner' ? (isBg ? 'Начинаещ' : 'Beginner') : skillLevel === 'intermediate' ? (isBg ? 'Средно ниво' : 'Intermediate') : (isBg ? 'Напреднал' : 'Advanced')}</ThemedText></View>
        </ProfileCard>
        <ProfileCard>
          <View style={styles.cardHeading}><View style={styles.sectionIcon}><Ionicons name="heart-outline" size={19} color="#D7F36A" /></View><View style={styles.sectionCopy}><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'Спортни интереси' : 'Sports interests'}</ThemedText></View></View>
          {interests.length ? <View style={styles.chips}>{interests.map((interest) => <View key={interest} style={[styles.chip, styles.chipSelected]}><ThemedText type="smallBold" style={styles.chipSelectedText}>{SPORTS.find((sport) => sport.key === interest.toLowerCase())?.[isBg ? 'bg' : 'en'] ?? interest}</ThemedText></View>)}</View> : <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Все още няма избрани спортове.' : 'No sports selected yet.'}</ThemedText>}
        </ProfileCard>
        <Pressable onPress={() => router.push('/workout')} accessibilityRole="button" style={({ pressed }) => [styles.activityLink, pressed && styles.activityLinkPressed]}>
          <View style={styles.activityLinkIcon}><Ionicons name="barbell-outline" size={19} color="#0B1110" /></View>
          <View style={styles.sectionCopy}><ThemedText type="smallBold">{isBg ? 'Тренировъчен дневник' : 'Training log'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Следи седмичния си ритъм' : 'Track your weekly rhythm'}</ThemedText></View>
          <Ionicons name="arrow-forward" size={18} color="#D7F36A" />
        </Pressable>
        <Pressable onPress={() => router.push('/wellness' as never)} accessibilityRole="button" style={({ pressed }) => [styles.activityLink, pressed && styles.activityLinkPressed]}>
          <View style={[styles.activityLinkIcon, { backgroundColor: '#D7F36A' }]}><Ionicons name="heart-half-outline" size={19} color="#0B1110" /></View>
          <View style={styles.sectionCopy}><ThemedText type="smallBold">{isBg ? 'Здраве и навици' : 'Wellness & habits'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Информация и подкрепа без осъждане' : 'Guidance and support without judgement'}</ThemedText></View>
          <Ionicons name="arrow-forward" size={18} color="#D7F36A" />
        </Pressable>
        <Pressable onPress={() => { setNotice(''); setEditing(true); }} accessibilityRole="button" style={styles.primaryButton}>
          <Ionicons name="create-outline" size={18} color="#0B1110" /><ThemedText type="smallBold" style={styles.primaryButtonText}>{isBg ? 'Редактирай профила' : 'Edit profile'}</ThemedText>
        </Pressable>
        <Pressable onPress={() => router.push('/people')} accessibilityRole="button" style={styles.secondaryButton}>
          <Ionicons name="people-outline" size={18} color="#D7F36A" /><ThemedText type="smallBold">{isBg ? 'Разгледай спортисти' : 'Discover athletes'}</ThemedText>
        </Pressable>
      </> : <>
      <ProfileCard>
        <View style={styles.cardHeading}><View style={styles.sectionIcon}><Ionicons name="person-outline" size={19} color="#D7F36A" /></View><View style={styles.sectionCopy}><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'За теб' : 'About you'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Направи профила си разпознаваем.' : 'Make your profile your own.'}</ThemedText></View></View>
        <ThemedText type="smallBold">{isBg ? 'Име' : 'Name'}</ThemedText>
        <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} placeholder={isBg ? 'Твоето име' : 'Your name'} placeholderTextColor="#929D94" autoCapitalize="words" maxLength={60} />
        <ThemedText type="smallBold">{isBg ? 'Биография' : 'Bio'}</ThemedText>
        <TextInput value={biography} onChangeText={setBiography} style={[styles.input, styles.bioInput]} placeholder={isBg ? 'Разкажи малко за себе си…' : 'A little about you…'} placeholderTextColor="#929D94" multiline maxLength={280} />
        <ThemedText type="smallBold">{isBg ? 'Град или квартал' : 'City or neighborhood'}</ThemedText>
        <TextInput value={locationName} onChangeText={setLocationName} style={styles.input} placeholder={isBg ? 'София' : 'Sofia'} placeholderTextColor="#929D94" maxLength={80} />
        <ThemedText type="smallBold">{isBg ? 'Ниво' : 'Skill level'}</ThemedText>
        <View style={styles.chips}>
          {LEVELS.map((level) => {
            const active = skillLevel === level;
            const label = level === 'beginner' ? (isBg ? 'Начинаещ' : 'Beginner') : level === 'intermediate' ? (isBg ? 'Средно ниво' : 'Intermediate') : (isBg ? 'Напреднал' : 'Advanced');
            return <Pressable key={level} onPress={() => setSkillLevel(level)} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.chip, active && styles.chipSelected]}><ThemedText type="smallBold" style={active ? styles.chipSelectedText : styles.chipText}>{label}</ThemedText></Pressable>;
          })}
        </View>
      </ProfileCard>

      <ProfileCard>
        <View style={styles.cardHeading}><View style={styles.sectionIcon}><Ionicons name="heart-outline" size={19} color="#D7F36A" /></View><View style={styles.sectionCopy}><ThemedText type="smallBold" style={styles.sectionTitle}>{isBg ? 'Спортни интереси' : 'Sports interests'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Избираме за теб по-подходящи срещи.' : 'Help us find events you’ll enjoy.'}</ThemedText></View></View>
        <View style={styles.chips}>
          {SPORTS.map((sport) => {
            const selected = interests.some((item) => item.toLowerCase() === sport.key);
            return <Pressable key={sport.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => toggleInterest(sport.key)} style={[styles.chip, selected && styles.chipSelected]}><Ionicons name={sport.icon} size={17} color={selected ? '#0B1110' : '#D7F36A'} /><ThemedText type="smallBold" style={selected ? styles.chipSelectedText : styles.chipText}>{isBg ? sport.bg : sport.en}</ThemedText></Pressable>;
          })}
          {interests.filter((interest) => !SPORTS.some((sport) => sport.key === interest.toLowerCase())).map((interest) => <Pressable key={interest} accessibilityRole="button" onPress={() => toggleInterest(interest)} style={[styles.chip, styles.chipSelected]}><Ionicons name="close-circle-outline" size={17} color="#0B1110" /><ThemedText type="smallBold" style={styles.chipSelectedText}>{interest}</ThemedText></Pressable>)}
        </View>
        <View style={styles.customRow}><TextInput value={customInterest} onChangeText={setCustomInterest} onSubmitEditing={addCustomInterest} placeholder={isBg ? 'Добави друг спорт…' : 'Add another sport…'} placeholderTextColor="#929D94" returnKeyType="done" style={styles.customInput} maxLength={32} /><Pressable onPress={addCustomInterest} accessibilityRole="button" style={styles.addButton}><Ionicons name="add" size={21} color="#0B1110" /></Pressable></View>
      </ProfileCard>

      <Pressable onPress={() => void saveProfile()} disabled={saving} accessibilityRole="button" style={[styles.primaryButton, saving && styles.disabled]}>
        {saving ? <ActivityIndicator color="#0B1110" /> : <><Ionicons name="checkmark" size={18} color="#0B1110" /><ThemedText type="smallBold" style={styles.primaryButtonText}>{isBg ? 'Запази промените' : 'Save changes'}</ThemedText></>}
      </Pressable>
      <Pressable onPress={() => { setEditing(false); void loadUser(); }} disabled={saving} accessibilityRole="button" style={styles.secondaryButton}>
        <ThemedText type="smallBold">{isBg ? 'Отказ' : 'Cancel'}</ThemedText>
      </Pressable>
      </>}
      <Pressable onPress={() => void handleLogout()} disabled={loggingOut} style={[styles.logoutButton, loggingOut && styles.disabled]} accessibilityRole="button">
        {loggingOut ? <ActivityIndicator color="#FF8F8F" /> : <><Ionicons name="log-out-outline" size={18} color="#FF8F8F" /><ThemedText type="smallBold" style={styles.logoutText}>{isBg ? 'Изход от профила' : 'Sign out'}</ThemedText></>}
      </Pressable>
    </ScrollView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0B1110' },
  container: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: Spacing.four, paddingTop: 22, paddingBottom: 220, gap: Spacing.three },
  guestContainer: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three, backgroundColor: '#0B1110' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three, backgroundColor: '#0B1110' },
  guestCard: { maxWidth: 480, alignSelf: 'center', alignItems: 'stretch' },
  activityLink: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 19, backgroundColor: '#151D1B', borderWidth: 1, borderColor: '#2D3932' },
  activityLinkIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#D7F36A' },
  activityLinkPressed: { opacity: 0.82 },
  profileHero: { gap: 0, marginBottom: 5 },
  coverFrame: { height: 190, borderRadius: 24, overflow: 'hidden', backgroundColor: '#292333', borderWidth: 1, borderColor: 'rgba(215,243,106,0.24)' },
  coverImage: StyleSheet.absoluteFill,
  coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#292333' },
  coverHint: { color: 'rgba(255,255,255,0.72)', fontSize: 10, letterSpacing: 2 },
  coverShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,8,14,0.12)' },
  coverButton: { position: 'absolute', top: 12, right: 12, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 99, backgroundColor: 'rgba(15,12,20,0.76)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  coverButtonText: { color: '#FFFFFF', fontSize: 12 },
  heroIdentity: { alignItems: 'center', gap: 7, marginTop: -48, paddingHorizontal: 14, paddingBottom: 12 },
  avatarPress: { width: 104, height: 104, marginBottom: 2, borderRadius: 52, borderWidth: 4, borderColor: '#0B1110', backgroundColor: '#0B1110' },
  avatar: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(215,243,106,0.5)', backgroundColor: '#1D2922' },
  cameraBadge: { position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', backgroundColor: '#8C4DCC', borderWidth: 2, borderColor: '#0B1110' },
  name: { fontSize: 25 },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  memberText: { color: '#D7F36A', fontSize: 10, letterSpacing: 1.1 },
  card: { borderRadius: 22, padding: Spacing.three, gap: 13, borderWidth: 1, borderColor: 'rgba(215,243,106,0.28)', overflow: 'hidden' },
  glassCard: { backgroundColor: 'transparent' },
  solidCard: { backgroundColor: '#151D1B' },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 3 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionIcon: { width: 42, height: 42, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(215,243,106,0.14)' },
  sectionCopy: { flex: 1, gap: 3 },
  sectionTitle: { fontSize: 17 },
  input: { minHeight: 49, borderRadius: 14, borderWidth: 1, borderColor: '#3E314B', paddingHorizontal: 13, color: '#FFFFFF', backgroundColor: '#101715', fontSize: 15 },
  bioInput: { minHeight: 90, paddingTop: 13, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 15, borderWidth: 1, borderColor: '#3E314B', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#101715' },
  chipSelected: { borderColor: '#D7F36A', backgroundColor: '#D7F36A' },
  chipText: { color: '#E9F1E8', fontSize: 12 },
  chipSelectedText: { color: '#0B1110', fontSize: 12 },
  customRow: { flexDirection: 'row', gap: 9 },
  customInput: { minHeight: 48, flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#3E314B', paddingHorizontal: 13, color: '#FFFFFF', backgroundColor: '#101715', fontSize: 14 },
  addButton: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7F36A' },
  primaryButton: { minHeight: 52, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D7F36A' },
  primaryButtonText: { color: '#0B1110' },
  secondaryButton: { minHeight: 50, borderRadius: 16, padding: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1110', borderWidth: 1, borderColor: '#2D3932' },
  moderatorButton: { minHeight: 64, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#352047', borderWidth: 1, borderColor: '#765A92' },
  moderatorIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#604080' },
  moderatorCopy: { flex: 1, gap: 4 },
  moderatorButtonText: { color: '#FFFFFF' },
  moderatorSubtitle: { color: '#D8C7E8', fontSize: 11 },
  logoutButton: { minHeight: 50, borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#151D1B', borderWidth: 1, borderColor: '#713838' },
  logoutText: { color: '#FF8F8F' },
  error: { color: '#FF8F8F' },
  successText: { color: '#D7F36A' },
  messageError: { padding: 12, borderRadius: 14, backgroundColor: 'rgba(130,35,35,0.2)' },
  messageSuccess: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: 'rgba(215,243,106,0.08)' },
  centerText: { textAlign: 'center' },
  disabled: { opacity: 0.65 },
});
