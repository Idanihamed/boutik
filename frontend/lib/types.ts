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
  discountPercentage?: number;
  appliedPromotion?: { id: string; name: string } | null;
  onSale: boolean;
  stock: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
  warranty: string | null;
  isFeatured: boolean;
  status: ProductStatus;
  images: ProductImage[];
  attributes: ProductAttribute[];
  hasVariants: boolean;
  variantOption1Name: string | null;
  variantOption2Name: string | null;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  label: string;
  option1Value: string | null;
  option2Value: string | null;
  sku: string | null;
  price: number;
  promoPrice: number | null;
  // Valeur brute (null = « hérite du produit »), distincte de price/promoPrice ci-dessus (déjà
  // résolus) : sert à préremplir le formulaire sans afficher le prix du produit comme le sien.
  priceOverride: number | null;
  promoPriceOverride: number | null;
  effectivePrice: number;
  discountPercentage: number;
  onSale: boolean;
  stock: number;
  stockStatus: StockStatus;
  image: string | null;
  isActive: boolean;
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
  hasVariants?: boolean;
  variantOption1Name?: string;
  variantOption2Name?: string;
  variants?: {
    option1Value?: string;
    option2Value?: string;
    sku?: string;
    price?: number | null;
    promoPrice?: number | null;
    stock: number;
    isActive?: boolean;
  }[];
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

// ---------- Vitrine publique ----------

export interface Storefront {
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  country: string;
  currency: string;
  settings: {
    whatsappNumber: string | null;
    mobileMoneyProvider: string | null;
    mobileMoneyNumber: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    tiktokUrl: string | null;
    youtubeUrl: string | null;
    linkedinUrl: string | null;
    xUrl: string | null;
    heroImage1: string | null;
    heroImage2: string | null;
    shippingFee?: number;
    freeShippingThreshold?: number | null;
  } | null;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
}

export interface ActivePromotion {
  id: string;
  name: string;
  bannerTitle: string | null;
  bannerSubtitle: string | null;
  bannerImage: string | null;
  productCount: number;
}

export type OrderStatus = 'EN_ATTENTE' | 'CONFIRMEE' | 'EN_PREPARATION' | 'EXPEDIEE' | 'LIVREE' | 'ANNULEE';

export interface OrderTracking {
  reference: string;
  status: OrderStatus;
  totalAmount: number;
  discountAmount: number;
  shippingFee: number;
  promoCode: string | null;
  customerAddress: string | null;
  paymentReference: string | null;
  createdAt: string;
  items: { productName: string; unitPrice: number; quantity: number; subtotal: number }[];
}

export type MessageStatus = 'NOUVEAU' | 'LU' | 'TRAITE';

export interface MessageTracking {
  reference: string;
  subject: string;
  status: MessageStatus;
  createdAt: string;
  reply: string | null;
  replyVoiceUrl: string | null;
  repliedAt: string | null;
}

// ---------- Espace du responsable : commandes, messages, paramètres ----------

export interface AdminOrder {
  id: string;
  reference: string;
  customerName: string;
  customerContact: string;
  customerAddress: string | null;
  notes: string | null;
  paymentReference: string | null;
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

export interface Settings {
  whatsappNumber: string | null;
  mobileMoneyProvider: string | null;
  mobileMoneyNumber: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  linkedinUrl: string | null;
  xUrl: string | null;
  heroImage1: string | null;
  heroImage2: string | null;
}

export interface DashboardStats {
  products: { total: number; published: number; draft: number };
  stock: { lowStock: number; outOfStock: number };
  messages: { untreated: number };
  orders: { pending: number };
}

// ---------- Promotions (espace du responsable) ----------

export type PromotionType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FIXED_PRICE';
export type PromotionAdminStatus = 'DRAFT' | 'ACTIVE' | 'DISABLED';
export type PromotionDisplayStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'DISABLED';

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: PromotionType;
  value: number;
  startsAt: string;
  endsAt: string;
  adminStatus: PromotionAdminStatus;
  displayStatus: PromotionDisplayStatus;
  conditions: string | null;
  bannerTitle: string | null;
  bannerSubtitle: string | null;
  bannerImage: string | null;
  products: { id: string; name: string; slug: string }[];
  categories: { id: string; name: string; slug: string }[];
}

export interface PromotionInput {
  name: string;
  description?: string;
  type: PromotionType;
  value: number;
  startsAt: string;
  endsAt: string;
  conditions?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  bannerImage?: string;
  productIds: string[];
  categoryIds: string[];
}

// ---------- Équipe (espace du responsable) ----------

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface TeamMemberInput {
  name: string;
  email: string;
  roleName: string;
  password?: string;
  isActive?: boolean;
}

// ---------- Boutiques physiques ----------

export interface Boutique {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string | null;
  whatsapp: string | null;
  hours: string | null;
  description: string | null;
  googleMapsUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  images: { id: string; url: string; alt: string | null; isMain: boolean }[];
}

export interface BoutiqueInput {
  name: string;
  address: string;
  phone?: string;
  whatsapp?: string;
  hours?: string;
  description?: string;
  googleMapsUrl?: string;
  isActive: boolean;
  images: { url: string; isMain: boolean; sortOrder: number }[];
}

// ---------- Notifications (cloche) ----------

export interface AppNotification {
  id: string;
  type: 'CONTACT_MESSAGE' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PROMOTION_EXPIRING' | 'NEW_ORDER' | 'PAYMENT_INFO_CHANGED';
  message: string;
  link: string | null;
  isRead: boolean;
  virtual: boolean;
  createdAt: string;
}

// ---------- Annuaire public ----------

export interface DirectoryEntry {
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  country: string;
}

// ---------- Livraison et codes promo ----------

export interface ShippingSettings {
  shippingFee: number;
  freeShippingThreshold: number | null;
}

export type PromoCodeType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface PromoCode {
  id: string;
  code: string;
  type: PromoCodeType;
  value: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

export interface PromoCodeInput {
  code: string;
  type: PromoCodeType;
  value: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

/** Aperçu d'un panier calculé par le serveur : ce qui sera réellement facturé. */
export interface OrderQuote {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  freeShippingThreshold: number | null;
  promoCode: { code: string; valid: boolean; message: string | null } | null;
}

// ---------- Mes commandes (compte client) ----------

export interface MyOrderRow {
  id: string;
  reference: string;
  status: OrderStatus;
  totalAmount: number;
  itemCount: number;
  business: { name: string; slug: string; currency: string };
  createdAt: string;
}

export interface MyOrderDetail {
  id: string;
  reference: string;
  status: OrderStatus;
  totalAmount: number;
  discountAmount: number;
  shippingFee: number;
  promoCode: string | null;
  customerAddress: string | null;
  boutique: { name: string; address: string } | null;
  business: { name: string; slug: string; currency: string };
  createdAt: string;
  items: { productName: string; unitPrice: number; quantity: number; subtotal: number }[];
}

// ---------- Statistiques de la plateforme ----------

export interface PlatformStats {
  businesses: {
    total: number;
    byStatus: Record<BusinessStatus, number>;
    newLast7Days: number;
    newLast30Days: number;
  };
  orders: { total: number; last7Days: number; last30Days: number };
  products: { total: number; published: number };
  reports: { open: number };
  topBusinessesLast30Days: { name: string; slug: string; orderCount: number }[];
}
