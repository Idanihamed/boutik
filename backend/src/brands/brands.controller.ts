import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Controller()
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Public()
  @Get('brands')
  findAllPublic() {
    return this.brandsService.findAllPublic();
  }

  @RequirePermissions('brands:read')
  @Get('admin/brands')
  findAllAdmin() {
    return this.brandsService.findAllAdmin();
  }

  @RequirePermissions('brands:read')
  @Get('admin/brands/:id')
  findOne(@Param('id') id: string) {
    return this.brandsService.findOneAdmin(id);
  }

  @RequirePermissions('brands:create')
  @Post('admin/brands')
  create(@Body() dto: CreateBrandDto) {
    return this.brandsService.create(dto);
  }

  @RequirePermissions('brands:update')
  @Patch('admin/brands/:id')
  update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.brandsService.update(id, dto);
  }

  @RequirePermissions('brands:delete')
  @Delete('admin/brands/:id')
  remove(@Param('id') id: string) {
    return this.brandsService.remove(id);
  }
}
