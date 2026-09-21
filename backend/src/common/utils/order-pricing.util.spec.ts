import { computeShippingFee, evaluatePromoCode, normalizePromoCode, PromoCodeRules } from './order-pricing.util';

const promo = (overrides: Partial<PromoCodeRules> = {}): PromoCodeRules => ({
  type: 'PERCENTAGE',
  value: 10,
  minOrderAmount: null,
  maxUses: null,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
  ...overrides,
});

describe('normalizePromoCode', () => {
  it('ignore la casse et les espaces autour', () => {
    expect(normalizePromoCode('  bienvenue10 ')).toBe('BIENVENUE10');
  });
});

describe('evaluatePromoCode', () => {
  it('calcule un pourcentage arrondi à l’entier inférieur', () => {
    expect(evaluatePromoCode(promo({ value: 10 }), 15005, 'XOF')).toEqual({ valid: true, discount: 1500 });
  });

  it('retire un montant fixe', () => {
    expect(evaluatePromoCode(promo({ type: 'FIXED_AMOUNT', value: 2000 }), 15000, 'XOF')).toEqual({ valid: true, discount: 2000 });
  });

  it('ne dépasse jamais le sous-total (la commande ne devient pas négative)', () => {
    expect(evaluatePromoCode(promo({ type: 'FIXED_AMOUNT', value: 5000 }), 3000, 'XOF')).toEqual({ valid: true, discount: 3000 });
    expect(evaluatePromoCode(promo({ value: 100 }), 3000, 'XOF')).toEqual({ valid: true, discount: 3000 });
  });

  it('refuse un code inconnu ou désactivé avec le même message', () => {
    const unknown = evaluatePromoCode(null, 10000, 'XOF');
    const disabled = evaluatePromoCode(promo({ isActive: false }), 10000, 'XOF');
    expect(unknown).toEqual(disabled);
    expect(unknown.valid).toBe(false);
  });

  it('refuse un code pas encore valable ou expiré', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    expect(evaluatePromoCode(promo({ startsAt: new Date('2026-07-01T00:00:00Z') }), 10000, 'XOF', now)).toMatchObject({
      valid: false,
      message: expect.stringContaining('pas encore'),
    });
    expect(evaluatePromoCode(promo({ endsAt: new Date('2026-06-01T00:00:00Z') }), 10000, 'XOF', now)).toMatchObject({
      valid: false,
      message: expect.stringContaining('expiré'),
    });
    expect(evaluatePromoCode(promo({ startsAt: new Date('2026-06-01T00:00:00Z'), endsAt: new Date('2026-07-01T00:00:00Z') }), 10000, 'XOF', now)).toMatchObject({ valid: true });
  });

  it('refuse un code dont toutes les utilisations sont consommées', () => {
    expect(evaluatePromoCode(promo({ maxUses: 5, usedCount: 5 }), 10000, 'XOF')).toMatchObject({ valid: false });
    expect(evaluatePromoCode(promo({ maxUses: 5, usedCount: 4 }), 10000, 'XOF')).toMatchObject({ valid: true });
  });

  it('exige le montant minimum et l’indique clairement', () => {
    const res = evaluatePromoCode(promo({ minOrderAmount: 20000 }), 15000, 'XOF');
    expect(res).toMatchObject({ valid: false });
    expect((res as { message: string }).message).toContain('20');
    expect((res as { message: string }).message).toContain('FCFA');
    expect(evaluatePromoCode(promo({ minOrderAmount: 20000 }), 20000, 'XOF')).toMatchObject({ valid: true });
  });
});

describe('computeShippingFee', () => {
  const settings = { shippingFee: 1500, freeShippingThreshold: 25000 };

  it('applique les frais de livraison à domicile', () => {
    expect(computeShippingFee(settings, 10000, false)).toBe(1500);
  });

  it('ne facture jamais un retrait en boutique', () => {
    expect(computeShippingFee(settings, 10000, true)).toBe(0);
  });

  it('offre la livraison à partir du seuil (seuil compris)', () => {
    expect(computeShippingFee(settings, 24999, false)).toBe(1500);
    expect(computeShippingFee(settings, 25000, false)).toBe(0);
  });

  it('sans seuil, la livraison n’est jamais offerte', () => {
    expect(computeShippingFee({ shippingFee: 1500, freeShippingThreshold: null }, 999999, false)).toBe(1500);
  });

  it('livraison gratuite par défaut (frais à 0)', () => {
    expect(computeShippingFee({ shippingFee: 0, freeShippingThreshold: null }, 5000, false)).toBe(0);
  });
});
