import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorBox } from '../components/ui';
import { ApiError } from '../lib/api';
import { COLORS } from '../lib/labels';
import { useSession } from '../lib/session';

export default function LoginScreen() {
  const { user, loading, login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Redirect href="/" />;

  async function submit() {
    if (!email.trim() || !password) return setError('Saisissez votre email et votre mot de passe.');
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>Boutik</Text>
          <Text style={styles.subtitle}>Gérez votre entreprise depuis votre téléphone.</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              accessibilityLabel="Email"
            />
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              accessibilityLabel="Mot de passe"
              onSubmitEditing={submit}
            />
            {error && <ErrorBox message={error} />}
            <Button label="Se connecter" onPress={submit} loading={busy} />
            {busy && <Text style={styles.hint}>La première connexion peut prendre jusqu’à une minute.</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingTop: 64, gap: 8 },
  logo: { fontSize: 36, fontWeight: '800', color: COLORS.brand },
  subtitle: { fontSize: 16, color: COLORS.muted, marginBottom: 24 },
  form: { gap: 10 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  hint: { color: COLORS.muted, textAlign: 'center', fontSize: 13 },
});
