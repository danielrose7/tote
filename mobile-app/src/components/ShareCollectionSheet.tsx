import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Share,
  Linking,
  TextInput,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
import { useAccount } from "jazz-tools/expo";
import { JazzAccount, Block } from "@tote/schema";
import {
  publishCollection,
  unpublishCollection,
  getShareUrl,
  syncPublishedToClerk,
  removePublishedFromClerk,
  parameterize,
} from "../lib/shareCollection";

interface Props {
  collection: typeof Block.prototype;
  visible: boolean;
  onClose: () => void;
}

export function ShareCollectionSheet({ collection, visible, onClose }: Props) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const me = useAccount(JazzAccount, { resolve: { root: { blocks: true } } });

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [isSavingSlug, setIsSavingSlug] = useState(false);

  useEffect(() => {
    const currentSlug = collection.collectionData?.slug;
    setSlugInput(currentSlug || parameterize(collection.name ?? ""));
  }, [collection.collectionData?.slug, collection.name]);

  const publishedId = collection.collectionData?.publishedId;
  const isPublished = !!publishedId;
  const shareUrl = getShareUrl(collection, user?.username);
  const defaultSlug = parameterize(collection.name ?? "");
  const normalizedSlugInput = parameterize(slugInput);
  const isDefaultSlug = normalizedSlugInput === defaultSlug;

  async function handlePublish() {
    if (!me) return;
    setLoading(true);
    try {
      publishCollection(collection, me);

      const slug = collection.collectionData?.slug;
      const pid = collection.collectionData?.publishedId;
      if (slug && pid) {
        const token = await getToken();
        if (token) {
          await syncPublishedToClerk(slug, pid, collection.name ?? "", token);
        }
      }
    } catch (e) {
      console.error("Publish error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnpublish() {
    setLoading(true);
    try {
      const slug = collection.collectionData?.slug;
      unpublishCollection(collection);
      if (slug) {
        const token = await getToken();
        if (token) await removePublishedFromClerk(slug, token);
      }
    } catch (e) {
      console.error("Unpublish error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!shareUrl) return;
    await Share.share({ message: shareUrl, url: shareUrl });
  }

  async function handleSaveSlug() {
    const newSlug = normalizedSlugInput;
    const currentSlug = collection.collectionData?.slug;
    if (!newSlug || newSlug === currentSlug) {
      setEditingSlug(false);
      return;
    }
    setIsSavingSlug(true);
    try {
      const oldData = collection.collectionData;
      collection.$jazz.set("collectionData", { ...oldData, slug: newSlug });
      const token = await getToken();
      if (token) {
        if (currentSlug) await removePublishedFromClerk(currentSlug, token);
        const pid = collection.collectionData?.publishedId;
        if (pid) await syncPublishedToClerk(newSlug, pid, collection.name ?? "", token);
      }
      setSlugInput(newSlug);
      setEditingSlug(false);
    } catch (e) {
      console.error("Failed to save slug", e);
    } finally {
      setIsSavingSlug(false);
    }
  }

  function handleResetSlug() {
    if (isDefaultSlug) return;
    setSlugInput(defaultSlug);
  }

  async function handleText() {
    if (!shareUrl) return;
    const name = collection.name ?? "a collection";
    const body = `Check out my ${name} collection on Tote: ${shareUrl}`;
    await Linking.openURL(`sms:?body=${encodeURIComponent(body)}`);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Share Collection</Text>

          {!isPublished ? (
            <View style={styles.section}>
              <Text style={styles.description}>
                Make this collection publicly viewable — anyone with the link can browse your picks.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handlePublish} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="globe-outline" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Make Public</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.linkHeader}>
                <Text style={styles.linkLabel}>Public link</Text>
                {!editingSlug ? (
                  <View style={styles.headerActions}>
                    <TouchableOpacity onPress={() => setEditingSlug(true)} style={styles.inlineEditBtn}>
                      <Ionicons name="pencil-outline" size={15} color="#6366f1" />
                      <Text style={styles.inlineEditText}>Edit URL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.unpublishBtn} onPress={handleUnpublish} disabled={loading}>
                      {loading ? (
                        <ActivityIndicator color="#ef4444" />
                      ) : (
                        <>
                          <Ionicons name="remove-circle-outline" size={15} color="#ef4444" />
                          <Text style={styles.unpublishText}>Unpublish</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.inlineEditActions}>
                    {!isDefaultSlug ? (
                      <TouchableOpacity style={styles.slugResetBtn} onPress={handleResetSlug}>
                        <Text style={styles.slugResetBtnText}>Reset to default</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.slugSaveBtn, isSavingSlug && styles.slugSaveBtnDisabled]}
                      onPress={handleSaveSlug}
                      disabled={isSavingSlug}
                    >
                      {isSavingSlug ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.slugSaveBtnText}>Save</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.slugCancelBtn}
                      onPress={() => {
                        setSlugInput(collection.collectionData?.slug ?? defaultSlug);
                        setEditingSlug(false);
                      }}
                    >
                      <Ionicons name="close" size={18} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {!editingSlug ? (
                <Text style={styles.linkUrl} numberOfLines={1}>{shareUrl}</Text>
              ) : (
                <View style={styles.slugEditRow}>
                  <Text style={styles.slugPrefix}>https://tote.tools/</Text>
                  <Text style={styles.slugPathPrefix}>s/{user?.username}/</Text>
                  <TextInput
                    style={styles.slugInput}
                    value={slugInput}
                    onChangeText={setSlugInput}
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSaveSlug}
                  />
                </View>
              )}

              <View style={styles.linkActions}>
                <TouchableOpacity style={styles.linkBtn} onPress={handleCopy}>
                  <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color="#6366f1" />
                  <Text style={styles.linkBtnText}>{copied ? "Copied!" : "Copy"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkBtn} onPress={handleText}>
                  <Ionicons name="chatbubble-outline" size={16} color="#6366f1" />
                  <Text style={styles.linkBtnText}>Text</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkBtn} onPress={handleShare}>
                  <Ionicons name="share-outline" size={16} color="#6366f1" />
                  <Text style={styles.linkBtnText}>More</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  overlay: { position: "absolute", bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 44,
  },
  handle: {
    width: 36, height: 4, backgroundColor: "#e5e7eb",
    borderRadius: 2, alignSelf: "center", marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: "700", marginBottom: 20 },
  section: { gap: 12 },
  description: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366f1",
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  linkHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkLabel: { fontSize: 12, fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inlineEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
  },
  inlineEditText: { fontSize: 14, color: "#6366f1", fontWeight: "600" },
  inlineEditActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkUrl: { fontSize: 14, color: "#374151", backgroundColor: "#f9fafb", padding: 10, borderRadius: 8 },
  linkActions: { flexDirection: "row", gap: 10 },
  linkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#6366f1",
    borderRadius: 10,
    paddingVertical: 11,
  },
  linkBtnText: { fontSize: 14, color: "#6366f1", fontWeight: "600" },
  unpublishBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#ffe4e6",
  },
  unpublishText: { fontSize: 14, color: "#ef4444", fontWeight: "600" },
  slugEditRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  slugPrefix: { fontSize: 13, color: "#9ca3af" },
  slugPathPrefix: { fontSize: 13, color: "#9ca3af" },
  slugInput: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    borderBottomWidth: 1,
    borderBottomColor: "#6366f1",
    paddingVertical: 2,
  },
  slugSaveBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  slugSaveBtnDisabled: { opacity: 0.5 },
  slugSaveBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  slugResetBtn: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#f3f4f6",
  },
  slugResetBtnText: { color: "#4b5563", fontSize: 13, fontWeight: "600" },
  slugCancelBtn: { padding: 2 },
});
