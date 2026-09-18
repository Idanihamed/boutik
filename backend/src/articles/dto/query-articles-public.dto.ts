import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryArticlesPublicDto extends PaginationQueryDto {
  // On surcharge le défaut hérité (20) : la liste publique des actualités est pensée
  // pour un affichage par 12 (grille 3x4/4x3) plutôt que par 20.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 12;

  @IsOptional()
  @IsString()
  category?: string;
}
