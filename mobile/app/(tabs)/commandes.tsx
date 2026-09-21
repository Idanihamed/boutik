import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Empty, ErrorBox, Loader, Pill } from '../../components/ui';
import { ApiError, listOrders } from '../../lib/api';
import { COLORS, formatDate, formatPrice, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '../../lib/labels';
import { useSession } from '../../lib/session';
import type { AdminOrder, OrderStatus } from '../../lib/types';

const FILTERS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'Toutes' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'CONFIRMEE', label: 'Confirmées' },
  { value: 'EN_PREPARATION', label: 'En préparation' },
  { value: 'EXPEDIEE', label: 'Expédiées' },
  { value: 'LIVREE', label: 'Livrées' },
  { value: 'ANNULEE', label: 'Annulées' },
];

export default function OrdersScreen() {
  const { user } = useSession();
  const currency = user?.business?.currency ?? 'XOF';
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [items, setItems] = useState<AdminOrder[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadingMore = useRef(false);

  const load = useCallback(async (filter: OrderStatus | '', pageToLoad: number) => {
    try {
      const res = await listOrders({ status: filter || undefined, page: pageToLoad });
      setItems((cur) => (pageToLoad === 1 || !cur ? res.data : [...cur, ...res.data]));
      setPage(pageToLoad);
      setTotalPages(res.meta.totalPages);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les commandes.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(status, 1);
    }, [load, status]),
  );

  function changeFilter(value: OrderStatus | '') {
    setItems(null);
    setStatus(value);
  }

  async function refresh() {
    setRefreshing(true);
    await load(status, 1);
    setRefreshing(false);
  }

  async function loadMore() {
    if (loadingMore.current || page >= totalPages) return;
    loadingMore.current = true;
    await load(status, page + 1);
    loadingMore.current = false;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
        {FILTERS.map((f) => {
          const active = f.value === status;
          return (
            <Pressable
              key={f.label}
              onPress={() => changeFilter(f.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && { backgroundColor: COLORS.brand, borderColor: COLORS.brand }]}
            >
              <Text style={[styles.chipText, active && { color: '#fff' }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error && (
        <View style={{ padding: 16 }}>
          <ErrorBox message={error} onRetry={() => load(status, 1)} />
        </View>
      )}
      {!items && !error && <Loader />}
      {items && (
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[COLORS.brand]} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<Empty text="Aucune commande pour l’instant." />}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/commande/${item.id}`)} accessibilityRole="button">
              <Card style={{ gap: 6 }}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.customerName}</Text>
                  <Text style={styles.price}>{formatPrice(item.totalAmount, currency)}</Text>
                </View>
                <Text style={styles.muted}>
                  {item.reference} · {formatDate(item.createdAt)}
                </Text>
                <Pill label={ORDER_STATUS_LABELS[item.status]} {...ORDER_STATUS_COLORS[item.status]} />
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.card },
  filtersContent: { padding: 12, gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  price: { fontSize: 16, fontWeight: '700', color: COLORS.brand },
  muted: { color: COLORS.muted, fontSize: 13 },
});
