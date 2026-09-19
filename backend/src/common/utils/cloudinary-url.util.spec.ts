import { normalizeCloudinaryUrl } from './cloudinary-url.util';

const VALID = 'cloudinary://123456789012345:abcDEF123@moncompte';

describe('normalizeCloudinaryUrl', () => {
  it('laisse une valeur correcte inchangée', () => {
    expect(normalizeCloudinaryUrl(VALID)).toBe(VALID);
  });

  it('considère une variable absente ou vide comme « non configurée »', () => {
    expect(normalizeCloudinaryUrl(undefined)).toBeUndefined();
    expect(normalizeCloudinaryUrl('')).toBeUndefined();
    expect(normalizeCloudinaryUrl('   \n')).toBeUndefined();
  });

  it.each([
    ['des espaces autour', `  ${VALID}  `],
    ['un retour à la ligne final', `${VALID}\n`],
    ['des guillemets doubles', `"${VALID}"`],
    ['des guillemets simples', `'${VALID}'`],
    ['la ligne entière collée', `CLOUDINARY_URL=${VALID}`],
    ['la ligne entière avec espaces et guillemets', ` CLOUDINARY_URL = "${VALID}" `],
  ])('corrige %s', (_label, input) => {
    expect(normalizeCloudinaryUrl(input)).toBe(VALID);
  });

  it('refuse une valeur qui ne commence pas par cloudinary:// sans en révéler le contenu', () => {
    const secret = 'https://exemple.com/motdepasse-secret';
    expect(() => normalizeCloudinaryUrl(secret)).toThrow(/cloudinary:\/\//);
    try {
      normalizeCloudinaryUrl(secret);
    } catch (error) {
      expect((error as Error).message).not.toContain('motdepasse-secret');
    }
  });

  it('refuse les espaces réservés d’un exemple copié tel quel', () => {
    expect(() => normalizeCloudinaryUrl('cloudinary://<your_api_key>:<your_api_secret>@moncompte')).toThrow(
      /espaces réservés/,
    );
  });
});
