import { Controller, Get, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { NotificationsService } from './notifications.service';

// Pas de @RequirePermissions au niveau du contrôleur (§29 ne définit pas de ressource de
// permission propre pour les notifications elles-mêmes) : tout utilisateur admin authentifié
// peut ouvrir la cloche. En revanche, CHAQUE notification porte sur une ressource qui, elle,
// a bien sa propre permission de lecture (un message de contact, un produit, une promotion) —
// le filtrage se fait donc au niveau du service, notification par notification, à partir des
// permissions réelles de l'appelant (voir NotificationsService.PERMISSION_BY_TYPE).
@Controller('admin/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.findAllAdmin(user.permissions);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unreadCount(user.permissions);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(id, user.permissions);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.permissions);
  }
}
