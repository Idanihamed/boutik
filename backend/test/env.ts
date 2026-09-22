import { PLATFORM_ADMIN, TEST_DATABASE_URL } from './test-config';

// Exécuté avant chaque fichier de test, AVANT le chargement de l'application : ces valeurs
// priment sur backend/.env (dotenv n'écrase jamais une variable déjà définie).
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.COOKIE_SECURE = 'false';
process.env.REPORT_ALERT_THRESHOLD = '3';
process.env.SEED_PLATFORM_ADMIN_EMAIL = PLATFORM_ADMIN.email;
process.env.SEED_PLATFORM_ADMIN_PASSWORD = PLATFORM_ADMIN.password;
delete process.env.RESEND_API_KEY; // aucun email réel pendant les tests
delete process.env.PLATFORM_ALERT_EMAIL;
delete process.env.SENTRY_DSN; // aucun envoi réel à Sentry pendant les tests
