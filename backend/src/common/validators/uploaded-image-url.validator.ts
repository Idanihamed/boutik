import { registerDecorator, ValidationOptions } from 'class-validator';

const LOCAL_UPLOAD_PATTERN = /^\/uploads\//;
// Domaine Cloudinary officiel uniquement (pas de compte/cloud_name précis vérifié ici) :
// suffisant pour distinguer "vient de notre upload" d'une URL externe arbitraire, sans coupler
// ce validateur à une configuration d'environnement (voir MediaService.saveFile).
const CLOUDINARY_PATTERN = /^https:\/\/res\.cloudinary\.com\//;

/**
 * Remplace `@Matches(/^\/uploads\//)` sur les champs image (voir CreateCategoryDto,
 * CreateArticleDto, CreatePageDto, CreateBrandDto, ProductImageDto, BoutiqueImageDto) : depuis
 * l'activation optionnelle du stockage Cloudinary (STORAGE_DRIVER=cloudinary), l'upload peut
 * renvoyer soit un chemin local "/uploads/...", soit une URL "https://res.cloudinary.com/...".
 * Un `@Matches` figé sur le seul cas local rejetterait désormais la création/mise à jour de
 * tout produit/catégorie/article/page dès qu'une image vient de Cloudinary. La protection
 * d'origine (empêcher une URL externe arbitraire de faire planter `next/image`, §21) reste
 * intacte : seuls ces deux formats précis sont acceptés, toujours pas d'URL libre.
 */
export function IsUploadedImageUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUploadedImageUrl',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} doit être un chemin "/uploads/..." ou une URL Cloudinary renvoyés par l’upload.`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && (LOCAL_UPLOAD_PATTERN.test(value) || CLOUDINARY_PATTERN.test(value));
        },
      },
    });
  };
}
