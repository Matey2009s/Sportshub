import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { ColorValue } from 'react-native';

import { useLanguage } from '@/i18n/language-context';

export default function AppTabs() {
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.clientY >= window.innerHeight - 118) setVisible(true);
      else setVisible(false);
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  const screenOptions = (icon: string, selectedIcon: string, title: string) => ({
    title,
    tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <Ionicons name={(focused ? selectedIcon : icon) as keyof typeof Ionicons.glyphMap} size={21} color={typeof color === 'number' ? '#ACB6AD' : color ?? '#ACB6AD'} />
    ),
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#D7F36A',
        tabBarInactiveTintColor: '#ACB6AD',
        tabBarLabelStyle: styles.label,
        tabBarStyle: [styles.bar, !visible && styles.hidden],
      }}
    >
      <Tabs.Screen name="index" options={screenOptions('home-outline', 'home', isBg ? 'Начало' : 'Home')} />
      <Tabs.Screen name="map" options={screenOptions('map-outline', 'map', isBg ? 'Карта' : 'Map')} />
      <Tabs.Screen name="create" options={screenOptions('add-circle-outline', 'add-circle', isBg ? 'Създай' : 'Create')} />
      <Tabs.Screen name="messages" options={screenOptions('chatbubbles-outline', 'chatbubbles', isBg ? 'Чатове' : 'Chats')} />
      <Tabs.Screen name="profile" options={screenOptions('person-circle-outline', 'person-circle', isBg ? 'Профил' : 'Profile')} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 12, right: 12, bottom: 10, height: 72, paddingTop: 7, paddingBottom: 7, borderRadius: 25, borderTopWidth: 1, borderTopColor: '#2D3932', backgroundColor: 'rgba(18,26,22,0.96)', elevation: 0, shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 5 } },
  hidden: { opacity: 0, transform: [{ translateY: 24 }], pointerEvents: 'none' },
  label: { fontSize: 10, fontWeight: '700' },
});
