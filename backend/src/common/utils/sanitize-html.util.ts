import sanitizeHtml from 'sanitize-html';

/**
 * §20/§22 du cahier des charges : le champ "Contenu" des Actualités et des Pages accepte du
 * HTML tapé directement par l'administrateur (pas encore de véritable éditeur WYSIWYG — voir
 * README, "Ce qui n'est pas encore fait"), et ce HTML est ensuite injecté tel quel dans la
 * page publique via `dangerouslySetInnerHTML` (voir les pages [slug] du site public).
 *
 * SANS NETTOYAGE, ce champ est une faille XSS stockée en bonne et due forme : n'importe quel
 * compte ayant seulement `articles:create`/`update` ou `pages:create`/`update` (donc pas
 * forcément Super Admin — un rôle Éditeur, par exemple) peut faire exécuter du JavaScript
 * arbitraire dans le navigateur de CHAQUE visiteur du site public qui ouvre cette actualité
 * ou cette page. Et comme le site public et le back-office partagent la même origine (donc
 * le même `localStorage`, voir lib/auth.ts), un tel script peut aussi lire les jetons de
 * connexion d'un administrateur qui aurait le site public ouvert dans un autre onglet du même
 * navigateur — un Éditeur malveillant pourrait ainsi usurper un compte Super Admin.
 *
 * On assainit donc ce HTML à l'écriture (create/update), en n'autorisant que les balises
 * "simples" que le formulaire d'administration est censé produire (paragraphes, gras,
 * italique, listes, titres de niveau 2/3, citations, liens) — tout le reste (script, iframe,
 * balises d'événements `on...`, styles en ligne, liens `javascript:`...) est supprimé.
 */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'a'];

export function sanitizeContentHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    // Empêche les liens `javascript:`/`data:` : seuls ces trois protocoles sont acceptés,
    // un lien avec un autre protocole perd simplement son attribut href.
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      // Un lien ouvert dans un nouvel onglet (target="_blank") sans rel="noopener" expose la
      // page d'origine à l'attaque "reverse tabnabbing" — on l'impose systématiquement.
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
    },
  });
}
