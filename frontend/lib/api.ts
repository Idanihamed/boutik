import type {
  AuthUser,
  Brand,
  BusinessDetail,
  BusinessStatus,
  AdminMessage,
  AdminMessageRow,
  AdminOrder,
  Category,
  DashboardStats,
  FlaggedBusiness,
  MessageStatus,
  ModerationAction,
  MyBusiness,
  OrderStatus,
  Paginated,
  PlatformBusinessRow,
  Product,
  ProductInput,
  ProductStatus,
  Promotion,
  PromotionInput,
  ReportStatus,
  Settings,
  TeamMember,
  TeamMemberInput,
} from './types';

// Chemin relatif : le site relaie /api vers l'API (voir next.config.mjs), pour que les cookies
// de session restent « premier parti ».
const API_URL = '/api';
const CSRF_COOKIE = 'boutik_csrf_token';
const CSRF_HEADER = 'x-csrf-token';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function toError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
  return new ApiError(message ?? 'Une erreur est survenue. Merci de réessayer.', res.status);
}

async function tryRefresh(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { [CSRF_HEADER]: readCookie(CSRF_COOKIE) ?? '' },
  });
  return res.ok;
}

/**
 * Requête authentifiée : les cookies (dont l'access token httpOnly) partent automatiquement ;
 * on ajoute l'en-tête CSRF pour les requêtes qui modifient un état. Un 401 déclenche UN
 * rafraîchissement de session avant de réessayer.
 */
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isMutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  // Un FormData (téléversement) définit lui-même son Content-Type avec la bonne frontière.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const doFetch = () =>
    fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(isMutating ? { [CSRF_HEADER]: readCookie(CSRF_COOKIE) ?? '' } : {}),
        ...(options.headers ?? {}),
      },
    });

  let res = await doFetch();
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await tryRefresh()) res = await doFetch();
  }
  if (!res.ok) throw await toError(res);
  return (res.status === 204 ? null : await res.json()) as T;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

// ---------- Authentification ----------

export async function login(email: string, password: string): Promise<void> {
  await request('/auth/login', json({ email, password }));
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' }).catch(() => undefined);
}

/** Compte connecté, ou null si personne n'est connecté. */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    return await request<AuthUser>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

export interface RegisterBusinessInput {
  ownerName: string;
  email: string;
  password: string;
  businessName: string;
  slug?: string;
  country: string;
  description?: string;
}

export function registerBusiness(input: RegisterBusinessInput) {
  return request<{ business: { id: string; name: string; slug: string; status: BusinessStatus } }>(
    '/businesses/register',
    json(input),
  );
}

// ---------- Espace plateforme (modération) ----------

