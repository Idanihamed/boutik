import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { MyOrdersQueryDto } from './dto/my-orders-query.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { TrackOrderDto } from './dto/track-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller()
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly authService: AuthService,
  ) {}

  // ---------------- Site public (panier / checkout) ----------------

  // Plafond GLOBAL par IP (toutes entreprises confondues), en plus de l'anti-spam par entreprise.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('orders')
  create(@Body() dto: CreateOrderDto, @Req() req: Request) {
    // Un client CONNECTÉ au moment de commander voit sa commande rattachée à son compte (pour
    // « Mes commandes ») ; un rôle du personnel (OWNER/GESTIONNAIRE/...) n'est jamais un client.
    const current = this.authService.tryGetCurrentUser(req);
    const customerId = current?.role === 'CUSTOMER' ? current.id : undefined;
    return this.ordersService.create(dto, req.ip, customerId);
  }

  // Aperçu du panier (sous-total, code promo, livraison, total) : n'enregistre rien. Plafond plus large
  // que la commande : le client peut essayer plusieurs codes et changer ses quantités.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @Post('orders/quote')
  quote(@Body() dto: QuoteOrderDto) {
    return this.ordersService.quote(dto);
  }

  // Même principe de throttle dédié que ContactMessagesController.track : des lectures
  // répétées légitimes (un client qui revient consulter sa commande), pas des envois.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('orders/suivi/:reference')
  track(@Param('reference') reference: string, @Query() query: TrackOrderDto) {
    return this.ordersService.findByReference(reference, query.contact);
  }

  // ---------------- Compte client (« Mes commandes ») ----------------
  // Aucune permission requise (le rôle CUSTOMER n'en a aucune) : seule une session valide
  // suffit. Chaque requête est filtrée par l'identifiant du compte connecté (jamais par un
  // paramètre fourni par l'appelant), donc un client ne peut jamais voir la commande d'un autre.

  @Get('mes-commandes')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: MyOrdersQueryDto) {
    return this.ordersService.findMineList(user.id, query.page ?? 1, query.limit ?? 20);
  }

  @Get('mes-commandes/:id')
  findMineOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.findMineOne(user.id, id);
  }

  // ---------------- Back-office : ADMIN > COMMANDES ----------------

  @RequirePermissions('orders:read')
  @Get('admin/orders')
  findAllAdmin(@Query() query: QueryOrdersDto) {
    return this.ordersService.findAllAdmin(query);
  }

  @RequirePermissions('orders:read')
  @Get('admin/orders/:id')
  findOneAdmin(@Param('id') id: string) {
    return this.ordersService.findOneAdmin(id);
  }

  @RequirePermissions('orders:update')
  @Patch('admin/orders/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.setStatus(id, dto.status);
  }
}
