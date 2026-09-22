import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { MailModule } from '../mail/mail.module';
import { ReportsController } from '../reports/reports.controller';
import { ReportsService } from '../reports/reports.service';
import { PlatformBusinessesService } from './platform-businesses.service';
import { PlatformStatsService } from './platform-stats.service';
import { PlatformController } from './platform.controller';

// Modération (côté plateforme) et signalements (côté utilisateurs) partagent ReportsService.
@Module({
  imports: [MailModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])],
  controllers: [PlatformController, ReportsController],
  providers: [PlatformBusinessesService, PlatformStatsService, ReportsService],
})
export class PlatformModule {}
