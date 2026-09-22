import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerName: string;

  /** Téléphone ou email — même principe qu'un message de contact (§23). */
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  customerContact: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  customerAddress?: string;

  @IsOptional()
  @IsString()
  boutiqueId?: string;

  /** Code promo saisi par le client (facultatif). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  promoCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /**
   * Référence de transaction Mobile Money (facultative) — saisie par le client quand
   * l'entreprise n'a qu'un numéro de réception direct (Setting.mobileMoneyNumber), pour que le
   * commerçant puisse rapprocher le paiement reçu de cette commande. Jamais utilisée pour
   * valider automatiquement un paiement : le serveur ne peut pas vérifier un transfert Mobile
   * Money, seul le commerçant le peut depuis sa propre application.
   */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  paymentReference?: string;

  // Plafonné à 50 lignes : une commande "normale" en compte quelques-unes, une valeur plus
  // haute n'a aucune raison légitime et alourdirait inutilement le calcul de prix/stock.
  @ArrayMinSize(1, { message: 'La commande doit contenir au moins un article.' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  /** Champ honeypot anti-spam : doit rester vide, voir OrdersService.create. */
  @IsOptional()
  @IsString()
  website?: string;
}
