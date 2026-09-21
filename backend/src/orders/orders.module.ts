import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  // ThrottlerModule.forRoot() nécessaire pour ThrottlerGuard dans ce module (voir
  // ContactMessagesModule pour la même remarque — pas de garde global, voir AppModule).
  imports: [PromotionsModule, PromoCodesModule, NotificationsModule, MailModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }])],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
