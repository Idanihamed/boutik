import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ---- Site public : GET /categories (actives uniquement) ----
  @Public()
  @Get('categories')
  findAllPublic() {
    return this.categoriesService.findAllPublic();
  }

  // ---- Back-office : /admin/categories ----
  @RequirePermissions('categories:read')
  @Get('admin/categories')
  findAllAdmin() {
    return this.categoriesService.findAllAdmin();
  }

  @RequirePermissions('categories:read')
  @Get('admin/categories/:id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOneAdmin(id);
  }

  @RequirePermissions('categories:create')
  @Post('admin/categories')
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @RequirePermissions('categories:update')
  @Patch('admin/categories/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @RequirePermissions('categories:delete')
  @Delete('admin/categories/:id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
