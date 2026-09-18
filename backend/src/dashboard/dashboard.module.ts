import { Module } from '@nestjs/common';
import { PromotionsModule } from '../promotions/promotions.module';
import { BoutiquesModule } from '../boutiques/boutiques.module';
import { ArticlesModule } from '../articles/articles.module';
import { PagesModule } from '../pages/pages.module';
import { ContactMessagesModule } from '../contact-messages/contact-messages.module';
import { OrdersModule } from '../orders/orders.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PromotionsModule, BoutiquesModule, ArticlesModule, PagesModule, ContactMessagesModule, OrdersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
