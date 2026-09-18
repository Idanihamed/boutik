import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityLogController } from './activity-log.controller';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogInterceptor } from './activity-log.interceptor';

@Module({
  controllers: [ActivityLogController],
  providers: [
    ActivityLogService,
    // Interceptor global : journalise automatiquement toute mutation sur une route
    // /admin/... (voir ActivityLogInterceptor pour le détail). Suit le même schéma que
    // les guards globaux déclarés dans AuthModule (APP_GUARD).
    { provide: APP_INTERCEPTOR, useClass: ActivityLogInterceptor },
  ],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
