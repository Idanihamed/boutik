import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { PromoCodesService } from './promo-codes.service';

// Les codes promo se gèrent avec les mêmes permissions que les promotions : un rôle qui gère les
// promotions gère aussi les codes, sans nouvelle permission à distribuer.
@Controller('admin/promo-codes')
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @RequirePermissions('promotions:read')
  @Get()
  findAll() {
    return this.promoCodesService.findAll();
  }

  @RequirePermissions('promotions:create')
  @Post()
  create(@Body() dto: CreatePromoCodeDto) {
    return this.promoCodesService.create(dto);
  }

  @RequirePermissions('promotions:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePromoCodeDto) {
    return this.promoCodesService.update(id, dto);
  }

  @RequirePermissions('promotions:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.promoCodesService.remove(id);
  }
}
