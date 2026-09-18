import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { QueryArticlesAdminDto } from './dto/query-articles-admin.dto';
import { QueryArticlesPublicDto } from './dto/query-articles-public.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Controller()
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  // ---------------- Site public ----------------

  @Public()
  @Get('actualites')
  findAllPublic(@Query() query: QueryArticlesPublicDto) {
    return this.articlesService.findAllPublic(query);
  }

  @Public()
  @Get('actualites/:slug')
  findOneBySlugPublic(@Param('slug') slug: string) {
    return this.articlesService.findOneBySlugPublic(slug);
  }

  // ---------------- Back-office ----------------

  @RequirePermissions('articles:read')
  @Get('admin/articles')
  findAllAdmin(@Query() query: QueryArticlesAdminDto) {
    return this.articlesService.findAllAdmin(query);
  }

  @RequirePermissions('articles:read')
  @Get('admin/articles/:id')
  findOneAdmin(@Param('id') id: string) {
    return this.articlesService.findOneAdmin(id);
  }

  @RequirePermissions('articles:create')
  @Post('admin/articles')
  create(@Body() dto: CreateArticleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.articlesService.create(dto, user.permissions);
  }

  @RequirePermissions('articles:update')
  @Patch('admin/articles/:id')
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.articlesService.update(id, dto, user.permissions);
  }

  @RequirePermissions('articles:delete')
  @Delete('admin/articles/:id')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(id);
  }

  @RequirePermissions('articles:publish')
  @Patch('admin/articles/:id/publish')
  publish(@Param('id') id: string) {
    return this.articlesService.setStatus(id, 'PUBLISHED');
  }

  @RequirePermissions('articles:publish')
  @Patch('admin/articles/:id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.articlesService.setStatus(id, 'DRAFT');
  }
}
