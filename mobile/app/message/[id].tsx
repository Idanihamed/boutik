import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, ErrorBox, Loader, Pill } from '../../components/ui';
import { ApiError, getMessage, replyToMessage, setMessageStatus } from '../../lib/api';
import { COLORS, contactLinks, formatDate, MESSAGE_STATUS_COLORS, MESSAGE_STATUS_LABELS } from '../../lib/labels';
import { useSession } from '../../lib/session';
import type { AdminMessage } from '../../lib/types';

export default function MessageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useSession();
  const canUpdate = can('messages:update');
  const [message, setMessage] = useState<AdminMessage | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      let current = await getMessage(id);
      // Ouvrir un nouveau message le marque comme lu.
      if (current.status === 'NOUVEAU' && canUpdate) {
        current = await setMessageStatus(id, 'LU').catch(() => current);
      }
      setMessage(current);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger le message.');
    }
  }, [id, canUpdate]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!message || !reply.trim()) return;
    setBusy(true);
    try {
      setMessage(await replyToMessage(message.id, reply.trim()));
      setReply('');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function markTreated() {
    if (!message) return;
    setBusy(true);
    try {
      setMessage(await setMessageStatus(message.id, 'TRAITE'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !message) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorBox message={error} onRetry={load} />
      </View>
    );
  }
  if (!message) return <Loader />;

  const links = contactLinks(message.contact);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.subject}>{message.subject}</Text>
          <Pill label={MESSAGE_STATUS_LABELS[message.status]} {...MESSAGE_STATUS_COLORS[message.status]} />
        </View>
        <Text style={styles.muted}>
          {message.name} · {message.contact} · {formatDate(message.createdAt)}
        </Text>

        <Card>
          <Text style={styles.body}>{message.message}</Text>
        </Card>

        {links.length > 0 && (
          <View style={styles.linkRow}>
            {links.map((l) => (
              <View key={l.url} style={{ flex: 1 }}>
                <Button label={l.label} variant="secondary" onPress={() => Linking.openURL(l.url)} />
              </View>
            ))}
          </View>
        )}

        {message.replyMessage && (
          <Card style={{ backgroundColor: COLORS.brandLight, borderColor: COLORS.brandLight, gap: 6 }}>
            <Text style={styles.section}>Votre réponse{message.repliedAt ? ` · ${formatDate(message.repliedAt)}` : ''}</Text>
            <Text style={styles.body}>{message.replyMessage}</Text>
          </Card>
        )}

        {error && <ErrorBox message={error} />}

        {canUpdate && (
          <View style={{ gap: 10 }}>
            <Text style={styles.section}>{message.replyMessage ? 'Envoyer une autre réponse' : 'Répondre'}</Text>
            <TextInput
              style={styles.input}
              value={reply}
              onChangeText={setReply}
              multiline
              placeholder="Votre réponse au client…"
              placeholderTextColor={COLORS.muted}
              accessibilityLabel="Votre réponse"
            />
            <Button label="Envoyer la réponse" onPress={send} loading={busy} disabled={!reply.trim()} />
            {message.status !== 'TRAITE' && (
              <Button label="Marquer comme traité" variant="secondary" onPress={markTreated} disabled={busy} />
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  subject: { fontSize: 20, fontWeight: '800', color: COLORS.text, flexShrink: 1 },
  muted: { color: COLORS.muted, fontSize: 14 },
  body: { fontSize: 16, color: COLORS.text, lineHeight: 22 },
  section: { fontSize: 13, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  linkRow: { flexDirection: 'row', gap: 8 },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    textAlignVertical: 'top',
  },
});
