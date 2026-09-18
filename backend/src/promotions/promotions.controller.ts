import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { QueryPromotionsAdminDto } from './dto/query-promotions-admin.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionsService } from './promotions.service';

@Controller()
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  // ---------------- Site public ----------------

  @Public()
  @Get('promotions/active')
  findActivePublic() {
    return this.promotionsService.findActivePublic();
  }

  // ---------------- Back-office ----------------

  @RequirePermissions('promotions:read')
  @Get('admin/promotions')
  findAllAdmin(@Query() query: QueryPromotionsAdminDto) {
    return this.promotionsService.findAllAdmin(query);
  }

  @RequirePermissions('promotions:read')
  @Get('admin/promotions/:id')
  findOneAdmin(@Param('id') id: string) {
    return this.promotionsService.findOneAdmin(id);
  }

  @RequirePermissions('promotions:create')
  @Post('admin/promotions')
  create(@Body() dto: CreatePromotionDto, @CurrentUser() user: AuthenticatedUser) {
    // `promotions:activate` est vérifié séparément à l'intérieur du service (voir
    // assertCanSetAdminStatus) : `promotions:create` seul ne suffit pas à créer une
    // promotion déjà active/désactivée, seulement en brouillon.
    return this.promotionsService.create(dto, user.permissions);
  }

  @RequirePermissions('promotions:update')
  @Patch('admin/promotions/:id')
  update(@Param('id') id: string, @Body() dto: UpdatePromotionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.promotionsService.update(id, dto, user.permissions);
  }

  @RequirePermissions('promotions:delete')
  @Delete('admin/promotions/:id')
  remove(@Param('id') id: string) {
    return this.promotionsService.remove(id);
  }

  @RequirePermissions('promotions:activate')
  @Patch('admin/promotions/:id/activate')
  activate(@Param('id') id: string) {
    return this.promotionsService.setAdminStatus(id, 'ACTIVE');
  }

  @RequirePermissions('promotions:activate')
  @Patch('admin/promotions/:id/disable')
  disable(@Param('id') id: string) {
    return this.promotionsService.setAdminStatus(id, 'DISABLED');
  }

  @RequirePermissions('promotions:activate')
  @Patch('admin/promotions/:id/draft')
  setDraft(@Param('id') id: string) {
    return this.promotionsService.setAdminStatus(id, 'DRAFT');
  }
}
