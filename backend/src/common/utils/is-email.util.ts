// Les champs "contact" (commande, message de contact) acceptent indifféremment un téléphone
// ou un email (voir CreateOrderDto.customerContact / CreateContactMessageDto.contact) : avant
// de tenter un envoi d'email de confirmation, il faut d'abord vérifier que la valeur saisie en
// ressemble à un, sans quoi MailService tenterait (et échouerait silencieusement) d'envoyer un
// email à un numéro de téléphone.
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailLike(value: string): boolean {
  return SIMPLE_EMAIL_PATTERN.test(value.trim());
}
