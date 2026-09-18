import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { MediaModule } from '../media/media.module';
import { ContactMessagesController } from './contact-messages.controller';
import { ContactMessagesService } from './contact-messages.service';

@Module({
  // ThrottlerModule.forRoot() ici est nécessaire pour que ThrottlerGuard soit résolvable
  // dans ce module (voir contact-messages.controller.ts) : la même config existe déjà dans
  // AuthModule, mais chaque module doit l'importer lui-même (pas de garde global, voir AppModule).
  imports: [NotificationsModule, MailModule, MediaModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }])],
  controllers: [ContactMessagesController],
  providers: [ContactMessagesService],
  exports: [ContactMessagesService],
})
export class ContactMessagesModule {}
