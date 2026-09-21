import { ForbiddenException } from '@nestjs/common';
import { TENANT_MODELS, scopeArgs } from './tenant-prisma';
import { currentBusinessId, tenantStorage } from './tenant-context';

const BIZ = 'business-1';

describe('scopeArgs (isolation par entreprise)', () => {
  it.each(['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany'])(
    '%s : ajoute businessId au filtre, en ET avec le filtre existant',
    (operation) => {
      expect(scopeArgs(operation, { where: { status: 'PUBLISHED' } }, BIZ).where).toEqual({
        AND: [{ status: 'PUBLISHED' }, { businessId: BIZ }],
      });
    },
  );

  it('restreint aussi une requête sans aucun filtre', () => {
    expect(scopeArgs('findMany', {}, BIZ).where).toEqual({ businessId: BIZ });
    expect(scopeArgs('count', undefined, BIZ).where).toEqual({ businessId: BIZ });
  });

  it.each(['findUnique', 'findUniqueOrThrow', 'update', 'delete'])(
    '%s : ajoute businessId à la clé, donc un id d’une autre entreprise est introuvable',
    (operation) => {
      expect(scopeArgs(operation, { where: { id: 'x' }, data: {} }, BIZ).where).toEqual({ id: 'x', businessId: BIZ });
    },
  );

  it('ne laisse pas l’appelant choisir une autre entreprise dans un filtre unitaire', () => {
    expect(scopeArgs('findUnique', { where: { id: 'x', businessId: 'autre' } }, BIZ).where).toEqual({
      id: 'x',
      businessId: BIZ,
    });
  });

  it('un filtre qui vise une autre entreprise est neutralisé par le ET (résultat vide, pas de fuite)', () => {
    expect(scopeArgs('findMany', { where: { businessId: 'autre' } }, BIZ).where).toEqual({
      AND: [{ businessId: 'autre' }, { businessId: BIZ }],
    });
  });

  it('create : impose businessId, écrasant celui fourni par l’appelant', () => {
    expect(scopeArgs('create', { data: { name: 'A', businessId: 'autre' } }, BIZ).data).toEqual({
      name: 'A',
      businessId: BIZ,
    });
  });

  it('createMany : impose businessId sur chaque ligne', () => {
    expect(scopeArgs('createMany', { data: [{ name: 'A' }, { name: 'B', businessId: 'autre' }] }, BIZ).data).toEqual([
      { name: 'A', businessId: BIZ },
      { name: 'B', businessId: BIZ },
    ]);
  });

  it('upsert : restreint la clé et impose businessId à la création', () => {
    const args = scopeArgs('upsert', { where: { id: 'x' }, create: { name: 'A' }, update: { name: 'B' } }, BIZ);
    expect(args.where).toEqual({ id: 'x', businessId: BIZ });
    expect(args.create).toEqual({ name: 'A', businessId: BIZ });
    expect(args.update).toEqual({ name: 'B' });
  });

  it('ne modifie pas l’objet d’arguments d’origine', () => {
    const original = { where: { id: 'x' } };
    scopeArgs('findUnique', original, BIZ);
    expect(original).toEqual({ where: { id: 'x' } });
  });

  it('refuse toute opération non prévue (échec fermé) plutôt que de la laisser passer sans filtre', () => {
    expect(() => scopeArgs('findRaw', {}, BIZ)).toThrow(ForbiddenException);
    expect(() => scopeArgs('aggregateRaw', {}, BIZ)).toThrow(ForbiddenException);
    expect(() => scopeArgs('createManyAndReturn', {}, BIZ)).toThrow(ForbiddenException);
  });
});

describe('modèles isolés', () => {
  it('couvre toutes les tables qui portent un businessId propre à l’entreprise', () => {
    expect([...TENANT_MODELS].sort()).toEqual(
      [
        'Article',
        'Boutique',
        'Brand',
        'Category',
        'ContactMessage',
        'Notification',
        'Order',
        'Page',
        'Product',
        'PromoCode',
        'Promotion',
        'Setting',
      ].sort(),
    );
  });
});

describe('contexte d’entreprise (AsyncLocalStorage)', () => {
  it('est absent hors requête', () => {
    expect(currentBusinessId()).toBeUndefined();
  });

  it('est propagé à travers les appels asynchrones, sans se mélanger entre requêtes parallèles', async () => {
    const read = async (id: string) =>
      tenantStorage.run({ businessId: id }, async () => {
        await new Promise((resolve) => setTimeout(resolve, id === 'a' ? 15 : 1));
        return currentBusinessId();
      });

    await expect(Promise.all([read('a'), read('b')])).resolves.toEqual(['a', 'b']);
  });
});
