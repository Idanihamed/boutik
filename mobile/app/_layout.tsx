import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../lib/labels';
import { screenFor } from '../lib/links';
import { listenToNotificationTaps, setupNotificationDisplay } from '../lib/push';
import { SessionProvider } from '../lib/session';

export default function RootLayout() {
  useEffect(() => {
    void setupNotificationDisplay();
    let stop: (() => void) | undefined;
    void listenToNotificationTaps((link) => {
      const target = screenFor(link);
      if (target) router.navigate(target);
    }).then((unsubscribe) => {
      stop = unsubscribe;
    });
    return () => stop?.();
  }, []);

  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: COLORS.brand,
          headerStyle: { backgroundColor: COLORS.card },
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="connexion" options={{ headerShown: false }} />
        <Stack.Screen name="commande/[id]" options={{ title: 'Commande' }} />
        <Stack.Screen name="message/[id]" options={{ title: 'Message' }} />
        <Stack.Screen name="produit/[id]" options={{ title: 'Produit' }} />
        <Stack.Screen name="promotions" options={{ title: 'Promotions' }} />
        <Stack.Screen name="equipe" options={{ title: 'Équipe' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      </Stack>
    </SessionProvider>
  );
}
