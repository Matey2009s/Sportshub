import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLanguage } from '@/i18n/language-context';
import { listPublicProfiles } from '@/lib/supabase-services';
import type { Profile } from '@/lib/supabase';

export default function PeopleScreen() {
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      async function loadPeople() {
        setLoading(true);
        setError('');
        try {
          const result = await listPublicProfiles(search);
          if (active) setProfiles(result);
        } catch (reason) {
          if (active) setError(reason instanceof Error ? reason.message : (isBg ? 'Профилите не се заредиха.' : 'Could not load profiles.'));
        } finally {
          if (active) setLoading(false);
        }
      }
      void loadPeople();
    }, 220);

    return () => { active = false; clearTimeout(timer); };
  }, [isBg, search]);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={styles.backButton} accessibilityRole="button" hitSlop={8}>
          <Ionicons name="arrow-back" size={19} color="#FFFFFF" />
          <ThemedText type="smallBold">{isBg ? 'Профил' : 'Profile'}</ThemedText>
        </Pressable>

        <View style={styles.heading}>
          <ThemedText type="smallBold" style={styles.eyebrow}>{isBg ? 'СПОРТНА ОБЩНОСТ' : 'SPORTS COMMUNITY'}</ThemedText>
          <ThemedText type="subtitle" style={styles.title}>{isBg ? 'Открий спортисти' : 'Find athletes'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{isBg ? 'Разгледай профили и намери хора със сходни интереси.' : 'Explore profiles and find people who share your interests.'}</ThemedText>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={19} color="#D7F36A" />
          <TextInput value={search} onChangeText={setSearch} placeholder={isBg ? 'Търси по име' : 'Search by name'} placeholderTextColor="#929D94" style={styles.searchInput} returnKeyType="search" autoCorrect={false} />
          {!!search && <Pressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel={isBg ? 'Изчисти търсенето' : 'Clear search'} hitSlop={8}><Ionicons name="close-circle" size={19} color="#ACB6AD" /></Pressable>}
        </View>

        {loading ? <View style={styles.state}><ActivityIndicator color="#D7F36A" /><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Зареждаме профилите…' : 'Loading profiles…'}</ThemedText></View> : null}
        {!!error && !loading ? <View style={styles.state}><Ionicons name="alert-circle-outline" size={22} color="#FF8F8F" /><ThemedText type="small">{error}</ThemedText></View> : null}
        {!loading && !error && profiles.length === 0 ? <View style={styles.state}><Ionicons name="people-outline" size={26} color="#D7F36A" /><ThemedText type="smallBold">{isBg ? 'Няма намерени профили' : 'No profiles found'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isBg ? 'Опитай с друго име.' : 'Try a different name.'}</ThemedText></View> : null}

        {profiles.map((profile) => {
          const name = profile.display_name?.trim() || (isBg ? 'Спортист' : 'Athlete');
          const sports = (profile.favorite_sports ?? []).slice(0, 3);
          return (
            <Pressable key={profile.id} onPress={() => router.push(`/athlete/${profile.id}`)} accessibilityRole="button" style={({ pressed }) => [styles.personCard, pressed && styles.pressed]}>
              {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarFallback}><ThemedText type="subtitle" style={styles.initial}>{name.charAt(0).toUpperCase()}</ThemedText></View>}
              <View style={styles.personCopy}>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>{name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{profile.biography?.trim() || profile.location || (isBg ? 'Спортист от общността' : 'SportHub community member')}</ThemedText>
                {sports.length ? <View style={styles.sportRow}>{sports.map((sport) => <View key={sport} style={styles.sportPill}><ThemedText type="smallBold" style={styles.sportText}>{sport}</ThemedText></View>)}</View> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8F8798" />
            </Pressable>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1110' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingTop: 20, paddingBottom: 120, gap: 13 },
  backButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  heading: { gap: 7, marginTop: 6, marginBottom: 8 },
  eyebrow: { color: '#D7F36A', fontSize: 10, letterSpacing: 1.4 },
  title: { fontSize: 32, lineHeight: 38 },
  searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#151D1B' },
  searchInput: { flex: 1, minHeight: 48, color: '#FFFFFF', fontSize: 15 },
  state: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, borderRadius: 20, backgroundColor: '#151D1B' },
  personCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 19, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#151D1B' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.995 }] },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#202A26' },
  avatarFallback: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,243,106,0.16)', borderWidth: 1, borderColor: 'rgba(215,243,106,0.4)' },
  initial: { color: '#D7F36A' },
  personCopy: { flex: 1, gap: 4 },
  name: { fontSize: 15 },
  sportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 3 },
  sportPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(215,243,106,0.13)' },
  sportText: { color: '#D7F36A', fontSize: 10 },
});
