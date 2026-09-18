export type BusinessStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'BANNED';
export type ReportStatus = 'OPEN' | 'DISMISSED' | 'ACTIONED';
export type ReportReason = 'SCAM' | 'INAPPROPRIATE_CONTENT' | 'FAKE_PRODUCTS' | 'IMPERSONATION' | 'OTHER';
export type ModerationAction = 'approve' | 'reject' | 'suspend' | 'ban' | 'reactivate';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  businessId: string | null;
  business: { id: string; name: string; slug: string; status: BusinessStatus; country: string; currency: string } | null;
  permissions: string[];
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface PlatformBusinessRow {
  id: string;
  name: string;
  slug: string;
  country: string;
  currency: string;
  status: BusinessStatus;
  statusReason: string | null;
  createdAt: string;
  openReports: number;
}

export interface FlaggedBusiness {
  id: string;
  name: string;
  slug: string;
  status: BusinessStatus;
  openReports: number;
}

export interface BusinessReportItem {
  id: string;
  reason: ReportReason;
  comment: string | null;
  status: ReportStatus;
  createdAt: string;
  reporter: { id: string; name: string; email: string };
}

export interface ModerationEvent {
  id: string;
  actorName: string;
  action: string;
  reason: string | null;
  createdAt: string;
}

export interface BusinessDetail {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  country: string;
  currency: string;
  status: BusinessStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  users: { id: string; name: string; email: string; isActive: boolean; role: { name: string } }[];
  moderationLog: ModerationEvent[];
  reports: BusinessReportItem[];
}

export type StockStatus = 'DISPONIBLE' | 'STOCK_FAIBLE' | 'RUPTURE';
export type ProductStatus = 'DRAFT' | 'PUBLISHED';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  isActive: boolean;
}

export interface ProductImage {
  id?: string;
  url: string;
  alt?: string | null;
  isMain: boolean;
}

export interface ProductAttribute {
  key: string;
  value: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  category: { id: string; name: string; slug: string } | null;
  brand: { id: string; name: string; slug: string } | null;
  shortDescription: string | null;
  description: string | null;
  price: number;
  promoPrice: number | null;
  effectivePrice: number;
  onSale: boolean;
  stock: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
  warranty: string | null;
  isFeatured: boolean;
  status: ProductStatus;
  images: ProductImage[];
  attributes: ProductAttribute[];
  createdAt: string;
  updatedAt: string;
}

/** Corps envoyé à l'API pour créer ou modifier un produit. */
export interface ProductInput {
  name: string;
  sku: string;
  categoryId: string;
  // null / '' à la modification : retire la marque, le prix promo ou le texte.
  brandId?: string | null;
  shortDescription?: string;
  description?: string;
  price: number;
  promoPrice?: number | null;
  stock: number;
  lowStockThreshold: number;
  warranty?: string;
  isFeatured: boolean;
  status: ProductStatus;
  images: { url: string; alt?: string; isMain: boolean; sortOrder: number }[];
  attributes: { key: string; value: string; sortOrder: number }[];
}

export interface MyBusiness {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  country: string;
  currency: string;
  status: BusinessStatus;
  statusReason: string | null;
}
