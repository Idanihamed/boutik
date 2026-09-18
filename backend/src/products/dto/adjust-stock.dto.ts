import { IsInt } from 'class-validator';

export class AdjustStockDto {
  /** Valeur positive pour ajouter du stock, négative pour en retirer (§12 du cahier des charges). */
  @IsInt()
  delta: number;
}
