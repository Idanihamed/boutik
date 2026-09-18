import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { clearAuthCookies, REFRESH_TOKEN_COOKIE, setAuthCookies } from './cookies';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { AuthenticatedUser } from './types/authenticated-user.type';

// ThrottlerGuard n'est actif que sur ce contrôleur (pas globalement, voir AppModule) : les
// routes d'authentification sont les seules où limiter le débit par IP a du sens ici, pour
// contrer les attaques par force brute sur le mot de passe (§26 du cahier des charges).
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  // 10 tentatives / minute / IP : largement suffisant pour un utilisateur légitime qui se
  // trompe de mot de passe, mais ralentit fortement une attaque par force brute — combiné au
  // coût du bcrypt (~100 ms/essai), ça rend une attaque par dictionnaire impraticable.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(dto);
    // Les tokens ne sont plus renvoyés dans le corps JSON (uniquement posés en cookies
    // httpOnly) : un script XSS qui lirait cette réponse ne doit rien pouvoir en tirer.
    setAuthCookies(res, this.config, { accessToken, refreshToken });
    return { user };
  }

  // Inscription libre d'un client : sans elle, impossible de signaler une entreprise ni de
  // retrouver ses commandes. Même limitation de débit que la connexion, contre la création de
  // comptes en masse.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      throw new ForbiddenException('Aucune session à renouveler.');
    }
    const tokens = await this.authService.refresh(refreshToken);
    setAuthCookies(res, this.config, tokens);
    return { ok: true };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) {
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
  @HttpCode(HttpStatus.OK)
  @Patch('me/password')
  async changeOwnPassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    await this.authService.changeOwnPassword(user.id, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }
}
