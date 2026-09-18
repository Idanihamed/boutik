import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { BoutiquesService } from './boutiques.service';
import { CreateBoutiqueDto } from './dto/create-boutique.dto';
import { UpdateBoutiqueDto } from './dto/update-boutique.dto';

@Controller()
export class BoutiquesController {
  constructor(private readonly boutiquesService: BoutiquesService) {}

  // ---- Site public : GET /boutiques (actives uniquement, §5.8 et §19) ----
  @Public()
  @Get('boutiques')
  findAllPublic() {
    return this.boutiquesService.findAllPublic();
  }

  // ---- Back-office : /admin/boutiques ----
  @RequirePermissions('boutiques:read')
  @Get('admin/boutiques')
  findAllAdmin() {
    return this.boutiquesService.findAllAdmin();
  }

  @RequirePermissions('boutiques:read')
  @Get('admin/boutiques/:id')
  findOne(@Param('id') id: string) {
    return this.boutiquesService.findOneAdmin(id);
  }

  @RequirePermissions('boutiques:create')
  @Post('admin/boutiques')
  create(@Body() dto: CreateBoutiqueDto) {
    return this.boutiquesService.create(dto);
  }

  @RequirePermissions('boutiques:update')
  @Patch('admin/boutiques/:id')
  update(@Param('id') id: string, @Body() dto: UpdateBoutiqueDto) {
    return this.boutiquesService.update(id, dto);
  }

  @RequirePermissions('boutiques:update')
  @Patch('admin/boutiques/:id/activate')
  activate(@Param('id') id: string) {
    return this.boutiquesService.setActive(id, true);
  }

  @RequirePermissions('boutiques:update')
  @Patch('admin/boutiques/:id/disable')
  disable(@Param('id') id: string) {
    return this.boutiquesService.setActive(id, false);
  }

  @RequirePermissions('boutiques:delete')
  @Delete('admin/boutiques/:id')
  remove(@Param('id') id: string) {
    return this.boutiquesService.remove(id);
  }
}
