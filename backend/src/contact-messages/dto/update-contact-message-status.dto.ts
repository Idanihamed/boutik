import { IsIn } from 'class-validator';

export class UpdateContactMessageStatusDto {
  @IsIn(['NOUVEAU', 'LU', 'TRAITE'])
  status: 'NOUVEAU' | 'LU' | 'TRAITE';
}
