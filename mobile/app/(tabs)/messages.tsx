import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Card, Empty, ErrorBox, Loader, Pill } from '../../components/ui';
import { ApiError, listMessages } from '../../lib/api';
import { COLORS, formatDate, MESSAGE_STATUS_COLORS, MESSAGE_STATUS_LABELS } from '../../lib/labels';
import type { AdminMessageRow } from '../../lib/types';

export default function MessagesScreen() {
  const [items, setItems] = useState<AdminMessageRow[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadingMore = useRef(false);

  const load = useCallback(async (pageToLoad: number) => {
    try {
      const res = await listMessages({ page: pageToLoad });
      setItems((cur) => (pageToLoad === 1 || !cur ? res.data : [...cur, ...res.data]));
      setPage(pageToLoad);
      setTotalPages(res.meta.totalPages);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les messages.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(1);
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load(1);
    setRefreshing(false);
  }

  async function loadMore() {
    if (loadingMore.current || page >= totalPages) return;
    loadingMore.current = true;
    await load(page + 1);
    loadingMore.current = false;
  }

  if (error && !items) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorBox message={error} onRetry={() => load(1)} />
      </View>
    );
  }
  if (!items) return <Loader />;

  return (
    <FlatList
      data={items}
      keyExtractor={(m) => m.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[COLORS.brand]} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={<Empty text="Aucun message pour l’instant." />}
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/message/${item.id}`)} accessibilityRole="button">
          <Card style={{ gap: 6 }}>
            <Text style={styles.subject} numberOfLines={1}>
              {item.subject}
            </Text>
            <Text style={styles.muted}>
              {item.name} · {formatDate(item.createdAt)}
            </Text>
            <Text numberOfLines={2} style={{ color: COLORS.text }}>
              {item.message}
            </Text>
            <Pill label={MESSAGE_STATUS_LABELS[item.status]} {...MESSAGE_STATUS_COLORS[item.status]} />
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  subject: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  muted: { color: COLORS.muted, fontSize: 13 },
});
