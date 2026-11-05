import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';

import { useLanguage } from '@/i18n/language-context';
import { SportHubBrandColors } from '@/constants/theme';

export default function AppTabs() {
  const { language } = useLanguage();
  const isBg = language === 'bg';
  const inactive = '#ACB6AD';

  return (
    <NativeTabs
      tintColor={SportHubBrandColors.accent}
      iconColor={{ selected: SportHubBrandColors.accent, default: inactive }}
      labelStyle={{
        selected: { color: SportHubBrandColors.accent, fontWeight: '700' },
        default: { color: inactive, fontWeight: '600' },
      }}
      indicatorColor={SportHubBrandColors.accent}
      backgroundColor={Platform.OS === 'android' ? '#151D1B' : undefined}
      tabBarRespectsIMEInsets
      minimizeBehavior="never"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{isBg ? 'Начало' : 'Home'}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md={{ default: 'home', selected: 'home_filled' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Label>{isBg ? 'Карта' : 'Map'}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md={{ default: 'map', selected: 'map' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="create">
        <NativeTabs.Trigger.Label>{isBg ? 'Създай' : 'Create'}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }} md={{ default: 'add_circle', selected: 'add_circle' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="messages">
        <NativeTabs.Trigger.Label>{isBg ? 'Чатове' : 'Chats'}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} md={{ default: 'chat_bubble', selected: 'chat_bubble' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{isBg ? 'Профил' : 'Profile'}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md={{ default: 'account_circle', selected: 'account_circle' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
