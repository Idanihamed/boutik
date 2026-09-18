// Devise par défaut selon le pays (code ISO 3166-1 alpha-2 -> code ISO 4217), pour préremplir
// l'inscription d'une entreprise. Liste volontairement courte (Afrique francophone + quelques
// pays fréquents) : pour tout autre pays, la devise doit être fournie explicitement.
export const DEFAULT_CURRENCY_BY_COUNTRY: Record<string, string> = {
  CI: 'XOF',
  SN: 'XOF',
  ML: 'XOF',
  BF: 'XOF',
  BJ: 'XOF',
  TG: 'XOF',
  NE: 'XOF',
  GW: 'XOF',
  CM: 'XAF',
  GA: 'XAF',
  CG: 'XAF',
  TD: 'XAF',
  CF: 'XAF',
  GQ: 'XAF',
  GN: 'GNF',
  CD: 'CDF',
  MG: 'MGA',
  MA: 'MAD',
  DZ: 'DZD',
  TN: 'TND',
  FR: 'EUR',
  BE: 'EUR',
};

// Identifiants d'URL qui ne peuvent pas devenir le slug d'une entreprise (routes de la
// plateforme, de l'API ou de l'application).
export const RESERVED_SLUGS = new Set([
  'api',
  'admin',
  'platform',
  'plateforme',
  'auth',
  'b',
  'boutik',
  'www',
  'app',
  'login',
  'register',
  'inscription',
  'connexion',
  'uploads',
  'static',
  'assets',
  'public',
  'support',
  'aide',
  'help',
  'contact',
  'about',
]);
