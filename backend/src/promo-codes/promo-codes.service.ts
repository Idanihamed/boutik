import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PromoCode } from '@prisma/client';
import { normalizePromoCode } from '../common/utils/order-pricing.util';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';

/** Codes promo que le client saisit dans son panier. Isolés par entreprise (voir tenancy/). */
@Injectable()
export class PromoCodesService {
  constructor(@Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma) {}

  private assertValid(input: { type?: string; value?: number; startsAt?: string | null; endsAt?: string | null }) {
    if (input.type === 'PERCENTAGE' && input.value !== undefined && input.value > 100) {
      throw new BadRequestException('Un pourcentage de réduction ne peut pas dépasser 100.');
    }
    if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début.');
    }
  }

  private toData(dto: CreatePromoCodeDto | UpdatePromoCodeDto) {
    return {
      ...(dto.code !== undefined ? { code: normalizePromoCode(dto.code) } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.value !== undefined ? { value: dto.value } : {}),
      ...(dto.minOrderAmount !== undefined ? { minOrderAmount: dto.minOrderAmount } : {}),
      ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses } : {}),
      ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null } : {}),
      ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
  }

  private rethrowConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Ce code existe déjà. Choisissez-en un autre.');
    }
    throw error;
  }

  findAll(): Promise<PromoCode[]> {
    return this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  /** Code (déjà normalisé ou non) de l'entreprise courante, ou null. */
  findByCode(code: string): Promise<PromoCode | null> {
    return this.prisma.promoCode.findFirst({ where: { code: normalizePromoCode(code) } });
  }

  async create(dto: CreatePromoCodeDto): Promise<PromoCode> {
    this.assertValid(dto);
    try {
      return await this.prisma.promoCode.create({ data: this.toData(dto) as Prisma.PromoCodeCreateInput });
    } catch (error) {
      return this.rethrowConflict(error);
    }
  }

  async update(id: string, dto: UpdatePromoCodeDto): Promise<PromoCode> {
    const existing = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Code promo introuvable.');
    this.assertValid({
      type: dto.type ?? existing.type,
      value: dto.value ?? existing.value,
      startsAt: dto.startsAt !== undefined ? dto.startsAt : existing.startsAt?.toISOString(),
      endsAt: dto.endsAt !== undefined ? dto.endsAt : existing.endsAt?.toISOString(),
    });
    try {
      return await this.prisma.promoCode.update({ where: { id }, data: this.toData(dto) });
    } catch (error) {
      return this.rethrowConflict(error);
    }
  }

  async remove(id: string): Promise<{ success: true }> {
    const existing = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Code promo introuvable.');
    // Les commandes déjà passées gardent le texte du code : elles n'ont pas de lien vers cette ligne.
    await this.prisma.promoCode.delete({ where: { id } });
    return { success: true };
  }
}
