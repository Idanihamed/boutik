import { execSync } from 'child_process';
import * as path from 'path';
import { PLATFORM_ADMIN, TEST_DATABASE_URL, assertIsTestDatabase } from './test-config';

// Repart d'une base vierge (migrations + rôles/permissions + compte plateforme) avant les tests.
export default async function globalSetup() {
  assertIsTestDatabase(TEST_DATABASE_URL);
  const cwd = path.resolve(__dirname, '..');
  const env = {
    ...process.env,
    DATABASE_URL: TEST_DATABASE_URL,
    SEED_PLATFORM_ADMIN_EMAIL: PLATFORM_ADMIN.email,
    SEED_PLATFORM_ADMIN_PASSWORD: PLATFORM_ADMIN.password,
  };
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', { cwd, env, stdio: 'pipe' });
  execSync('npx ts-node prisma/seed.ts', { cwd, env, stdio: 'pipe' });
}
