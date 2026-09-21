import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorBox, Loader, Pill } from '../../components/ui';
import { ApiError, getOrder, setOrderStatus } from '../../lib/api';
import {
  COLORS,
  contactLinks,
  formatDate,
  formatPrice,
  NEXT_ORDER_LABELS,
  NEXT_ORDER_STATUS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
} from '../../lib/labels';
import { useSession } from '../../lib/session';
import type { AdminOrder, OrderStatus } from '../../lib/types';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, can } = useSession();
  const currency = user?.business?.currency ?? 'XOF';
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await getOrder(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger la commande.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(status: OrderStatus) {
    if (!order) return;
    setBusy(true);
    try {
      setOrder(await setOrderStatus(order.id, status));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Changement impossible.');
    } finally {
      setBusy(false);
    }
  }

  function confirmCancel() {
    Alert.alert('Annuler cette commande ?', 'Les articles seront remis en stock.', [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui, annuler', style: 'destructive', onPress: () => changeStatus('ANNULEE') },
    ]);
  }

  if (error && !order) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorBox message={error} onRetry={load} />
      </View>
    );
  }
  if (!order) return <Loader />;

  const next = NEXT_ORDER_STATUS[order.status];
  const canUpdate = can('orders:update');
  const links = contactLinks(order.customerContact);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.reference}>{order.reference}</Text>
        <Pill label={ORDER_STATUS_LABELS[order.status]} {...ORDER_STATUS_COLORS[order.status]} />
      </View>
      <Text style={styles.muted}>Passée le {formatDate(order.createdAt)}</Text>

      <Card style={{ gap: 6 }}>
        <Text style={styles.section}>Client</Text>
        <Text style={styles.value}>{order.customerName}</Text>
        <Text style={styles.value}>{order.customerContact}</Text>
        {order.customerAddress && <Text style={styles.value}>{order.customerAddress}</Text>}
        {order.boutique && (
          <Text style={styles.value}>
            Retrait : {order.boutique.name}, {order.boutique.address}
          </Text>
        )}
        {order.notes && <Text style={[styles.value, { fontStyle: 'italic' }]}>« {order.notes} »</Text>}
        {links.length > 0 && (
          <View style={styles.linkRow}>
            {links.map((l) => (
              <View key={l.url} style={{ flex: 1 }}>
                <Button label={l.label} variant="secondary" onPress={() => Linking.openURL(l.url)} />
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card style={{ gap: 8 }}>
        <Text style={styles.section}>Articles</Text>
        {order.items.map((item, i) => (
          <View key={`${item.productName}-${i}`} style={styles.itemRow}>
            <Text style={[styles.value, { flex: 1 }]}>
              {item.quantity} × {item.productName}
            </Text>
            <Text style={styles.value}>{formatPrice(item.subtotal, currency)}</Text>
          </View>
        ))}
        {(order.discountAmount > 0 || order.shippingFee > 0) && (
          <View style={[styles.itemRow, styles.total]}>
            <Text style={styles.value}>Sous-total</Text>
            <Text style={styles.value}>
              {formatPrice(order.totalAmount + order.discountAmount - order.shippingFee, currency)}
            </Text>
          </View>
        )}
        {order.discountAmount > 0 && (
          <View style={styles.itemRow}>
            <Text style={[styles.value, { color: '#047857' }]}>Code {order.promoCode}</Text>
            <Text style={[styles.value, { color: '#047857' }]}>−{formatPrice(order.discountAmount, currency)}</Text>
          </View>
        )}
        {order.shippingFee > 0 && (
          <View style={styles.itemRow}>
            <Text style={styles.value}>Livraison</Text>
            <Text style={styles.value}>{formatPrice(order.shippingFee, currency)}</Text>
          </View>
        )}
        <View style={[styles.itemRow, styles.total]}>
          <Text style={styles.totalText}>Total à encaisser</Text>
          <Text style={styles.totalText}>{formatPrice(order.totalAmount, currency)}</Text>
        </View>
      </Card>

      {error && <ErrorBox message={error} />}

      {canUpdate && next && (
        <Button label={NEXT_ORDER_LABELS[order.status] ?? 'Étape suivante'} onPress={() => changeStatus(next)} loading={busy} />
      )}
      {canUpdate && order.status !== 'ANNULEE' && order.status !== 'LIVREE' && (
        <Button label="Annuler la commande" variant="danger" onPress={confirmCancel} disabled={busy} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  reference: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  muted: { color: COLORS.muted, fontSize: 14 },
  section: { fontSize: 13, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  value: { fontSize: 16, color: COLORS.text },
  linkRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  total: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, marginTop: 4 },
  totalText: { fontSize: 18, fontWeight: '800', color: COLORS.text },
});
