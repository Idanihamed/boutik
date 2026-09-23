import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, ErrorBox, Loader, Pill } from '../components/ui';
import { ApiError, listPromotions, setPromotionStatus } from '../lib/api';
import { COLORS, describePromotionValue, formatDate, PROMOTION_STATUS_COLORS, PROMOTION_STATUS_LABELS } from '../lib/labels';
import { useSession } from '../lib/session';
import type { Promotion } from '../lib/types';

/**
 * Lecture + activer/désactiver seulement : la création et la modification d'une promotion
 * (produits concernés, dates, bannière…) restent sur le site pour l'instant — trop complexe
 * pour un premier écran mobile, qui répond surtout au besoin de suivre et réagir vite
 * (désactiver une promotion en cours en cas d'erreur, par exemple), pas de tout gérer depuis le
 * téléphone.
 */
export default function PromotionsScreen() {
  const { user, can } = useSession();
  const currency = user?.business?.currency ?? 'XOF';
  const [items, setItems] = useState<Promotion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await listPromotions()).data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les promotions.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function toggle(promo: Promotion) {
    setBusyId(promo.id);
    try {
      await setPromotionStatus(promo.id, promo.adminStatus === 'ACTIVE' ? 'disable' : 'activate');
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  }

  const canActivate = can('promotions:activate');

  if (error && !items) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorBox message={error} onRetry={load} />
      </View>
    );
  }
  if (!items) return <Loader />;

  return (
    <FlatList
      data={items}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[COLORS.brand]} />}
      ListEmptyComponent={<Empty text="Aucune promotion pour l’instant." />}
      ListHeaderComponent={error ? <ErrorBox message={error} /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8 }}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            <Pill label={PROMOTION_STATUS_LABELS[item.displayStatus]} {...PROMOTION_STATUS_COLORS[item.displayStatus]} />
          </View>
          <Text style={styles.value}>{describePromotionValue(item.type, item.value, currency)}</Text>
          <Text style={styles.muted}>
            Du {formatDate(item.startsAt)} au {formatDate(item.endsAt)}
          </Text>
          {(item.products.length > 0 || item.categories.length > 0) && (
            <Text style={styles.muted} numberOfLines={2}>
              {item.products.length > 0 && `${item.products.length} produit${item.products.length > 1 ? 's' : ''}`}
              {item.products.length > 0 && item.categories.length > 0 && ' · '}
              {item.categories.length > 0 && `${item.categories.length} catégorie${item.categories.length > 1 ? 's' : ''}`}
            </Text>
          )}
          {canActivate && item.adminStatus !== 'DRAFT' && (
            <Button
              label={item.adminStatus === 'ACTIVE' ? 'Désactiver' : 'Activer'}
              variant={item.adminStatus === 'ACTIVE' ? 'secondary' : 'primary'}
              loading={busyId === item.id}
              disabled={busyId !== null}
              onPress={() => toggle(item)}
            />
          )}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.text },
  value: { fontSize: 15, fontWeight: '700', color: COLORS.brand },
  muted: { color: COLORS.muted, fontSize: 13 },
});
