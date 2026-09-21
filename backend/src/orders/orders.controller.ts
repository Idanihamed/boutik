import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { TrackOrderDto } from './dto/track-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ---------------- Site public (panier / checkout) ----------------

  // Plafond GLOBAL par IP (toutes entreprises confondues), en plus de l'anti-spam par entreprise.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('orders')
  create(@Body() dto: CreateOrderDto, @Req() req: Request) {
    return this.ordersService.create(dto, req.ip);
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
