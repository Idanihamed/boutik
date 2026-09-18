// Rôles de la plateforme. PLATFORM_ADMIN et CUSTOMER n'appartiennent à aucune entreprise ; les
// trois rôles du personnel sont rattachés à UNE entreprise (User.businessId).
export const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN';
export const CUSTOMER_ROLE = 'CUSTOMER';
export const OWNER_ROLE = 'OWNER';
export const STAFF_ROLES = [OWNER_ROLE, 'GESTIONNAIRE', 'EDITEUR'] as const;
