// Formats des réponses de l'API (miroir de frontend/lib/types.ts, limité à ce que l'application utilise).

export type BusinessStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'BANNED';
export type OrderStatus = 'EN_ATTENTE' | 'CONFIRMEE' | 'EN_PREPARATION' | 'EXPEDIEE' | 'LIVREE' | 'ANNULEE';
export type StockStatus = 'DISPONIBLE' | 'STOCK_FAIBLE' | 'RUPTURE';
export type ProductStatus = 'DRAFT' | 'PUBLISHED';
export type MessageStatus = 'NOUVEAU' | 'LU' | 'TRAITE';

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

export interface DashboardStats {
  products: { total: number; published: number; draft: number };
  stock: { lowStock: number; outOfStock: number };
  messages: { untreated: number };
  orders: { pending: number };
}

export interface AdminOrder {
  id: string;
  reference: string;
  customerName: string;
  customerContact: string;
  customerAddress: string | null;
  notes: string | null;
  status: OrderStatus;
  totalAmount: number;
  discountAmount: number;
  shippingFee: number;
  promoCode: string | null;
  items: { productName: string; unitPrice: number; quantity: number; subtotal: number }[];
  boutique: { name: string; address: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMessageRow {
  id: string;
  name: string;
  contact: string;
  subject: string;
  message: string;
  voiceUrl: string | null;
  attachmentUrl: string | null;
  status: MessageStatus;
  createdAt: string;
}

export interface AdminMessage extends AdminMessageRow {
  reference: string;
  replyMessage: string | null;
  replyVoiceUrl: string | null;
  replyAttachmentUrl: string | null;
  repliedAt: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  promoPrice: number | null;
  effectivePrice: number;
  onSale: boolean;
  stock: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
  status: ProductStatus;
  category: { id: string; name: string } | null;
  images: { url: string; alt: string | null; isMain: boolean }[];
}

export interface AppNotification {
  id: string;
  type: 'CONTACT_MESSAGE' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PROMOTION_EXPIRING' | 'NEW_ORDER';
  message: string;
  link: string | null;
  isRead: boolean;
  virtual: boolean;
  createdAt: string;
}
