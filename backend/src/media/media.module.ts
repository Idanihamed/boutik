import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService],
  // Réutilisé par ContactMessagesController pour l'upload de pièce jointe (photo/vidéo) du
  // formulaire de contact, plutôt que de dupliquer la logique de stockage local/Cloudinary.
  exports: [MediaService],
})
export class MediaModule {}
