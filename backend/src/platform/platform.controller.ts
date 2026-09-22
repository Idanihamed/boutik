import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ReportsService } from '../reports/reports.service';
import { ModerateBusinessDto, QueryPlatformBusinessesDto, QueryPlatformReportsDto, UpdateReportDto } from './dto/platform.dto';
import { ModerationAction, PlatformBusinessesService } from './platform-businesses.service';
import { PlatformStatsService } from './platform-stats.service';

/**
 * Espace de modération de la plateforme : réservé aux comptes PLATFORM_ADMIN (les permissions
 * `businesses:*` et `reports:*` ne sont accordées à aucun rôle d'entreprise, voir le seed).
 */
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly businessesService: PlatformBusinessesService,
    private readonly reportsService: ReportsService,
    private readonly statsService: PlatformStatsService,
  ) {}

  @RequirePermissions('businesses:read')
  @Get('stats')
  stats() {
    return this.statsService.get();
  }

  @RequirePermissions('businesses:read')
  @Get('businesses')
  listBusinesses(@Query() query: QueryPlatformBusinessesDto) {
    return this.businessesService.list(query);
  }

  @RequirePermissions('businesses:read')
  @Get('businesses/:id')
  findBusiness(@Param('id') id: string) {
    return this.businessesService.findOne(id);
  }

  @RequirePermissions('businesses:moderate')
  @Post('businesses/:id/approve')
  approve(@Param('id') id: string, @Body() dto: ModerateBusinessDto, @CurrentUser() user: AuthenticatedUser) {
    return this.moderate(id, 'approve', dto, user);
  }

  @RequirePermissions('businesses:moderate')
  @Post('businesses/:id/reject')
  reject(@Param('id') id: string, @Body() dto: ModerateBusinessDto, @CurrentUser() user: AuthenticatedUser) {
    return this.moderate(id, 'reject', dto, user);
  }

  @RequirePermissions('businesses:moderate')
  @Post('businesses/:id/suspend')
  suspend(@Param('id') id: string, @Body() dto: ModerateBusinessDto, @CurrentUser() user: AuthenticatedUser) {
    return this.moderate(id, 'suspend', dto, user);
  }

  @RequirePermissions('businesses:moderate')
  @Post('businesses/:id/ban')
  ban(@Param('id') id: string, @Body() dto: ModerateBusinessDto, @CurrentUser() user: AuthenticatedUser) {
    return this.moderate(id, 'ban', dto, user);
  }

  @RequirePermissions('businesses:moderate')
  @Post('businesses/:id/reactivate')
  reactivate(@Param('id') id: string, @Body() dto: ModerateBusinessDto, @CurrentUser() user: AuthenticatedUser) {
    return this.moderate(id, 'reactivate', dto, user);
  }

  @RequirePermissions('reports:read')
  @Get('reports')
  listReports(@Query() query: QueryPlatformReportsDto) {
    return this.reportsService.list(query);
  }

  @RequirePermissions('reports:read')
  @Get('reports/flagged')
  flagged() {
    return this.reportsService.flagged();
  }

  @RequirePermissions('reports:update')
  @Patch('reports/:id')
  updateReport(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.reportsService.setStatus(id, dto.status);
  }

  private moderate(id: string, action: ModerationAction, dto: ModerateBusinessDto, user: AuthenticatedUser) {
    return this.businessesService.moderate(id, action, dto.reason, user);
  }
}
