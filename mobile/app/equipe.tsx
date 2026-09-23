import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, ErrorBox, Loader, Pill } from '../components/ui';
import { ApiError, listTeam, setTeamMemberActive } from '../lib/api';
import { COLORS, ROLE_LABELS } from '../lib/labels';
import { useSession } from '../lib/session';
import type { TeamMember } from '../lib/types';

/**
 * Lecture + activer/désactiver un compte seulement : ajouter un membre demande de choisir un
 * rôle et un mot de passe initial, mieux adapté à un écran plus large — reste sur le site pour
 * l'instant. Utile depuis le téléphone surtout pour désactiver vite l'accès de quelqu'un.
 */
export default function TeamScreen() {
  const { user, can } = useSession();
  const [items, setItems] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listTeam());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger l’équipe.');
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

  async function toggle(member: TeamMember) {
    setBusyId(member.id);
    try {
      await setTeamMemberActive(member.id, !member.isActive);
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  }

  const canUpdate = can('users:update');

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
      keyExtractor={(m) => m.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[COLORS.brand]} />}
      ListEmptyComponent={<Empty text="Aucun membre pour l’instant." />}
      ListHeaderComponent={error ? <ErrorBox message={error} /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 6 }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.muted} numberOfLines={1}>
                {item.email}
              </Text>
            </View>
            <Pill label={ROLE_LABELS[item.role] ?? item.role} bg={COLORS.brandLight} fg={COLORS.brand} />
          </View>
          <View style={styles.row}>
            <Pill
              label={item.isActive ? 'Actif' : 'Désactivé'}
              bg={item.isActive ? '#d1fae5' : '#fee2e2'}
              fg={item.isActive ? '#065f46' : '#991b1b'}
            />
            {canUpdate && item.id !== user?.id && (
              <Button
                label={item.isActive ? 'Désactiver' : 'Réactiver'}
                variant={item.isActive ? 'danger' : 'secondary'}
                loading={busyId === item.id}
                disabled={busyId !== null}
                onPress={() => toggle(item)}
              />
            )}
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  muted: { color: COLORS.muted, fontSize: 13 },
});
