import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_COOKIE } from '../cookies';
import { AuthenticatedUser, JwtAccessPayload } from '../types/authenticated-user.type';

// L'access token voyage désormais dans un cookie httpOnly (voir auth/cookies.ts) plutôt que
// dans l'en-tête `Authorization`, pour ne plus être lisible en JavaScript (protection contre
// le vol de token par XSS — §26 du cahier des charges).
function extractFromCookie(req: Request): string | null {
  return req?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: extractFromCookie,
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtAccessPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      businessId: payload.businessId ?? null,
      permissions: payload.permissions,
    };
  }
}
