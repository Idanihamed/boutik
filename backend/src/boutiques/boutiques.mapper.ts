import { Prisma } from '@prisma/client';

const boutiqueWithImages = Prisma.validator<Prisma.BoutiqueDefaultArgs>()({
  include: {
    images: { orderBy: { sortOrder: 'asc' } },
  },
});

export type BoutiqueWithImages = Prisma.BoutiqueGetPayload<typeof boutiqueWithImages>;

/**
 * §19 du cahier des charges : nom, adresse, téléphone, WhatsApp, horaires, description,
 * coordonnées GPS, lien Google Maps, photos, statut.
 */
export function toBoutiqueView(boutique: BoutiqueWithImages) {
  return {
    id: boutique.id,
    name: boutique.name,
    slug: boutique.slug,
    address: boutique.address,
    phone: boutique.phone,
    whatsapp: boutique.whatsapp,
    hours: boutique.hours,
    description: boutique.description,
    latitude: boutique.latitude,
    longitude: boutique.longitude,
    googleMapsUrl: boutique.googleMapsUrl,
    isActive: boutique.isActive,
    sortOrder: boutique.sortOrder,
    images: boutique.images.map((img) => ({ id: img.id, url: img.url, alt: img.alt, isMain: img.isMain })),
    createdAt: boutique.createdAt,
    updatedAt: boutique.updatedAt,
  };
}

export const BOUTIQUE_INCLUDE = boutiqueWithImages.include;
