import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PagesService } from './pages.service';

@Controller()
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  // ---------------- Site public ----------------

  // Utilisé uniquement par frontend/app/sitemap.ts pour lister les URLs à indexer — voir le
  // commentaire de PagesService.findAllSlugsPublic().
  @Public()
  @Get('pages')
  findAllSlugsPublic() {
    return this.pagesService.findAllSlugsPublic();
  }

  // Utilisé par la route catch-all /[slug] du frontend pour afficher une page de contenu
  // (À propos, Livraison, Garantie et SAV, Mentions légales, CGU...).
  @Public()
  @Get('pages/:slug')
  findOneBySlugPublic(@Param('slug') slug: string) {
    return this.pagesService.findOneBySlugPublic(slug);
  }

  // ---------------- Back-office ----------------

  @RequirePermissions('pages:read')
  @Get('admin/pages')
  findAllAdmin() {
    return this.pagesService.findAllAdmin();
  }

  @RequirePermissions('pages:read')
  @Get('admin/pages/:id')
  findOneAdmin(@Param('id') id: string) {
    return this.pagesService.findOneAdmin(id);
  }

  @RequirePermissions('pages:create')
  @Post('admin/pages')
  create(@Body() dto: CreatePageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pagesService.create(dto, user.permissions);
  }

  @RequirePermissions('pages:update')
  @Patch('admin/pages/:id')
  update(@Param('id') id: string, @Body() dto: UpdatePageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pagesService.update(id, dto, user.permissions);
  }

  @RequirePermissions('pages:delete')
  @Delete('admin/pages/:id')
  remove(@Param('id') id: string) {
    return this.pagesService.remove(id);
  }

  @RequirePermissions('pages:publish')
  @Patch('admin/pages/:id/publish')
  publish(@Param('id') id: string) {
    return this.pagesService.setStatus(id, 'PUBLISHED');
  }

  @RequirePermissions('pages:publish')
  @Patch('admin/pages/:id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.pagesService.setStatus(id, 'DRAFT');
  }
}
