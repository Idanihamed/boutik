import { Request } from 'express';

/**
 * Les applications mobiles ne gèrent pas bien les cookies (pas de navigateur, pas de « même site »).
 * Elles s'annoncent avec l'en-tête `X-Client: mobile` et reçoivent alors les jetons dans le corps
 * de la réponse, qu'elles gardent dans le stockage sécurisé du téléphone et renvoient dans
 * `Authorization: Bearer ...`. Sans cet en-tête, rien ne change pour le site web : les jetons
 * restent dans des cookies httpOnly et n'apparaissent jamais dans le corps de la réponse.
 */
export const CLIENT_HEADER = 'x-client';

export function isMobileClient(req: Request): boolean {
  return req.header(CLIENT_HEADER)?.toLowerCase() === 'mobile';
}
