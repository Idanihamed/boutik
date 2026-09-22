import type { Metadata } from 'next';
import { LegalDocument, LegalSection } from '../../components/LegalDocument';

export const metadata: Metadata = { title: 'Mentions légales · Boutik' };

export default function LegalNoticePage() {
  return (
    <LegalDocument title="Mentions légales" updated="22 septembre 2026">
      <LegalSection title="1. Éditeur du site">
        <p>
          Le site et l’application Boutik sont édités par Hamed Idani, entreprise individuelle / personne physique,
          basé(e) à Ouagadougou, Burkina Faso.
        </p>
        <p>
          Contact : <a href="mailto:hamedidani73@gmail.com" className="text-brand-700 hover:underline">hamedidani73@gmail.com</a>
        </p>
      </LegalSection>

      <LegalSection title="2. Directeur de la publication">
        <p>Hamed Idani, en sa qualité d’exploitant du site.</p>
      </LegalSection>

      <LegalSection title="3. Hébergement">
        <p>
          Le site (vitrines et espace responsable) est hébergé par Vercel Inc. Le serveur applicatif est hébergé par
          Render Services, Inc. La base de données est hébergée par Neon, Inc. Les photos et vidéos déposées sur la
          plateforme sont hébergées par Cloudinary Ltd. Chacun de ces prestataires n’intervient que pour l’hébergement
          technique et n’a pas accès aux données autrement que pour assurer ce service.
        </p>
      </LegalSection>

      <LegalSection title="4. Statut de Boutik vis-à-vis des entreprises et des ventes">
        <p>
          Boutik est un outil technique mis à disposition d’entreprises tierces pour créer leur propre boutique en
          ligne. Boutik n’est ni le vendeur, ni le livreur, ni le garant des produits ou services présentés sur une
          vitrine : le détail de ce rôle et des responsabilités de chacun est précisé dans les{' '}
          <a href="/conditions" className="text-brand-700 hover:underline">
            conditions d’utilisation
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="5. Propriété intellectuelle">
        <p>
          La marque « Boutik », le nom de domaine et le code de la plateforme appartiennent à son éditeur. Le contenu
          publié par chaque entreprise sur sa vitrine (nom, logo, descriptions, photos de produits) reste la propriété
          de cette entreprise, qui est seule responsable d’avoir le droit de le publier.
        </p>
      </LegalSection>

      <LegalSection title="6. Données personnelles">
        <p>
          Le traitement des données personnelles est décrit dans la{' '}
          <a href="/confidentialite" className="text-brand-700 hover:underline">
            politique de confidentialité
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
