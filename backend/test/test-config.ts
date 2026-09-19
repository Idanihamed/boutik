import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Adresse de la base de TEST, effacée à chaque exécution (voir global-setup.ts) :
 *  - TEST_DATABASE_URL si elle est définie ;
 *  - sinon celle de backend/.env avec le nom de base remplacé par « boutik_test » — uniquement si
 *    ce serveur est LOCAL, pour qu'un .env pointant vers un vrai serveur ne soit jamais utilisé
 *    par erreur pour des tests qui suppriment des données.
 */
function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const envFile = path.resolve(__dirname, '..', '.env');
  const devUrl = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)).DATABASE_URL : process.env.DATABASE_URL;
  if (!devUrl) {
    throw new Error(
      'Définissez TEST_DATABASE_URL (base dédiée aux tests, son nom doit finir par _test) ou DATABASE_URL dans backend/.env.',
    );
  }

  const url = new URL(devUrl);
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
    throw new Error(
      `DATABASE_URL pointe vers ${url.hostname}, qui n'est pas une base locale : définissez TEST_DATABASE_URL explicitement.`,
    );
  }
  url.pathname = '/boutik_test';
  return url.toString();
}

export const TEST_DATABASE_URL = resolveTestDatabaseUrl();

export const PLATFORM_ADMIN = { email: 'platform@test.local', password: 'PlatformPass-2026!' };

export function assertIsTestDatabase(url: string): void {
  if (!/\/[^/?]*_test(\?|$)/.test(url)) {
    throw new Error(`Refus d'effacer une base qui ne se termine pas par _test : ${url}`);
  }
}
