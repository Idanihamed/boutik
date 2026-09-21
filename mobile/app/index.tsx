import { Redirect } from 'expo-router';
import { Loader } from '../components/ui';
import { useSession } from '../lib/session';

/** Point d'entrée : aiguille vers l'accueil si une session existe, sinon vers la connexion. */
export default function Index() {
  const { user, loading } = useSession();
  if (loading) return <Loader />;
  return <Redirect href={user ? '/(tabs)' : '/connexion'} />;
}
