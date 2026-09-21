import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../lib/labels';
import { SessionProvider } from '../lib/session';

export default function RootLayout() {
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
      </Stack>
    </SessionProvider>
  );
}
