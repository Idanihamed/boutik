// Alphabet sans 0/O/1/I (ambigus à recopier à la main depuis un écran de confirmation ou un
// vocal) pour les références de suivi communiquées au public (messages de contact, commandes).
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERENCE_LENGTH = 8;

export function generateReference(): string {
  let reference = '';
  for (let i = 0; i < REFERENCE_LENGTH; i++) {
    reference += REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)];
  }
  return reference;
}
