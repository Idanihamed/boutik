import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { diskStorage, memoryStorage } from 'multer';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { MediaService } from '../media/media.service';
import { ContactMessagesService } from './contact-messages.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { QueryContactMessagesDto } from './dto/query-contact-messages.dto';
import { ReplyContactMessageDto } from './dto/reply-contact-message.dto';
import { TrackContactMessageDto } from './dto/track-contact-message.dto';
import { UpdateContactMessageStatusDto } from './dto/update-contact-message-status.dto';

// Message vocal du formulaire de contact (accessibilité — voir CreateContactMessageDto) :
// route publique non authentifiée, donc validée indépendamment de media.controller.ts
// (réservée à media:upload) — mêmes principes (extension dérivée du MIME validé, signature
// de fichier vérifiée), avec une limite de taille propre, plus basse, adaptée à un message
// vocal court plutôt qu'à un média admin quelconque.
const VOICE_EXTENSION_BY_MIME: Record<string, string> = {
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
};
const VOICE_ALLOWED_MIME_TYPES = Object.keys(VOICE_EXTENSION_BY_MIME);
const VOICE_MAX_SIZE_BYTES = 4 * 1024 * 1024;

// Interceptor partagé entre l'upload vocal visitor (contact/voice) et admin (réponse à un
// message, voir uploadReplyVoice ci-dessous) : mêmes formats/limite/validation de signature,
// seule la route et l'autorisation diffèrent.
function voiceFileInterceptor() {
  return FileInterceptor('file', {
    storage: diskStorage({
      destination: process.env.UPLOAD_DIR ?? 'uploads',
      filename: (_req, file, callback) => {
        const uniqueName = `${crypto.randomUUID()}${VOICE_EXTENSION_BY_MIME[file.mimetype] ?? ''}`;
        callback(null, uniqueName);
      },
    }),
    limits: { fileSize: VOICE_MAX_SIZE_BYTES },
    fileFilter: (_req, file, callback) => {
      if (!VOICE_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        callback(new BadRequestException('Formats acceptés : webm, ogg, m4a.'), false);
        return;
      }
      callback(null, true);
    },
  });
}

function assertValidVoiceUpload(file?: Express.Multer.File): asserts file is Express.Multer.File {
  if (!file) throw new BadRequestException('Aucun fichier reçu.');
  if (!matchesAudioSignature(file.path, file.mimetype)) {
    fs.unlinkSync(file.path);
    throw new BadRequestException(
      "Le contenu du fichier ne correspond pas à un format audio accepté (webm, ogg, m4a).",
    );
  }
}

function matchesAudioSignature(filePath: string, mimetype: string): boolean {
  const buffer = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, buffer, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }

  switch (mimetype) {
    case 'audio/webm':
      // EBML (conteneur Matroska/WebM).
      return buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
    case 'audio/ogg':
      return buffer.subarray(0, 4).toString('ascii') === 'OggS';
    case 'audio/mp4':
      return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    default:
      return false;
  }
}

// Pièce jointe (photo ou vidéo) du formulaire de contact — visiteur → admin (voir
// CreateContactMessageDto.attachmentUrl). En mémoire (pas disque direct) car le fichier peut
// finir sur Cloudinary selon STORAGE_DRIVER (voir MediaService.saveFile), au même principe que
// media.controller.ts. Limite de taille plus haute que pour l'image/le vocal : une courte
// vidéo pèse nettement plus qu'une photo.
const ATTACHMENT_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};
const ATTACHMENT_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const ATTACHMENT_ALLOWED_MIME_TYPES = Object.keys(ATTACHMENT_EXTENSION_BY_MIME);
const ATTACHMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024;

function attachmentFileInterceptor() {
  return FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: ATTACHMENT_MAX_SIZE_BYTES },
    fileFilter: (_req, file, callback) => {
      if (!ATTACHMENT_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        callback(new BadRequestException('Formats acceptés : JPG, PNG, WebP, MP4, WebM, MOV.'), false);
        return;
      }
      callback(null, true);
    },
  });
}

// Même principe que matchesImageSignature (media.controller.ts) et matchesAudioSignature
// ci-dessous : le Content-Type déclaré par le client est purement déclaratif, on vérifie le
// contenu réel du fichier avant de l'accepter.
function matchesAttachmentSignature(buffer: Buffer, mimetype: string): boolean {
  switch (mimetype) {
    case 'image/jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'video/mp4':
    case 'video/quicktime':
      // Boîte "ftyp" du conteneur MP4/QuickTime, à un décalage fixe de 4 octets.
      return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    case 'video/webm':
      // EBML (conteneur Matroska/WebM), même signature que l'audio WebM.
      return buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
    default:
      return false;
  }
}

