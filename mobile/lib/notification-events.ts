// Petit canal pour dire à la cloche « le nombre d'alertes non lues a changé » (écran Notifications → en-tête).
type Listener = () => void;
const listeners = new Set<Listener>();

export function onNotificationsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyNotificationsChanged() {
  listeners.forEach((listener) => listener());
}
