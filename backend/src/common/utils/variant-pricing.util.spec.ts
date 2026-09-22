import { formatVariantLabel, resolveVariantBasePrice } from './variant-pricing.util';

describe('resolveVariantBasePrice', () => {
  const product = { price: 15000, promoPrice: 12000 };

  it('sans variante, renvoie le prix du produit tel quel', () => {
    expect(resolveVariantBasePrice(product, null)).toEqual({ price: 15000, promoPrice: 12000 });
  });

  it('une variante sans prix propre hérite intégralement du produit (prix normal ET promo)', () => {
    expect(resolveVariantBasePrice(product, { price: null, promoPrice: null })).toEqual({
      price: 15000,
      promoPrice: 12000,
    });
  });

  it('une variante peut garder le prix du produit mais définir SON PROPRE promo', () => {
    expect(resolveVariantBasePrice(product, { price: null, promoPrice: 13000 })).toEqual({
      price: 15000,
      promoPrice: 13000,
    });
  });

  it('une variante avec son propre prix ignore le promo du produit (calculé pour un autre prix)', () => {
    expect(resolveVariantBasePrice(product, { price: 18000, promoPrice: null })).toEqual({
      price: 18000,
      promoPrice: null,
    });
  });

  it('une variante avec son propre prix ET son propre promo utilise les deux', () => {
    expect(resolveVariantBasePrice(product, { price: 18000, promoPrice: 16000 })).toEqual({
      price: 18000,
      promoPrice: 16000,
    });
  });
});

describe('formatVariantLabel', () => {
  it('combine les deux dimensions avec un point médian', () => {
    expect(formatVariantLabel({ option1Value: 'M', option2Value: 'Rouge' })).toBe('M · Rouge');
  });

  it('ne garde que la dimension renseignée', () => {
    expect(formatVariantLabel({ option1Value: 'M', option2Value: null })).toBe('M');
    expect(formatVariantLabel({ option1Value: null, option2Value: 'Rouge' })).toBe('Rouge');
  });

  it('renvoie null sans variante ou sans aucune valeur', () => {
    expect(formatVariantLabel(null)).toBeNull();
    expect(formatVariantLabel(undefined)).toBeNull();
    expect(formatVariantLabel({ option1Value: null, option2Value: null })).toBeNull();
  });
});
