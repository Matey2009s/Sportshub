import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { hasSupabaseConfig } from '@/lib/supabase';
import { testSupabaseConnection, type SupabaseConnectionStatus } from '@/lib/supabase-services';

export function SupabaseDiagnostic() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SupabaseConnectionStatus | null>(null);

  useEffect(() => {
    let active = true;

    async function runCheck() {
      const result = await testSupabaseConnection();

      if (active) {
        setStatus(result);
        setLoading(false);
      }
    }

    runCheck().catch(() => {
      if (active) {
        setStatus({
          configured: hasSupabaseConfig,
          connectionOk: false,
          outcome: 'error',
          count: null,
          sampleEventId: null,
          table: 'sports_events',
          message: 'Supabase request failed. Check the project URL and publishable key.',
        });
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <ThemedText type="smallBold">Supabase diagnostics</ThemedText>

      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator color="#B8FF4D" />
          <ThemedText type="small" themeColor="textSecondary">Checking connection…</ThemedText>
        </View>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            configured: {status?.configured ? 'yes' : 'no'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            outcome: {status?.outcome ?? 'error'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            database: {status?.connectionOk === true ? 'ok' : 'not available'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            table: {status?.table ?? 'sports_events'}
          </ThemedText>
          {typeof status?.count === 'number' && (
            <ThemedText type="small" themeColor="textSecondary">
              rows: {status.count}
            </ThemedText>
          )}
          {status?.sampleEventId && (
            <ThemedText type="small" themeColor="textSecondary">
              sample event id: {status.sampleEventId}
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
            {status?.message ?? 'No result yet.'}
          </ThemedText>
        </>
      )}

      <Pressable
        onPress={async () => {
          setLoading(true);
          const nextStatus = await testSupabaseConnection();
          setStatus(nextStatus);
          setLoading(false);
        }}
        style={styles.button}
      >
        <ThemedText type="smallBold">Retry</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#29332B',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  message: {
    lineHeight: 20,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#B8FF4D',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
});
