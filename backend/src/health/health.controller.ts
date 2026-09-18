import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Deux routes publiques sans donnée sensible :
 *  - GET /api/health     : le processus répond (contrôle de santé de l'hébergeur — volontairement
 *    SANS base de données, pour qu'une coupure passagère de celle-ci ne fasse pas redémarrer l'API) ;
 *  - GET /api/health/db  : la base répond aussi (utile pour un ping régulier qui garde à la fois
 *    l'API et une base « en veille » réveillées, ou pour diagnostiquer un déploiement).
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  ping() {
    return { status: 'ok' };
  }

  @Public()
  @Get('db')
  async database() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'indisponible' });
    }
  }
}
