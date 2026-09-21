import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { getUnreadCount } from '../lib/api';
import { COLORS } from '../lib/labels';
import { onNotificationsChanged } from '../lib/notification-events';

const REFRESH_MS = 30_000;

/** Cloche de l'en-tête : badge rouge avec le nombre d'alertes non lues, ouvre la liste. */
export function BellButton() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setCount(await getUnreadCount());
    } catch {
      // Silencieux : la cloche ne doit jamais gêner (réseau coupé, session expirée...).
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, REFRESH_MS);
    const appState = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    const unsubscribe = onNotificationsChanged(refresh);
    return () => {
      clearInterval(timer);
      appState.remove();
      unsubscribe();
    };
  }, [refresh]);

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Notifications, ${count} non lue${count > 1 ? 's' : ''}` : 'Notifications'}
      style={styles.button}
    >
      <Text style={styles.bell}>🔔</Text>
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  bell: { fontSize: 22 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
