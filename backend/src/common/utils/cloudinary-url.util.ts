/**
 * Nettoie la valeur de CLOUDINARY_URL saisie dans un tableau de bord d'hébergeur.
 *
 * Le SDK Cloudinary lit cette variable dès son chargement et fait planter TOUT le démarrage de
 * l'API avec un message peu explicite si elle est mal formée. Les erreurs de saisie les plus
 * courantes sont donc corrigées ici plutôt que de bloquer un déploiement :
 *  - espaces ou retours à la ligne autour de la valeur ;
 *  - guillemets autour de la valeur ;
 *  - ligne entière « CLOUDINARY_URL=cloudinary://… » collée dans la case de la valeur.
 *
 * Retourne `undefined` pour une valeur vide (= Cloudinary non configuré). Lève une erreur claire,
 * sans jamais afficher la valeur (elle contient un secret), si le format reste invalide.
 */
export function normalizeCloudinaryUrl(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;

  const value = raw
    .trim()
    .replace(/^CLOUDINARY_URL\s*=\s*/i, '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .trim();

  if (value === '') return undefined;

  if (/[<>]/.test(value)) {
    throw new Error(
      'CLOUDINARY_URL contient des espaces réservés (« <your_api_key> »…) : remplacez-les par la vraie clé API, le vrai secret et le nom du compte.',
    );
  }
  if (!value.startsWith('cloudinary://')) {
    throw new Error(
      'CLOUDINARY_URL invalide : la valeur doit commencer par « cloudinary:// » (format cloudinary://CLE:SECRET@NOM_DU_COMPTE).',
    );
  }
  return value;
}