export function listPlatformBusinesses(params: { status?: BusinessStatus; search?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  query.set('page', String(params.page ?? 1));
  query.set('limit', '20');
  return request<Paginated<PlatformBusinessRow>>(`/platform/businesses?${query}`);
}

export function getPlatformBusiness(id: string) {
  return request<BusinessDetail>(`/platform/businesses/${id}`);
}

export function moderateBusiness(id: string, action: ModerationAction, reason?: string) {
  return request<{ id: string; status: BusinessStatus }>(`/platform/businesses/${id}/${action}`, json({ reason }));
}

export function listFlaggedBusinesses() {
  return request<FlaggedBusiness[]>('/platform/reports/flagged');
}

export function setReportStatus(reportId: string, status: Exclude<ReportStatus, 'OPEN'>) {
  return request(`/platform/reports/${reportId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

// ---------- Espace du responsable : catalogue ----------

const send = (method: 'PATCH' | 'DELETE' | 'POST', body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await request<{ url: string }>('/admin/media/upload', { method: 'POST', body: form });
  return res.url;
}

export const getMyBusiness = () => request<MyBusiness>('/admin/business');
export const updateMyBusiness = (
  input: Partial<Pick<MyBusiness, 'name' | 'logo' | 'description' | 'country' | 'currency'>>,
) => request<MyBusiness>('/admin/business', send('PATCH', input));

export type CategoryInput = { name: string; description?: string; image?: string; isActive: boolean; sortOrder: number };
export const listCategories = () => request<Category[]>('/admin/categories');
export const createCategory = (input: CategoryInput) => request<Category>('/admin/categories', send('POST', input));
export const updateCategory = (id: string, input: Partial<CategoryInput>) =>
  request<Category>(`/admin/categories/${id}`, send('PATCH', input));
export const deleteCategory = (id: string) => request(`/admin/categories/${id}`, send('DELETE'));

export type BrandInput = { name: string; logo?: string; isActive: boolean };
export const listBrands = () => request<Brand[]>('/admin/brands');
export const createBrand = (input: BrandInput) => request<Brand>('/admin/brands', send('POST', input));
export const updateBrand = (id: string, input: Partial<BrandInput>) =>
  request<Brand>(`/admin/brands/${id}`, send('PATCH', input));
export const deleteBrand = (id: string) => request(`/admin/brands/${id}`, send('DELETE'));

export function listProducts(params: { search?: string; status?: ProductStatus; category?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.category) query.set('category', params.category);
  query.set('page', String(params.page ?? 1));
  query.set('limit', '20');
  return request<Paginated<Product>>(`/admin/products?${query}`);
}
export const getProduct = (id: string) => request<Product>(`/admin/products/${id}`);
export const createProduct = (input: ProductInput) => request<Product>('/admin/products', send('POST', input));
export const updateProduct = (id: string, input: Partial<ProductInput>) =>
  request<Product>(`/admin/products/${id}`, send('PATCH', input));
export const deleteProduct = (id: string) => request(`/admin/products/${id}`, send('DELETE'));
export const setProductPublication = (id: string, action: 'publish' | 'unpublish') =>
  request<Product>(`/admin/products/${id}/${action}`, send('PATCH'));
export const duplicateProduct = (id: string) => request<Product>(`/admin/products/${id}/duplicate`, send('POST'));
export const adjustProductStock = (id: string, delta: number) =>
  request<Product>(`/admin/products/${id}/stock`, send('PATCH', { delta }));

// ---------- Espace du responsable : commandes, messages, paramètres ----------

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

export function listMessages(params: { status?: MessageStatus; page?: number }) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  query.set('page', String(params.page ?? 1));
  query.set('limit', '20');
  return request<Paginated<AdminMessageRow>>(`/admin/messages?${query}`);
}
export const getMessage = (id: string) => request<AdminMessage>(`/admin/messages/${id}`);
export const setMessageStatus = (id: string, status: MessageStatus) =>
  request<AdminMessage>(`/admin/messages/${id}/status`, send('PATCH', { status }));
export const replyToMessage = (id: string, reply: string) =>
  request<AdminMessage>(`/admin/messages/${id}/reply`, send('PATCH', { reply }));
export const deleteMessage = (id: string) => request(`/admin/messages/${id}`, send('DELETE'));

export const getSettings = () => request<Settings>('/admin/settings');
export const updateSettings = (input: Partial<Record<keyof Settings, string>>) =>
  request<Settings>('/admin/settings', send('PATCH', input));

export const getDashboardStats = () => request<DashboardStats>('/admin/dashboard/stats');

export function registerCustomer(input: { name: string; email: string; password: string }) {
  return request<{ id: string; name: string; email: string }>('/auth/register', json(input));
}

/** Adresse de retour après connexion : uniquement un chemin interne (jamais un lien vers un autre site). */
export function safeReturnPath(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : null;
}

// ---------- Promotions ----------

export function listPromotions(params: { page?: number } = {}) {
  return request<Paginated<Promotion>>(`/admin/promotions?page=${params.page ?? 1}&limit=50`);
}
export const createPromotion = (input: PromotionInput) => request<Promotion>('/admin/promotions', send('POST', input));
export const updatePromotion = (id: string, input: Partial<PromotionInput>) =>
  request<Promotion>(`/admin/promotions/${id}`, send('PATCH', input));
export const deletePromotion = (id: string) => request(`/admin/promotions/${id}`, send('DELETE'));
export const setPromotionStatus = (id: string, action: 'activate' | 'disable' | 'draft') =>
  request<Promotion>(`/admin/promotions/${id}/${action}`, send('PATCH'));

// ---------- Équipe ----------

export const listTeam = () => request<TeamMember[]>('/admin/users');
export const createTeamMember = (input: TeamMemberInput & { password: string }) =>
  request<TeamMember>('/admin/users', send('POST', input));
export const updateTeamMember = (id: string, input: Partial<TeamMemberInput>) =>
  request<TeamMember>(`/admin/users/${id}`, send('PATCH', input));
export const deleteTeamMember = (id: string) => request(`/admin/users/${id}`, send('DELETE'));