// Valide et persiste une pièce jointe (photo/vidéo) — partagée entre l'upload visiteur
// (contact/attachment) et admin (admin/messages/reply-attachment) : même formats, même
// signature de contenu, seule l'autorisation de la route diffère.
async function saveValidatedAttachment(
  mediaService: MediaService,
  file?: Express.Multer.File,
): Promise<{ url: string }> {
  if (!file) throw new BadRequestException('Aucun fichier reçu.');
  if (!matchesAttachmentSignature(file.buffer, file.mimetype)) {
    throw new BadRequestException(
      'Le contenu du fichier ne correspond pas à un format accepté (JPG, PNG, WebP, MP4, WebM, MOV).',
    );
  }

  const isVideo = ATTACHMENT_VIDEO_MIME_TYPES.has(file.mimetype);
  const filename = `${crypto.randomUUID()}${ATTACHMENT_EXTENSION_BY_MIME[file.mimetype] ?? ''}`;
  const url = await mediaService.saveFile(file.buffer, filename, isVideo ? 'video' : 'image');
  return { url };
}

@Controller()
export class ContactMessagesController {
  constructor(
    private readonly contactMessagesService: ContactMessagesService,
    private readonly mediaService: MediaService,
  ) {}

  // ---------------- Site public (§23) ----------------

  // Plafond GLOBAL par IP (toutes entreprises confondues) en plus de l'anti-spam par entreprise du
  // service : sans lui, un robot pourrait envoyer 5 messages / 10 min à CHAQUE entreprise.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('contact')
  create(@Body() dto: CreateContactMessageDto, @Req() req: Request) {
    return this.contactMessagesService.create(dto, req.ip);
  }

  // Suivi de statut/réponse (voir /suivi côté front) : throttlée séparément de la limite
  // anti-spam par IP de create() car il s'agit ici de lectures répétées légitimes (un visiteur
  // qui revient consulter sa demande), pas d'envois de messages.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('contact/suivi/:reference')
  track(@Param('reference') reference: string, @Query() query: TrackContactMessageDto) {
    return this.contactMessagesService.findByReference(reference, query.contact);
  }

  // Route publique qui écrit un fichier sur disque sans passer par la limite anti-spam par
  // IP appliquée aux créations de message (ContactMessagesService.create) : throttlée
  // séparément (même mécanisme que AuthController — voir auth.controller.ts) pour éviter
  // qu'elle serve à remplir le disque indépendamment de tout message réellement envoyé.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('contact/voice')
  @UseInterceptors(voiceFileInterceptor())
  uploadVoice(@UploadedFile() file: Express.Multer.File) {
    assertValidVoiceUpload(file);
    return { url: `/uploads/${file.filename}` };
  }

  // Photo ou vidéo jointe au message de contact (voir le commentaire de
  // attachmentFileInterceptor ci-dessus). Même limite de débit que /contact/voice : upload
  // public non authentifié, à protéger du remplissage de disque/Cloudinary indépendamment de
  // tout message réellement envoyé.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('contact/attachment')
  @UseInterceptors(attachmentFileInterceptor())
  uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    return saveValidatedAttachment(this.mediaService, file);
  }

  // ---------------- Back-office : ADMIN > MESSAGES ----------------

  @RequirePermissions('messages:read')
  @Get('admin/messages')
  findAllAdmin(@Query() query: QueryContactMessagesDto) {
    return this.contactMessagesService.findAllAdmin(query);
  }

  @RequirePermissions('messages:read')
  @Get('admin/messages/:id')
  findOneAdmin(@Param('id') id: string) {
    return this.contactMessagesService.findOneAdmin(id);
  }

  @RequirePermissions('messages:update')
  @Patch('admin/messages/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: UpdateContactMessageStatusDto) {
    return this.contactMessagesService.setStatus(id, dto.status);
  }

  // Upload du vocal de réponse admin : même validation que contact/voice, mais authentifiée
  // (messages:update) et sans throttle anti-spam dédié — contrairement à la route publique,
  // un compte admin est déjà de confiance.
  @RequirePermissions('messages:update')
  @Post('admin/messages/reply-voice')
  @UseInterceptors(voiceFileInterceptor())
  uploadReplyVoice(@UploadedFile() file: Express.Multer.File) {
    assertValidVoiceUpload(file);
    return { url: `/uploads/${file.filename}` };
  }

  // Photo ou vidéo jointe à la réponse admin — même validation que contact/attachment, mais
  // authentifiée (messages:update) et sans throttle anti-spam dédié, au même principe que
  // uploadReplyVoice ci-dessus.
  @RequirePermissions('messages:update')
  @Post('admin/messages/reply-attachment')
  @UseInterceptors(attachmentFileInterceptor())
  uploadReplyAttachment(@UploadedFile() file: Express.Multer.File) {
    return saveValidatedAttachment(this.mediaService, file);
  }

  @RequirePermissions('messages:update')
  @Patch('admin/messages/:id/reply')
  setReply(@Param('id') id: string, @Body() dto: ReplyContactMessageDto) {
    return this.contactMessagesService.setReply(id, dto);
  }

  @RequirePermissions('messages:delete')
  @Delete('admin/messages/:id')
  remove(@Param('id') id: string) {
    return this.contactMessagesService.remove(id);
  }
}
