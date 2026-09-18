import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ---------------- Site public ----------------
  // Utilisé par l'en-tête/pied de page public pour afficher les liens réseaux sociaux
  // renseignés et le numéro WhatsApp (§5.9, §24).
  @Public()
  @Get('settings')
  getPublic() {
    return this.settingsService.get();
  }

  // ---------------- Back-office ----------------

  @RequirePermissions('settings:read')
  @Get('admin/settings')
  getAdmin() {
    return this.settingsService.get();
  }

  @RequirePermissions('settings:update')
  @Patch('admin/settings')
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }
}
