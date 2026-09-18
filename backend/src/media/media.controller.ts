import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as crypto from 'crypto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { MediaService } from './media.service';

// L'extension du fichier enregistré est dérivée du MIME type VALIDÉ (voir ci-dessous),
// jamais du nom de fichier d'origine (`file.originalname`), qui vient du client et n'a
// aucune raison de correspondre à son contenu réel.
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const ALLOWED_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);
// §21 du cahier des charges — réglable via MAX_UPLOAD_SIZE_MB (.env) sans redéploiement de code.
const MAX_SIZE_BYTES = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 5) * 1024 * 1024;

/**
 * Vérifie les premiers octets du fichier reçu en mémoire (signature/"magic bytes"), en plus
 * du `Content-Type` déclaré par le client dans `fileFilter` ci-dessous.
 *
 * Sans ce contrôle, `fileFilter` ne validait QUE l'en-tête `Content-Type` du formulaire
 * multipart — une valeur entièrement déclarative, trivialement falsifiable (n'importe quel
 * client HTTP peut annoncer `Content-Type: image/png` sur un fichier dont le contenu réel
 * est tout autre chose, y compris du HTML/SVG avec `<script>`). Combiné au fait que
 * l'extension du fichier enregistré était auparavant dérivée du nom de fichier d'origine
 * (`extname(file.originalname)`, lui aussi librement choisi par le client, indépendamment du
 * `Content-Type` déclaré), un compte disposant seulement de `media:upload` — donc un
 * Éditeur, pas forcément un Super Admin — pouvait faire enregistrer sur le serveur un
 * fichier `.svg` (ou toute autre extension) contenant un script, publiquement accessible
 * sous `/uploads/...`. Le site public et le back-office étant sur une origine différente de
 * l'API (voir `CORS_ORIGIN`), ce n'est pas exploitable pour voler les tokens `localStorage`
 * dans la configuration actuelle (voir la limite correspondante dans le README) — mais rien
 * ne garantit que ce restera vrai dans tous les déploiements futurs (ex. API et front
 * derrière le même nom de domaine), donc autant fermer la porte dès maintenant.
 */
function matchesImageSignature(buffer: Buffer, mimetype: string): boolean {
  switch (mimetype) {
    case 'image/jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    default:
      return false;
  }
}

@Controller('admin/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @RequirePermissions('media:upload')
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      // En mémoire (pas sur disque) : MediaService.saveFile() décide ensuite où persister le
      // fichier (disque local ou Cloudinary, voir STORAGE_DRIVER) — le stockage local n'était
      // auparavant possible qu'en écrivant automatiquement sur disque via `diskStorage`,
      // incompatible avec un stockage cloud alternatif.
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException('Formats acceptés : JPG, PNG, WebP.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');

    if (!matchesImageSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        "Le contenu du fichier ne correspond pas à un format d'image accepté (JPG, PNG, WebP).",
      );
    }

    const filename = `${crypto.randomUUID()}${EXTENSION_BY_MIME[file.mimetype] ?? ''}`;
    const url = await this.mediaService.saveFile(file.buffer, filename);
    return { url, originalName: file.originalname };
  }
}
