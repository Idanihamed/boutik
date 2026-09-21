import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, Empty, ErrorBox, Loader, Pill } from '../../components/ui';
import { ApiError, imageUrl, listProducts } from '../../lib/api';
import { COLORS, formatPrice, STOCK_COLORS, STOCK_LABELS } from '../../lib/labels';
import { useSession } from '../../lib/session';
import type { Product } from '../../lib/types';

export default function ProductsScreen() {
  const { user } = useSession();
  const currency = user?.business?.currency ?? 'XOF';
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Product[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadingMore = useRef(false);

  // Recherche lancée 400 ms après la dernière touche, pour ne pas interroger le serveur à chaque lettre.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async (term: string, pageToLoad: number) => {
    try {
      const res = await listProducts({ search: term || undefined, page: pageToLoad });
      setItems((cur) => (pageToLoad === 1 || !cur ? res.data : [...cur, ...res.data]));
      setPage(pageToLoad);
      setTotalPages(res.meta.totalPages);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les produits.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(search, 1);
    }, [load, search]),
  );

  async function refresh() {
    setRefreshing(true);
    await load(search, 1);
    setRefreshing(false);
  }

  async function loadMore() {
    if (loadingMore.current || page >= totalPages) return;
    loadingMore.current = true;
    await load(search, page + 1);
    loadingMore.current = false;
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.search}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Rechercher un produit…"
          placeholderTextColor={COLORS.muted}
          returnKeyType="search"
          accessibilityLabel="Rechercher un produit"
        />
      </View>

      {error && (
        <View style={{ padding: 16 }}>
          <ErrorBox message={error} onRetry={() => load(search, 1)} />
        </View>
      )}
      {!items && !error && <Loader />}
      {items && (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[COLORS.brand]} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<Empty text={search ? 'Aucun produit ne correspond.' : 'Aucun produit pour l’instant.'} />}
          renderItem={({ item }) => {
            const photo = item.images.find((i) => i.isMain) ?? item.images[0];
            return (
              <Pressable onPress={() => router.push(`/produit/${item.id}`)} accessibilityRole="button">
                <Card style={styles.row}>
                  {photo ? (
                    <Image source={{ uri: imageUrl(photo.url) }} style={styles.thumb} accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={[styles.thumb, { backgroundColor: COLORS.border }]} />
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.name} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.price}>{formatPrice(item.effectivePrice, currency)}</Text>
                    <View style={styles.pills}>
                      <Pill label={`${item.stock} · ${STOCK_LABELS[item.stockStatus]}`} {...STOCK_COLORS[item.stockStatus]} />
                      {item.status === 'DRAFT' && <Pill label="Brouillon" bg="#e2e8f0" fg="#334155" />}
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: { padding: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  price: { fontSize: 15, fontWeight: '600', color: COLORS.brand },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
});
