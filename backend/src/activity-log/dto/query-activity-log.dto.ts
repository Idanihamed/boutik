import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryActivityLogDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  // `@IsString()` seul laissait passer n'importe quelle chaîne ; ActivityLogService la passe
  // telle quelle à `new Date(...)`, et une valeur non parsable (ex. "?from=n'importe-quoi")
  // donne un `Invalid Date` que Prisma rejette avec une erreur non gérée (500 brut) plutôt
  // qu'un message de validation propre. `@IsDateString()` (déjà utilisé ailleurs, ex.
  // `publishedAt` des actualités) rejette ce genre de valeur en amont avec un 400 clair.

  /** Date ISO (début de journée incluse). */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Date ISO (fin de journée incluse). */
  @IsOptional()
  @IsDateString()
  to?: string;
}
