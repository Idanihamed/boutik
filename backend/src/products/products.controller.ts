import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsAdminDto, QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ---------------- Site public ----------------

  @Public()
  @Get('products')
  findAllPublic(@Query() query: QueryProductsDto) {
    return this.productsService.findAllPublic(query);
  }

  @Public()
  @Get('products/featured')
  findFeatured() {
    return this.productsService.findFeaturedPublic();
  }

  @Public()
  @Get('products/:slug')
  findOneBySlug(@Param('slug') slug: string) {
    return this.productsService.findOneBySlugPublic(slug);
  }

  // ---------------- Back-office ----------------

  @RequirePermissions('products:read')
  @Get('admin/products')
  findAllAdmin(@Query() query: QueryProductsAdminDto) {
    return this.productsService.findAllAdmin(query);
  }

  @RequirePermissions('products:read')
  @Get('admin/products/alerts')
  stockAlerts() {
    return this.productsService.lowStockAndOutOfStock();
  }

  @RequirePermissions('products:read')
  @Get('admin/products/:id')
  findOneAdmin(@Param('id') id: string) {
    return this.productsService.findOneAdmin(id);
  }

  @RequirePermissions('products:create')
  @Post('admin/products')
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    // `products:publish` est vérifié séparément à l'intérieur du service : `products:create`
    // seul ne suffit pas à créer un produit déjà publié, seulement en brouillon.
    return this.productsService.create(dto, user.permissions);
  }

  @RequirePermissions('products:update')
  @Patch('admin/products/:id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.update(id, dto, user.permissions);
  }

  @RequirePermissions('products:delete')
  @Delete('admin/products/:id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @RequirePermissions('products:publish')
  @Patch('admin/products/:id/publish')
  publish(@Param('id') id: string) {
    return this.productsService.setStatus(id, 'PUBLISHED');
  }

  @RequirePermissions('products:publish')
  @Patch('admin/products/:id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.productsService.setStatus(id, 'DRAFT');
  }

  @RequirePermissions('products:create')
  @Post('admin/products/:id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.productsService.duplicate(id);
  }

  @RequirePermissions('products:update')
  @Patch('admin/products/:id/stock')
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.productsService.adjustStock(id, dto.delta);
  }
}
