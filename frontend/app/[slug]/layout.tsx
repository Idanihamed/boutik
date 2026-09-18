import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStorefront } from '../../lib/server-api';
import { StoreProvider } from '../../lib/store-context';
import { StoreFooter } from '../../components/storefront/StoreFooter';
import { StoreHeader } from '../../components/storefront/StoreHeader';

type Props = { params: { slug: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const store = await getStorefront(params.slug);
  if (!store) return { title: 'Entreprise introuvable' };
  const description = store.description ?? `Découvrez les produits de ${store.name}.`;
  return {
    title: { default: store.name, template: `%s · ${store.name}` },
    description,
    openGraph: { title: store.name, description, images: store.logo ? [store.logo] : undefined },
  };
}

export default async function StorefrontLayout({ params, children }: Props) {
  const store = await getStorefront(params.slug);
  // Entreprise inexistante, en attente, suspendue ou bannie : la vitrine n'existe pas (404).
  if (!store) notFound();

  return (
    <StoreProvider store={store}>
      <StoreHeader />
      {children}
      <StoreFooter store={store} />
    </StoreProvider>
  );
}
