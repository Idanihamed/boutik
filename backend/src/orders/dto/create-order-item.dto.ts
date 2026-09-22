import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderItemDto {
  @IsString()
  productId: string;

  /** Requis uniquement si le produit a des variantes (voir OrdersService.priceOrder). */
  @IsOptional()
  @IsString()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
