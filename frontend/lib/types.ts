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
  business: { id: string; name: string; slug: string; status: BusinessStatus } | null;
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
