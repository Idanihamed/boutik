// Base de données DÉDIÉE aux tests d'intégration : elle est intégralement effacée à chaque
// exécution (voir global-setup.ts) — d'où le garde-fou sur son nom.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://amza:amza_dev_pw@localhost:5432/boutik_test?schema=public';

export const PLATFORM_ADMIN = { email: 'platform@test.local', password: 'PlatformPass-2026!' };

export function assertIsTestDatabase(url: string): void {
  if (!/\/[^/?]*_test(\?|$)/.test(url)) {
    throw new Error(`Refus d'effacer une base qui ne se termine pas par _test : ${url}`);
  }
}
