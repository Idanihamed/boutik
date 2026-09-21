import { Body, Controller, Delete, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PushTokenDto } from './dto/push-token.dto';
import { PushService } from './push.service';

// Aucun @RequirePermissions : chaque membre du personnel connecté gère ses propres téléphones.
// Les alertes qu'il recevra sont ensuite filtrées selon ses permissions (voir PushService).
@Controller('admin/push-tokens')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post()
  register(@Body() dto: PushTokenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pushService.register(user.id, user.businessId, dto.token);
  }

  @Delete()
  unregister(@Body() dto: PushTokenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pushService.unregister(user.id, dto.token);
  }
}
