import { Redirect, Tabs } from 'expo-router';
import { Loader } from '../../components/ui';
import { COLORS } from '../../lib/labels';
import { useSession } from '../../lib/session';

export default function TabsLayout() {
  const { user, loading, can } = useSession();
  if (loading) return <Loader />;
  if (!user) return <Redirect href="/connexion" />;

  return (
    <Tabs
      screenOptions={{
        headerTintColor: COLORS.text,
        headerStyle: { backgroundColor: COLORS.card },
        tabBarActiveTintColor: COLORS.brand,
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
        tabBarIconStyle: { display: 'none' },
        tabBarStyle: { height: 60 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
      <Tabs.Screen name="commandes" options={{ title: 'Commandes', href: can('orders:read') ? undefined : null }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', href: can('messages:read') ? undefined : null }} />
    </Tabs>
  );
}
