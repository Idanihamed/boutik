import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { BellButton } from '../../components/BellButton';
import { Loader } from '../../components/ui';
import { COLORS } from '../../lib/labels';
import { useSession } from '../../lib/session';

// Petites icônes en émoji : aucune bibliothèque d'icônes à embarquer, lisibles sur tout téléphone.
const icon = (glyph: string) =>
  function TabIcon() {
    return <Text style={{ fontSize: 20 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  const { user, loading, can } = useSession();
  if (loading) return <Loader />;
  if (!user) return <Redirect href="/connexion" />;

  return (
    <Tabs
      screenOptions={{
        headerRight: () => <BellButton />,
        headerTintColor: COLORS.text,
        headerStyle: { backgroundColor: COLORS.card },
        tabBarActiveTintColor: COLORS.brand,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen
        name="commandes"
        options={{ title: 'Commandes', tabBarIcon: icon('📦'), href: can('orders:read') ? undefined : null }}
      />
      <Tabs.Screen
        name="produits"
        options={{ title: 'Produits', tabBarIcon: icon('🛍️'), href: can('products:read') ? undefined : null }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: 'Messages', tabBarIcon: icon('✉️'), href: can('messages:read') ? undefined : null }}
      />
    </Tabs>
  );
}
