import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly useCloudinary: boolean;

  constructor(private readonly config: ConfigService) {
    // Le SDK Cloudinary lit lui-même `process.env.CLOUDINARY_URL` automatiquement dès qu'il
    // est présent — rien à configurer manuellement ici au-delà de vérifier sa présence.
    this.useCloudinary =
      this.config.get<string>('STORAGE_DRIVER', 'local') === 'cloudinary' &&
      Boolean(this.config.get<string>('CLOUDINARY_URL'));
  }

  /**
   * Écrit le fichier (déjà validé — voir MediaController.matchesImageSignature) et retourne
   * son URL publique. Stockage local par défaut (V1) ; bascule vers Cloudinary si
   * `STORAGE_DRIVER=cloudinary` et `CLOUDINARY_URL` sont renseignés (voir .env.example) — le
   * reste de l'application ne connaît que l'URL retournée, jamais le mécanisme de stockage.
   * `resourceType` ne change rien en stockage local ; côté Cloudinary, une vidéo doit être
   * envoyée avec `resource_type: 'video'` (le pipeline de traitement diffère de celui des
   * images, voir la doc Cloudinary) sous peine d'échec de l'upload.
   */
  async saveFile(buffer: Buffer, filename: string, resourceType: 'image' | 'video' = 'image'): Promise<string> {
    if (this.useCloudinary) {
      return this.uploadToCloudinary(buffer, filename, resourceType);
    }

    const dest = path.join(process.env.UPLOAD_DIR ?? 'uploads', filename);
    await fs.promises.writeFile(dest, buffer);
    return `/uploads/${filename}`;
  }

  private uploadToCloudinary(buffer: Buffer, filename: string, resourceType: 'image' | 'video'): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: filename.replace(/\.[^.]+$/, ''), resource_type: resourceType },
        (error, result) => {
          if (error || !result) {
            this.logger.error(`Échec d'upload Cloudinary : ${error?.message}`);
            reject(error ?? new Error('Échec d’upload Cloudinary.'));
            return;
          }
          resolve(result.secure_url);
        },
      );
      stream.end(buffer);
    });
  }
}
