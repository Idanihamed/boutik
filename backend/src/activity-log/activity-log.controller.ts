import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ActivityLogService } from './activity-log.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';

// Journal d'activité : chaque entreprise ne voit que ses propres actions (le responsable). Aucune autre action que la lecture n'est
// exposée : le journal est un historique, il n'est ni modifiable ni supprimable via l'API.
@Controller('admin/activity-log')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @RequirePermissions('activity-log:read')
  @Get()
  findAll(@Query() query: QueryActivityLogDto, @CurrentUser() user: AuthenticatedUser) {
    return this.activityLogService.findAll(query, user.businessId);
  }
}
