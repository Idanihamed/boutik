import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportBusinessDto } from './dto/report-business.dto';
import { ReportsService } from './reports.service';

@Controller('businesses')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Aucune permission particulière : tout compte connecté (client ou responsable d'une autre
  // entreprise) peut signaler. Les règles (une fois par entreprise, plafond journalier,
  // interdiction de signaler la sienne) sont dans ReportsService.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @Post(':slug/report')
  report(@Param('slug') slug: string, @Body() dto: ReportBusinessDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.report(slug, user, dto);
  }
}
