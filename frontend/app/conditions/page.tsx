import type { Metadata } from 'next';
import { LegalDocument, LegalSection } from '../../components/LegalDocument';

export const metadata: Metadata = { title: 'Conditions d’utilisation · Boutik' };

export default function TermsPage() {
  return (
    <LegalDocument title="Conditions d’utilisation" updated="21 septembre 2026">
      <LegalSection title="1. Ce qu’est Boutik">
        <p>
          Boutik est une plateforme qui permet à des entreprises de créer leur propre boutique en ligne (leur « vitrine
          ») et de recevoir des commandes et des messages de leurs clients. Boutik fournit l’outil technique ; chaque
          vitrine est gérée par l’entreprise qui l’a créée.
        </p>
      </LegalSection>

      <LegalSection title="2. Rôle de Boutik dans les ventes">
        <p>
          Boutik n’est ni le vendeur, ni le livreur, ni le garant des produits présentés. Le contrat de vente est conclu
          directement entre le client et l’entreprise. Le prix, la disponibilité, la livraison, le paiement, la garantie
          et le service après-vente relèvent de l’entreprise. En cas de problème avec une commande, le client s’adresse
          d’abord à l’entreprise concernée.
        </p>
      </LegalSection>

      <LegalSection title="3. Comptes">
        <ul className="list-disc space-y-1 pl-5">
          <li>Les informations données à l’inscription doivent être exactes et tenues à jour.</li>
          <li>Chacun est responsable de la confidentialité de son mot de passe et de ce qui est fait avec son compte.</li>
          <li>Une entreprise inscrite est d’abord examinée : sa vitrine n’est visible du public qu’après validation.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Ce que les entreprises s’engagent à faire">
        <ul className="list-disc space-y-1 pl-5">
          <li>Ne proposer que des produits et services légaux, qu’elles ont le droit de vendre.</li>
          <li>Donner des descriptions, des prix et des photos honnêtes, et honorer les commandes acceptées.</li>
          <li>
            Ne publier aucun contenu illégal, trompeur, contrefait, violent, discriminatoire ou portant atteinte aux
            droits d’autrui.
          </li>
          <li>Respecter les données personnelles de leurs clients et ne s’en servir que pour traiter leurs commandes.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Signalements et modération">
        <p>
          Tout utilisateur connecté peut signaler une entreprise. Boutik peut examiner les signalements et, si les
          présentes conditions ne sont pas respectées, refuser, suspendre ou bannir une entreprise, en expliquant sa
          décision. Les signalements ne suspendent jamais une entreprise automatiquement : une décision est prise par un
          administrateur de la plateforme.
        </p>
      </LegalSection>

      <LegalSection title="6. Disponibilité du service">
        <p>
          Boutik s’efforce de rester disponible mais ne peut pas garantir un service sans interruption. Des maintenances
          ou des pannes peuvent survenir. Pendant la phase de lancement, le service peut être plus lent après une période
          d’inactivité.
        </p>
      </LegalSection>

      <LegalSection title="7. Responsabilité">
        <p>
          Boutik n’est pas responsable du contenu publié par les entreprises, ni des ventes conclues entre elles et leurs
          clients. Boutik n’est responsable que des dommages directs causés par une faute de sa part dans le
          fonctionnement de la plateforme, dans les limites permises par la loi.
        </p>
      </LegalSection>

      <LegalSection title="8. Données personnelles">
        <p>
          L’utilisation des données personnelles est décrite dans notre{' '}
          <a href="/confidentialite" className="text-brand-700 hover:underline">
            politique de confidentialité
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="9. Évolution des conditions">
        <p>
          Ces conditions peuvent évoluer. La date de dernière mise à jour figure en haut de cette page. Continuer à
          utiliser Boutik après une modification vaut acceptation des nouvelles conditions.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
