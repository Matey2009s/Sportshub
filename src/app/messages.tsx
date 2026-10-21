import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const chats = [
  { name: 'Велосипедисти Витоша', lastMessage: 'Ще се съберем на входа в 17:00.', time: '2 мин' },
  { name: 'Състезатели 5K', lastMessage: 'Кой ще е на старта?', time: '18 мин' },
  { name: 'Група за бягане', lastMessage: 'Най-добрият маршрут е през река.', time: '1 ч' },
];

export default function MessagesScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle" style={styles.title}>Съобщения</ThemedText>

        {chats.map((chat) => (
          <ThemedView key={chat.name} type="backgroundElement" style={styles.chatCard}>
            <ThemedText type="smallBold">{chat.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {chat.lastMessage}
            </ThemedText>
            <ThemedText type="small" style={styles.time}>
              {chat.time}
            </ThemedText>
          </ThemedView>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    marginTop: Spacing.three,
  },
  chatCard: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  time: {
    alignSelf: 'flex-end',
  },
});
