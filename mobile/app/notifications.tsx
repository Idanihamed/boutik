import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button, Empty, ErrorBox, Loader } from '../components/ui';
import { ApiError, listNotifications, markAllNotificationsRead, markNotificationRead } from '../lib/api';
import { COLORS, formatDate } from '../lib/labels';
import { screenFor } from '../lib/links';
import { notifyNotificationsChanged } from '../lib/notification-events';
import type { AppNotification } from '../lib/types';

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listNotifications());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les notifications.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function open(n: AppNotification) {
    if (!n.isRead && !n.virtual) {
      await markNotificationRead(n.id).catch(() => undefined);
      notifyNotificationsChanged();
    }
    const target = screenFor(n.link);
    if (target) router.navigate(target);
    else load();
  }

  async function readAll() {
    await markAllNotificationsRead().catch(() => undefined);
    notifyNotificationsChanged();
    await load();
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (error && !items) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorBox message={error} onRetry={load} />
      </View>
    );
  }
  if (!items) return <Loader />;

  const hasUnread = items.some((n) => !n.isRead && !n.virtual);

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[COLORS.brand]} />}
      ListHeaderComponent={hasUnread ? <Button label="Tout marquer comme lu" variant="secondary" onPress={readAll} /> : null}
      ListEmptyComponent={<Empty text="Rien de nouveau pour l’instant." />}
      renderItem={({ item }) => (
        <Pressable onPress={() => open(item)} accessibilityRole="button" style={styles.item}>
          <View style={[styles.dot, { backgroundColor: item.isRead ? 'transparent' : COLORS.brand }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.message, !item.isRead && { fontWeight: '700' }]}>{item.message}</Text>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  message: { fontSize: 15, color: COLORS.text },
  date: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
});
