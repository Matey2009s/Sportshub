
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';

import { SportHubBrandColors } from '@/constants/theme';

const isIOS = Platform.OS === 'ios';

export default function TabsLayout() {
  const liquidGlassEnabled =
    isIOS && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor:
              liquidGlassEnabled ? 'transparent' : '#0F1511',
            borderTopColor:
              liquidGlassEnabled ? 'transparent' : '#29332B',
            borderTopWidth: liquidGlassEnabled ? 0 : 1,
          },
        ],

        tabBarBackground: () =>
          liquidGlassEnabled ? (
            <GlassView
              glassEffectStyle="regular"
              tintColor="#0F1511"
              style={styles.glassBackground}
            />
          ) : (
            <View style={styles.androidWebBackground} />
          ),

        tabBarActiveTintColor: SportHubBrandColors.accent,
        tabBarInactiveTintColor: '#A1ADA4',
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Начало' }} />
      <Tabs.Screen name="map" options={{ title: 'Карта' }} />
      <Tabs.Screen name="create" options={{ title: 'Създай' }} />
      <Tabs.Screen name="messages" options={{ title: 'Съобщения' }} />
      <Tabs.Screen name="profile" options={{ title: 'Профил' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 8,
    height: 72,
    paddingTop: 7,
    paddingBottom: 7,
    borderRadius: 30,
    borderTopColor: 'transparent',
    borderWidth: 0,
    overflow: 'hidden',
    elevation: 0,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },

  glassBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 30,
  },

  androidWebBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#0F1511',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#29332B',
  },

  tabItem: {
    marginTop: 2,
  },

  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
