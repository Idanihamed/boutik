import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { isSentryEnabled } from './sentry.util';

/**
 * Signale à Sentry les erreurs qui indiquent réellement un bug (statut 5xx, ou une exception
 * qui n'est même pas une HttpException gérée), puis délègue à `BaseExceptionFilter` pour que
 * la réponse envoyée au client reste EXACTEMENT celle que Nest aurait produite sans ce filtre
 * — ce filtre observe, il ne change jamais le comportement de l'API.
 *
 * Ne remonte jamais les 4xx (400 de validation, 401/403/404 attendus du fonctionnement normal
 * de l'API) : les compter comme des « erreurs » noierait le tableau de bord Sentry sous des
 * refus de connexion ou des commandes mal formées, et épuiserait pour rien le quota gratuit.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (isSentryEnabled()) {
      const status = exception instanceof HttpException ? exception.getStatus() : 500;
      if (status >= 500) {
        Sentry.captureException(exception);
      }
    }
    super.catch(exception, host);
  }
}
