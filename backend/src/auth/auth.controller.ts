import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { isMobileClient } from './client-type';
import { clearAuthCookies, REFRESH_TOKEN_COOKIE, setAuthCookies } from './cookies';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { AuthenticatedUser } from './types/authenticated-user.type';

// La limitation de débit par IP est posée route par route (@UseGuards(ThrottlerGuard) +
// @Throttle) et NON sur tout le contrôleur : seules les routes qui se prêtent à la force brute
// ou à la création de comptes en masse sont limitées. `GET /auth/me` est appelée par les
// clients à chaque chargement de page ; la plafonner à quelques requêtes par minute et par IP
// déconnecterait des utilisateurs légitimes (plusieurs personnes partagent souvent la même IP
// publique sur un réseau mobile).
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  // 10 tentatives / minute / IP : largement suffisant pour un utilisateur légitime qui se
  // trompe de mot de passe, mais ralentit fortement une attaque par force brute — combiné au
  // coût du bcrypt (~100 ms/essai), ça rend une attaque par dictionnaire impraticable.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(dto);
    // Application mobile (en-tête X-Client: mobile) : jetons dans le corps, aucun cookie posé.
    if (isMobileClient(req)) return { user, accessToken, refreshToken };
    // Les tokens ne sont plus renvoyés dans le corps JSON (uniquement posés en cookies
    // httpOnly) : un script XSS qui lirait cette réponse ne doit rien pouvoir en tirer.
    setAuthCookies(res, this.config, { accessToken, refreshToken });
    return { user };
  }

  // Inscription libre d'un client : sans elle, impossible de signaler une entreprise ni de
  // retrouver ses commandes. Même limitation de débit que la connexion, contre la création de
  // comptes en masse.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ) {
    const mobile = isMobileClient(req);
    const refreshToken = mobile ? bodyRefreshToken : req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new ForbiddenException('Aucune session à renouveler.');
    }
    const tokens = await this.authService.refresh(refreshToken);
    if (mobile) return tokens;
    setAuthCookies(res, this.config, tokens);
    return { ok: true };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ) {
    const refreshToken = isMobileClient(req) ? bodyRefreshToken : req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken && typeof refreshToken === 'string') {
      await this.authService.logout(refreshToken);
    }
    clearAuthCookies(res, this.config);
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  // Aucun @RequirePermissions : accessible à tout compte connecté, quel que soit son rôle —
  // voir le commentaire de AuthService.changeOwnPassword.
  // Devine-le-mot-de-passe-actuel : même plafond que la connexion.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Patch('me/password')
  async changeOwnPassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    await this.authService.changeOwnPassword(user.id, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }
}
