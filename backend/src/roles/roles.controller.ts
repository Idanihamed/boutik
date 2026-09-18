import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RolesService } from './roles.service';

@Controller('admin/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @RequirePermissions('roles:read')
  @Get()
  findAll() {
    return this.rolesService.findAll();
  }
}
