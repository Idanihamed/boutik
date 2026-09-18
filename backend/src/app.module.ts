import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { CategoriesModule } from './categories/categories.module';
import { BrandsModule } from './brands/brands.module';
import { ProductsModule } from './products/products.module';
import { PromotionsModule } from './promotions/promotions.module';
import { BoutiquesModule } from './boutiques/boutiques.module';
import { ArticlesModule } from './articles/articles.module';
import { PagesModule } from './pages/pages.module';
import { ContactMessagesModule } from './contact-messages/contact-messages.module';
import { OrdersModule } from './orders/orders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MediaModule } from './media/media.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { SettingsModule } from './settings/settings.module';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { TenancyModule } from './tenancy/tenancy.module';
import { BusinessesModule } from './businesses/businesses.module';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    TenancyModule,
    AuthModule,
    BusinessesModule,
    PlatformModule,
    UsersModule,
    RolesModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    PromotionsModule,
    BoutiquesModule,
    ArticlesModule,
    PagesModule,
    ContactMessagesModule,
    OrdersModule,
    NotificationsModule,
    MediaModule,
    DashboardModule,
    ActivityLogModule,
    SettingsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
