import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, ErrorBox, Loader, Pill } from '../../components/ui';
import {
  adjustProductStock,
  ApiError,
  getProduct,
  imageUrl,
  setProductImages,
  setProductPublication,
  updateProductPrices,
  uploadImage,
} from '../../lib/api';
import { COLORS, currencyLabel, formatPrice, STOCK_COLORS, STOCK_LABELS } from '../../lib/labels';
import { useSession } from '../../lib/session';
import type { Product } from '../../lib/types';

const toInt = (value: string) => Math.max(0, Math.trunc(Number(value.replace(/\s/g, '')) || 0));

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, can } = useSession();
  const currency = user?.business?.currency ?? 'XOF';
  const [product, setProduct] = useState<Product | null>(null);
  const [price, setPrice] = useState('');
  const [promo, setPromo] = useState('');
  const [delta, setDelta] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const apply = useCallback((p: Product) => {
    setProduct(p);
    setPrice(String(p.price));
    setPromo(p.promoPrice != null ? String(p.promoPrice) : '');
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await getProduct(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger le produit.');
    }
  }, [id, apply]);

  useEffect(() => {
    load();
  }, [load]);

  /** Exécute une action, affiche l'erreur éventuelle et le message de réussite. */
  async function run(key: string, success: string, action: () => Promise<Product>) {
    setBusy(key);
    setNotice(null);
    try {
      apply(await action());
      setError(null);
      setNotice(success);
    } catch (err) {
      setNotice(null);
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusy(null);
    }
  }

  function savePrices() {
    if (!product) return;
    const newPrice = toInt(price);
    const newPromo = promo.trim() === '' ? null : toInt(promo);
    if (newPromo !== null && newPromo >= newPrice) {
      return setError('Le prix promo doit être inférieur au prix normal.');
    }
    run('prices', 'Prix enregistrés.', () => updateProductPrices(product.id, { price: newPrice, promoPrice: newPromo }));
  }

  function changeStock(sign: 1 | -1) {
    if (!product) return;
    const amount = toInt(delta);
    if (amount < 1) return setError('Indiquez une quantité d’au moins 1.');
    if (sign === -1 && amount > product.stock) return setError(`Vous ne pouvez pas retirer plus que le stock actuel (${product.stock}).`);
    run('stock', sign === 1 ? 'Stock augmenté.' : 'Stock diminué.', () => adjustProductStock(product.id, sign * amount));
  }

  async function addPhoto(source: 'camera' | 'library') {
    if (!product) return;
    const permission =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert('Autorisation refusée', 'Autorisez l’accès dans les réglages du téléphone pour ajouter une photo.');
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const type = asset.mimeType ?? 'image/jpeg';
    const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    await run('photo', 'Photo ajoutée.', async () => {
      const url = await uploadImage({ uri: asset.uri, name: `photo.${extension}`, type });
      const existing = product.images.map((img, i) => ({ url: img.url, isMain: img.isMain, sortOrder: i }));
      const images = [...existing, { url, isMain: existing.length === 0, sortOrder: existing.length }];
      return setProductImages(product.id, images);
    });
  }

  if (error && !product) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorBox message={error} onRetry={load} />
      </View>
    );
  }
  if (!product) return <Loader />;

  const canUpdate = can('products:update');
  const canPublish = can('products:publish');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{product.name}</Text>
        <Text style={styles.muted}>
          Réf. {product.sku}
          {product.category ? ` · ${product.category.name}` : ''}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {product.images.length === 0 && (
            <View style={[styles.photo, { backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={styles.muted}>Aucune photo</Text>
            </View>
          )}
          {product.images.map((img) => (
            <Image key={img.url} source={{ uri: imageUrl(img.url) }} style={styles.photo} accessibilityIgnoresInvertColors />
          ))}
        </ScrollView>
        {canUpdate && (
          <View style={styles.rowButtons}>
            <View style={{ flex: 1 }}>
              <Button label="Prendre une photo" variant="secondary" onPress={() => addPhoto('camera')} loading={busy === 'photo'} disabled={busy !== null} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Choisir une photo" variant="secondary" onPress={() => addPhoto('library')} disabled={busy !== null} />
            </View>
          </View>
        )}

        {error && <ErrorBox message={error} />}
        {notice && (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <Text style={{ color: '#065f46' }}>{notice}</Text>
          </View>
        )}

        <Card style={{ gap: 10 }}>
          <Text style={styles.section}>Stock</Text>
          <View style={styles.rowButtons}>
            <Text style={styles.stock}>{product.stock}</Text>
            <Pill label={STOCK_LABELS[product.stockStatus]} {...STOCK_COLORS[product.stockStatus]} />
          </View>
          {canUpdate && (
            <>
              <TextInput
                style={styles.input}
                value={delta}
                onChangeText={setDelta}
                keyboardType="number-pad"
                accessibilityLabel="Quantité à ajouter ou retirer"
              />
              <View style={styles.rowButtons}>
                <View style={{ flex: 1 }}>
                  <Button label="Retirer" variant="secondary" onPress={() => changeStock(-1)} loading={busy === 'stock'} disabled={busy !== null} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Ajouter" onPress={() => changeStock(1)} loading={busy === 'stock'} disabled={busy !== null} />
                </View>
              </View>
            </>
          )}
        </Card>

        <Card style={{ gap: 10 }}>
          <Text style={styles.section}>Prix ({currencyLabel(currency)})</Text>
          {canUpdate ? (
            <>
              <Text style={styles.label}>Prix normal</Text>
              <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="number-pad" accessibilityLabel="Prix normal" />
              <Text style={styles.label}>Prix promo (vide = aucune promo)</Text>
              <TextInput style={styles.input} value={promo} onChangeText={setPromo} keyboardType="number-pad" accessibilityLabel="Prix promo" />
              <Button label="Enregistrer les prix" onPress={savePrices} loading={busy === 'prices'} disabled={busy !== null} />
            </>
          ) : (
            <Text style={styles.stock}>{formatPrice(product.effectivePrice, currency)}</Text>
          )}
          {product.onSale && product.effectivePrice !== product.price && (
            <Text style={styles.muted}>Prix affiché aux clients : {formatPrice(product.effectivePrice, currency)}</Text>
          )}
        </Card>

        {canPublish && (
          <Button
            label={product.status === 'PUBLISHED' ? 'Retirer de la vitrine' : 'Publier sur la vitrine'}
            variant={product.status === 'PUBLISHED' ? 'secondary' : 'primary'}
            loading={busy === 'publish'}
            disabled={busy !== null}
            onPress={() =>
              run('publish', product.status === 'PUBLISHED' ? 'Produit retiré de la vitrine.' : 'Produit publié.', () =>
                setProductPublication(product.id, product.status === 'PUBLISHED' ? 'unpublish' : 'publish'),
              )
            }
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  muted: { color: COLORS.muted, fontSize: 14 },
  photo: { width: 200, height: 200, borderRadius: 12 },
  rowButtons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  section: { fontSize: 13, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  stock: { fontSize: 30, fontWeight: '800', color: COLORS.text },
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
  notice: { backgroundColor: '#ecfdf5', borderRadius: 12, borderWidth: 1, borderColor: '#a7f3d0', padding: 12 },
});
