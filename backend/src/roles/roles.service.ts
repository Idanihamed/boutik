import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { STAFF_ROLES } from '../common/roles';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Uniquement les rôles attribuables au personnel d'une entreprise (jamais la plateforme). */
  findAll() {
    return this.prisma.role.findMany({
      where: { name: { in: [...STAFF_ROLES] } },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }
}
