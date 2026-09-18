// Doublure de "sanitize-html" pour les tests d'intégration : ses dépendances (htmlparser2 ≥ 10)
// sont en ESM pur, que Jest ne charge pas ici. L'isolation entre entreprises testée dans ce
// dossier ne dépend pas de l'assainissement HTML des articles.
export default function sanitizeHtml(input: string): string {
  return input;
}
