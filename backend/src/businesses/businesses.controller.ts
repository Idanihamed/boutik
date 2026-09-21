import { Body, Controller, Get, NotFoundException, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { currentBusinessId } from '../tenancy/tenant-context';
import { BusinessesService } from './businesses.service';
import { QueryDirectoryDto } from './dto/query-directory.dto';
import { RegisterBusinessDto } from './dto/register-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Controller()
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  // Inscription libre d'une entreprise. 5 par heure et par IP : assez pour un vrai
  // responsable qui corrige une erreur de saisie, trop peu pour créer des entreprises en masse.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('businesses/register')
  register(@Body() dto: RegisterBusinessDto) {
    return this.businessesService.register(dto);
  }

  // Annuaire public des entreprises validées (page « Découvrir les boutiques » et plan du site).
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('directory')
  directory(@Query() query: QueryDirectoryDto) {
    return this.businessesService.listDirectory(query);
  }

  // Atteinte via /api/b/:slug (le middleware de slug réécrit l'URL en /api/storefront et fixe
  // l'entreprise) : renvoie l'identité publique de la vitrine.
  @Public()
  @Get('storefront')
  storefront() {
    const businessId = currentBusinessId();
    if (!businessId) throw new NotFoundException('Entreprise introuvable.');
    return this.businessesService.getStorefront(businessId);
  }

  @RequirePermissions('business:read')
  @Get('admin/business')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.businessesService.getMine(this.requireBusinessId(user));
  }

  @RequirePermissions('business:update')
  @Patch('admin/business')
  updateMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.updateMine(this.requireBusinessId(user), dto);
  }

  private requireBusinessId(user: AuthenticatedUser): string {
    if (!user.businessId) throw new NotFoundException("Ce compte n'est rattaché à aucune entreprise.");
    return user.businessId;
  }
}
