import { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { IsUploadedImageUrl } from '../../common/validators/uploaded-image-url.validator';

// Route publique, non authentifiée (voir contact-messages.controller.ts) : au-delà de la
// limite de fréquence par IP (5/10 min, voir le service), rien ne bornait la taille de
// chaque champ. Un seul message avec un `message` de plusieurs mégaoctets suffisait à
// contourner en bonne partie cette limite (peu de requêtes, mais chacune volumineuse) et à
// alourdir inutilement le stockage et l'affichage dans `/admin/messages`. Des longueurs
// maximales généreuses mais réalistes ferment cette porte sans gêner un usage normal.
export class CreateContactMessageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /** Téléphone ou email — un seul champ de contact, tel que défini au §23. */
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  contact: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  subject: string;

  // Optionnel : un message uniquement vocal (voir voiceUrl) peut laisser ce champ vide.
  // Au moins l'un des deux doit être présent — vérifié dans ContactMessagesService.create,
  // pas ici, car class-validator ne compare pas nativement deux champs optionnels entre eux.
  @IsOptional()
  @ValidateIf((o) => !!o.message)
  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  message?: string;

  // Chemin "/uploads/..." renvoyé par l'upload vocal public (voir
  // ContactMessagesController.uploadVoice), au même titre que les champs image ailleurs.
  @IsOptional()
  @IsString()
  @Matches(/^\/uploads\//, { message: 'voiceUrl doit être un chemin "/uploads/..." renvoyé par l’upload vocal.' })
  voiceUrl?: string;

  // URL renvoyée par ContactMessagesController.uploadAttachment (photo ou vidéo) — locale ou
  // Cloudinary selon STORAGE_DRIVER, voir uploaded-image-url.validator.ts.
  @IsOptional()
  @IsString()
  @IsUploadedImageUrl()
  attachmentUrl?: string;

  /**
   * Champ honeypot anti-spam : invisible pour un humain (masqué en CSS côté formulaire),
   * donc laissé vide par un utilisateur réel. Un bot qui remplit tous les champs le
   * remplira aussi. Décision produit assumée faute de validation client explicite sur le
   * §23 (voir README) : à ajuster si un vrai niveau de spam est observé en production.
   */
  @IsOptional()
  @IsString()
  website?: string;
}
