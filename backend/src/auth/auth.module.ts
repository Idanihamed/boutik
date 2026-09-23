import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    ActivityLogModule,
    MailModule,
    // Enregistré ici (et pas dans AppModule) car AuthController est le seul consommateur du
    // ThrottlerGuard (voir auth.controller.ts) : pas de garde global, pour ne pas risquer de
    // limiter le trafic normal du catalogue public. Limite par défaut 10 req/min/IP pour
    // toutes les routes de ce contrôleur ; login/refresh la déclarent explicitement en plus
    // via @Throttle (§26 sécurité) — la même valeur ici, mais séparée pour pouvoir la
    // resserrer indépendamment du reste du contrôleur si besoin plus tard.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Guards globaux : toute route est protégée par défaut (JWT), sauf @Public().
    // Les permissions fines sont vérifiées via @RequirePermissions(...).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
