import { ForbiddenException } from '@nestjs/common';
import { Request, Response } from 'express';
import { CsrfMiddleware } from './csrf.middleware';

function buildRequest(overrides: {
  method?: string;
  path?: string;
  originalUrl?: string;
  cookies?: Record<string, string>;
  headerValue?: string;
}): Request {
  const { headerValue, path, originalUrl, ...rest } = overrides;
  return {
    method: 'GET',
    path: path ?? '/admin/settings',
    originalUrl: originalUrl ?? path ?? '/api/admin/settings',
    cookies: {},
    header: () => headerValue,
    ...rest,
  } as unknown as Request;
}

describe('CsrfMiddleware', () => {
  const middleware = new CsrfMiddleware();
  const res = {} as Response;

  it('laisse passer les méthodes sûres (GET) sans vérification', () => {
    const next = jest.fn();
    middleware.use(buildRequest({ method: 'GET' }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('laisse toujours passer /api/auth/login (aucune session à protéger avant la connexion)', () => {
    const next = jest.fn();
    middleware.use(buildRequest({ method: 'POST', originalUrl: '/api/auth/login' }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('laisse passer /api/auth/login même avec un cookie d auth périmé, alors que req.path a le préfixe /api retiré par Express (montage sur le pattern /api/*)', () => {
    const next = jest.fn();
    const req = buildRequest({
      method: 'POST',
      path: '/auth/login',
      originalUrl: '/api/auth/login',
      cookies: { boutik_access_token: 'stale-jwt' },
    });
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('laisse passer une requête mutante sans cookie d auth (ex. formulaire de contact public)', () => {
    const next = jest.fn();
    middleware.use(buildRequest({ method: 'POST', path: '/api/contact', cookies: {} }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejette une requête mutante avec cookie d auth mais sans en-tête CSRF', () => {
    const next = jest.fn();
    const req = buildRequest({
      method: 'PATCH',
      cookies: { boutik_access_token: 'jwt', boutik_csrf_token: 'abc' },
    });
    expect(() => middleware.use(req, res, next)).toThrow(ForbiddenException);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejette une requête mutante si l en-tête CSRF ne correspond pas au cookie', () => {
    const next = jest.fn();
    const req = buildRequest({
      method: 'PATCH',
      cookies: { boutik_access_token: 'jwt', boutik_csrf_token: 'abc' },
      headerValue: 'autre-valeur',
    });
    expect(() => middleware.use(req, res, next)).toThrow(ForbiddenException);
    expect(next).not.toHaveBeenCalled();
  });

  it('laisse passer une requête mutante quand l en-tête CSRF correspond au cookie', () => {
    const next = jest.fn();
    const req = buildRequest({
      method: 'PATCH',
      cookies: { boutik_refresh_token: 'jwt', boutik_csrf_token: 'abc' },
      headerValue: 'abc',
    });
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
