import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorBox, Loader } from '../../components/ui';
import { ApiError, getDashboardStats } from '../../lib/api';
import { COLORS } from '../../lib/labels';
import { useSession } from '../../lib/session';
import type { DashboardStats } from '../../lib/types';

const STATUS_NOTICE: Record<string, string> = {
  PENDING: 'Votre entreprise est en attente de validation : elle sera visible du public dès son approbation.',
  REJECTED: 'Votre inscription a été refusée.',
  SUSPENDED: 'Votre entreprise est suspendue.',
  BANNED: 'Votre entreprise a été bannie.',
};

function Stat({ value, label, alert = false }: { value: number; label: string; alert?: boolean }) {
  return (
    <Card style={styles.stat}>
      <Text style={[styles.statValue, alert && value > 0 && { color: COLORS.danger }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function QuickLink({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.quickLink, pressed && { opacity: 0.7 }]}>
      <Text style={{ fontSize: 22 }}>{glyph}</Text>
      <Text style={styles.quickLinkLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { user, logout, can } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await getDashboardStats());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les chiffres.');
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

  const business = user?.business;
  const notice = business ? STATUS_NOTICE[business.status] : null;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[COLORS.brand]} />}
    >
      <Text style={styles.title}>{business?.name ?? 'Mon entreprise'}</Text>
      <Text style={styles.muted}>Bonjour {user?.name}</Text>

      {notice && (
        <Card style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
          <Text style={{ color: '#92400e' }}>{notice}</Text>
        </Card>
      )}

      {error && <ErrorBox message={error} onRetry={load} />}
      {!stats && !error && <Loader />}
      {stats && (
        <View style={styles.grid}>
          <Stat value={stats.orders.pending} label="Commandes à traiter" alert />
          <Stat value={stats.messages.untreated} label="Messages à traiter" alert />
          <Stat value={stats.stock.lowStock} label="Stock faible" alert />
          <Stat value={stats.stock.outOfStock} label="Ruptures de stock" alert />
        </View>
      )}

      {(can('promotions:read') || can('users:read')) && (
        <View style={styles.quickLinks}>
          {can('promotions:read') && <QuickLink label="Promotions" glyph="🏷️" onPress={() => router.push('/promotions')} />}
          {can('users:read') && <QuickLink label="Équipe" glyph="👥" onPress={() => router.push('/equipe')} />}
        </View>
      )}

      <Text style={styles.muted}>Tirez vers le bas pour actualiser.</Text>
      <Button label="Se déconnecter" variant="secondary" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  muted: { color: COLORS.muted, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexBasis: '47%', flexGrow: 1 },
  statValue: { fontSize: 32, fontWeight: '800', color: COLORS.text },
  statLabel: { color: COLORS.muted, fontSize: 14, marginTop: 2 },
  quickLinks: { flexDirection: 'row', gap: 12 },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  quickLinkLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
});
