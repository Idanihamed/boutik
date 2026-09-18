import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { TENANT_PRISMA, createTenantClient } from './tenant-prisma';
import { TenantInterceptor } from './tenant.interceptor';

@Global()
@Module({
  providers: [
    { provide: TENANT_PRISMA, useFactory: (prisma: PrismaService) => createTenantClient(prisma), inject: [PrismaService] },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
  exports: [TENANT_PRISMA],
})
export class TenancyModule {}
