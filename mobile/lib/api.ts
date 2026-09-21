import * as SecureStore from 'expo-secure-store';
import type {
  AdminMessage,
  AdminMessageRow,
  AdminOrder,
  AppNotification,
  AuthUser,
  DashboardStats,
  MessageStatus,
  OrderStatus,
  Paginated,
  Product,
} from './types';

// Adresse de l'API : par défaut celle de la version en ligne. Pour tester contre un serveur local,
// lancer avec EXPO_PUBLIC_API_URL=http://<adresse-du-pc>:3101/api
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://boutik-api.onrender.com/api';

// L'hébergement gratuit s'endort : le premier appel peut prendre une minute.
const TIMEOUT_MS = 70_000;

const ACCESS_KEY = 'boutik_access_token';
const REFRESH_KEY = 'boutik_refresh_token';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

// ---------- Jetons (stockage sécurisé du téléphone) ----------

export async function saveTokens(tokens: { accessToken: string; refreshToken: string }) {
  await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export const hasStoredSession = async () => Boolean(await SecureStore.getItemAsync(REFRESH_KEY));

// ---------- Requêtes ----------

async function rawFetch(path: string, options: RequestInit, token: string | null): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'X-Client': 'mobile',
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.', 0);
  } finally {
    clearTimeout(timer);
  }
}

async function toError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
  return new ApiError(message ?? 'Une erreur est survenue. Merci de réessayer.', res.status);
}

// Un seul renouvellement à la fois : plusieurs requêtes qui expirent ensemble partagent le même.
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

/** Appelé quand la session ne peut plus être renouvelée (le téléphone revient à l'écran de connexion). */
export function setSessionLostHandler(handler: (() => void) | null) {
  onSessionLost = handler;
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return false;
  const res = await rawFetch('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }, null).catch(() => null);
  if (!res) return true; // Réseau coupé : on garde la session, la requête échouera proprement.
  if (!res.ok) {
    await clearTokens();
    return false;
  }
  await saveTokens(await res.json());
  return true;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, options, await SecureStore.getItemAsync(ACCESS_KEY));

  if (res.status === 401 && !path.startsWith('/auth/')) {
    refreshing ??= refreshSession().finally(() => {
      refreshing = null;
    });
    if (await refreshing) {
      res = await rawFetch(path, options, await SecureStore.getItemAsync(ACCESS_KEY));
    } else {
      onSessionLost?.();
    }
  }
  if (!res.ok) throw await toError(res);
  return (res.status === 204 ? null : await res.json()) as T;
}

const send = (method: 'PATCH' | 'POST' | 'DELETE', body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

// ---------- Session ----------

export async function login(email: string, password: string): Promise<void> {
  const res = await rawFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, null);
  if (!res.ok) throw await toError(res);
  await saveTokens(await res.json());
}

export async function logout(): Promise<void> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (refreshToken) {
    await rawFetch('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }, null).catch(() => undefined);
  }
  await clearTokens();
}

export const fetchMe = () => request<AuthUser>('/auth/me');

// ---------- Données du responsable ----------

export const getDashboardStats = () => request<DashboardStats>('/admin/dashboard/stats');

export function listOrders(params: { status?: OrderStatus; page?: number }) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  query.set('page', String(params.page ?? 1));
  query.set('limit', '20');
  return request<Paginated<AdminOrder>>(`/admin/orders?${query}`);
}
export const getOrder = (id: string) => request<AdminOrder>(`/admin/orders/${id}`);
export const setOrderStatus = (id: string, status: OrderStatus) =>
  request<AdminOrder>(`/admin/orders/${id}/status`, send('PATCH', { status }));

export function listMessages(params: { page?: number }) {
  return request<Paginated<AdminMessageRow>>(`/admin/messages?page=${params.page ?? 1}&limit=20`);
}
export const getMessage = (id: string) => request<AdminMessage>(`/admin/messages/${id}`);
export const setMessageStatus = (id: string, status: MessageStatus) =>
  request<AdminMessage>(`/admin/messages/${id}/status`, send('PATCH', { status }));
export const replyToMessage = (id: string, reply: string) =>
  request<AdminMessage>(`/admin/messages/${id}/reply`, send('PATCH', { reply }));

// ---------- Produits ----------

/** Adresse complète d'une image : les photos stockées sur le serveur sont données en chemin relatif. */
export const imageUrl = (url: string) => (url.startsWith('/') ? `${API_URL.replace(/\/api$/, '')}${url}` : url);

export function listProducts(params: { search?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  query.set('page', String(params.page ?? 1));
  query.set('limit', '20');
  return request<Paginated<Product>>(`/admin/products?${query}`);
}
export const getProduct = (id: string) => request<Product>(`/admin/products/${id}`);
export const updateProductPrices = (id: string, input: { price: number; promoPrice: number | null }) =>
  request<Product>(`/admin/products/${id}`, send('PATCH', input));
export const setProductImages = (id: string, images: { url: string; isMain: boolean; sortOrder: number }[]) =>
  request<Product>(`/admin/products/${id}`, send('PATCH', { images }));
export const adjustProductStock = (id: string, delta: number) =>
  request<Product>(`/admin/products/${id}/stock`, send('PATCH', { delta }));
export const setProductPublication = (id: string, action: 'publish' | 'unpublish') =>
  request<Product>(`/admin/products/${id}/${action}`, send('PATCH'));

/** Envoie une photo (prise ou choisie sur le téléphone) et renvoie son adresse. */
export async function uploadImage(file: { uri: string; name: string; type: string }): Promise<string> {
  const form = new FormData();
  // React Native accepte cet objet {uri, name, type} à la place d'un fichier.
  form.append('file', file as unknown as Blob);
  const res = await request<{ url: string }>('/admin/media/upload', { method: 'POST', body: form });
  return res.url;
}

// ---------- Notifications ----------

export const listNotifications = () => request<AppNotification[]>('/admin/notifications');
export const getUnreadCount = () => request<number>('/admin/notifications/unread-count');
export const markNotificationRead = (id: string) =>
  request(`/admin/notifications/${encodeURIComponent(id)}/read`, send('PATCH'));
export const markAllNotificationsRead = () => request('/admin/notifications/read-all', send('PATCH'));
