import type { Metadata } from 'next';
import { LegalDocument, LegalSection } from '../../components/LegalDocument';

export const metadata: Metadata = { title: 'Politique de confidentialité · Boutik' };

export default function PrivacyPage() {
  return (
    <LegalDocument title="Politique de confidentialité" updated="21 septembre 2026">
      <LegalSection title="1. Les données que nous recueillons">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Comptes</strong> (responsables, équipes, clients inscrits) : nom, adresse email, mot de passe (conservé
            sous forme chiffrée, jamais en clair).
          </li>
          <li>
            <strong>Commandes</strong> : nom, téléphone ou email, adresse de livraison, notes et articles commandés.
          </li>
          <li>
            <strong>Messages</strong> envoyés à une entreprise, avec les pièces jointes éventuelles.
          </li>
          <li>
            <strong>Entreprises</strong> : nom, logo, pays, description, produits et photos.
          </li>
          <li>
            <strong>Application mobile</strong> : un identifiant de téléphone, uniquement pour envoyer aux équipes les
            alertes de leur entreprise (nouvelle commande, message, stock).
          </li>
          <li>
            <strong>Données techniques</strong> : adresse IP, utilisée pour limiter les abus (spam, tentatives de connexion
            répétées).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. À quoi elles servent">
        <p>
          À faire fonctionner la plateforme : permettre de passer et suivre une commande, contacter une entreprise,
          gérer sa boutique, alerter son équipe, et protéger le service contre les abus. Nous ne vendons pas vos données
          et n’affichons pas de publicité ciblée.
        </p>
      </LegalSection>

      <LegalSection title="3. Qui y a accès">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>L’entreprise concernée</strong> voit les commandes et messages qui la concernent, pour les traiter.
            Une entreprise ne voit jamais les données d’une autre entreprise.
          </li>
          <li>
            <strong>Les administrateurs de la plateforme</strong> accèdent aux informations nécessaires à la modération
            (entreprises, signalements).
          </li>
          <li>
            <strong>Nos prestataires techniques</strong>, qui hébergent ou transmettent les données pour notre compte :
            hébergement du site et du serveur, base de données, stockage des photos, et acheminement des alertes sur
            téléphone. Ils traitent les données uniquement pour faire fonctionner Boutik.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Combien de temps nous les gardons">
        <p>
          Les données d’un compte ou d’une entreprise sont conservées tant que le compte existe. Vous pouvez demander leur
          suppression (voir ci-dessous). Les données de commande peuvent être conservées plus longtemps si la loi ou la
          gestion d’un litige l’exige.
        </p>
      </LegalSection>

      <LegalSection title="5. Vos droits">
        <p>
          Vous pouvez demander à accéder à vos données, à les corriger ou à les supprimer, et vous opposer à certains
          usages. Pour une commande ou un message, adressez-vous d’abord à l’entreprise concernée, qui en est responsable.
          Pour un compte sur la plateforme, utilisez la page de contact de Boutik ou signalez la demande à un
          administrateur.
        </p>
      </LegalSection>

      <LegalSection title="6. Sécurité">
        <p>
          Les mots de passe sont chiffrés, les échanges avec le site sont sécurisés (HTTPS), les sessions expirent, et les
          données de chaque entreprise sont isolées de celles des autres. Aucun système n’étant infaillible, nous vous
          invitons à choisir un mot de passe long et unique.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies">
        <p>
          Boutik utilise uniquement des cookies indispensables : ils maintiennent votre connexion et protègent votre
          compte. Aucun cookie publicitaire ou de suivi n’est utilisé. Le contenu de votre panier est conservé sur votre
          appareil.
        </p>
      </LegalSection>

      <LegalSection title="8. Modifications">
        <p>
          Cette politique peut évoluer. La date de dernière mise à jour figure en haut de la page.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
