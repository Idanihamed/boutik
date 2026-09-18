export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  // null : compte de la plateforme (PLATFORM_ADMIN) ou client (CUSTOMER).
  businessId: string | null;
  permissions: string[];
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  businessId: string | null;
  permissions: string[];
}

export interface JwtRefreshPayload {
  sub: string;
  tokenId: string;
}
