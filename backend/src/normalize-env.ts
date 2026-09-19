import { normalizeCloudinaryUrl } from './common/utils/cloudinary-url.util';

// À importer EN PREMIER dans main.ts : le SDK Cloudinary lit process.env.CLOUDINARY_URL au moment
// où il est chargé (par MediaService), donc la variable doit être corrigée avant tout autre import.
const raw = process.env.CLOUDINARY_URL;
let cleaned: string | undefined;
try {
  cleaned = normalizeCloudinaryUrl(raw);
} catch (error) {
  // Valeur irrécupérable : on démarre quand même (stockage local) plutôt que de bloquer le déploiement.
  // eslint-disable-next-line no-console
  console.error(`⚠️ ${(error as Error).message} Cloudinary désactivé : les photos resteront sur le disque local.`);
  cleaned = undefined;
}

if (cleaned === undefined) {
  delete process.env.CLOUDINARY_URL;
} else {
  if (cleaned !== raw) {
    // eslint-disable-next-line no-console
    console.warn('CLOUDINARY_URL a été corrigée automatiquement (espaces, guillemets ou préfixe en trop).');
  }
  process.env.CLOUDINARY_URL = cleaned;
}
