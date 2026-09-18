import slugify from 'slugify';

/**
 * Génère un slug propre et cohérent (URLs SEO-friendly, §32 du cahier des charges).
 */
export function toSlug(text: string): string {
  return slugify(text, { lower: true, strict: true, trim: true });
}
