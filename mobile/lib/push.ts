import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { request } from './api';

const TOKEN_KEY = 'boutik_push_token';

// Les alertes sur téléphone ne fonctionnent ni dans Expo Go (limite de l'outil de test — elles
// n'existent que dans l'application installée), ni sur web (`expo start --web`, utilisé pour un
// aperçu rapide dans un navigateur : `expo-notifications` y lève une exception au lieu de
// simplement ne rien faire). On n'y charge donc pas le module du tout dans les deux cas.
const noNativeNotifications = () => Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Platform.OS === 'web';

async function notifications() {
  return import('expo-notifications');
}

/** À appeler une fois au démarrage : les alertes reçues application ouverte s'affichent aussi en bandeau. */
export async function setupNotificationDisplay(): Promise<void> {
  if (noNativeNotifications()) return;
  const Notifications = await notifications();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Demande l'autorisation, récupère l'identifiant de ce téléphone et le confie au serveur. */
export async function registerForPush(): Promise<void> {
  try {
    if (noNativeNotifications() || !Device.isDevice) return;
    const Notifications = await notifications();

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Alertes de l’entreprise',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await request('/admin/push-tokens', { method: 'POST', body: JSON.stringify({ token }) });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // Les alertes sont un confort : un échec ici ne doit jamais empêcher d'utiliser l'application.
  }
}

/** À la déconnexion : ce téléphone ne doit plus recevoir les alertes de l'entreprise. */
export async function unregisterFromPush(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return;
    await request('/admin/push-tokens', { method: 'DELETE', body: JSON.stringify({ token }) });
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Session déjà expirée ou réseau coupé : le serveur oubliera le jeton tout seul s'il devient invalide.
  }
}

/** Ouvre le bon écran quand on touche une alerte. Renvoie une fonction pour arrêter l'écoute. */
export async function listenToNotificationTaps(onLink: (link: string | null) => void): Promise<() => void> {
  if (noNativeNotifications()) return () => undefined;
  const Notifications = await notifications();

  const handle = (response: import('expo-notifications').NotificationResponse | null) => {
    const link = response?.notification.request.content.data?.link;
    onLink(typeof link === 'string' ? link : null);
  };

  // Application lancée directement en touchant une alerte.
  const last = await Notifications.getLastNotificationResponseAsync();
  if (last) handle(last);

  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
