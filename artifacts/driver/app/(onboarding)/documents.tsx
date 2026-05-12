import React, { useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Platform, ScrollView, FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import {
  useGetMyDocuments,
  useRequestDocumentUploadUrl,
  useCreateMyDocument,
} from "@workspace/api-client-react";

const STEPS = ["Personal", "Address", "Banking", "Fleet", "Documents", "Agreement"];

const DOCUMENT_TYPES = [
  { key: "id_document", label: "SA ID Document", icon: "credit-card" as const, required: true },
  { key: "drivers_license", label: "Driver's License", icon: "truck" as const, required: true },
  { key: "pdp_certificate", label: "PDP Certificate", icon: "award" as const, required: true },
  { key: "proof_of_address", label: "Proof of Address", icon: "home" as const, required: false },
  { key: "bank_statement", label: "Bank Statement", icon: "file-text" as const, required: false },
];

export default function DocumentsStep() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: docsRes, refetch: refetchDocs } = useGetMyDocuments();
  const { mutateAsync: requestUploadUrl } = useRequestDocumentUploadUrl();
  const { mutateAsync: createDocument } = useCreateMyDocument();

  const docs: any[] = (docsRes as any)?.data ?? [];
  const [uploading, setUploading] = useState<string | null>(null);

  const getUploadedDoc = (type: string) =>
    docs.find((d: any) => d.documentType === type && !d.deletedAt);

  const handleUpload = async (docType: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    try {
      setUploading(docType);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const mimeType = asset.mimeType ?? "image/jpeg";
      const fileName = asset.fileName ?? `${docType}.jpg`;
      const fileSize = asset.fileSize ?? 500000;

      const urlRes: any = await requestUploadUrl({
        data: { name: fileName, size: fileSize, contentType: mimeType },
      });
      const { uploadURL, objectPath } = urlRes?.data ?? urlRes;

      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();
      await fetch(uploadURL, { method: "PUT", body: blob, headers: { "Content-Type": mimeType } });

      await createDocument({
        data: { documentType: docType, objectPath, fileName, mimeType, fileSizeBytes: fileSize },
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchDocs();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Upload Failed", "Could not upload document. Please try again.");
    } finally {
      setUploading(null);
    }
  };

  const handleCamera = async (docType: string) => {
    Alert.alert("Upload Document", "Choose a source", [
      { text: "Camera", onPress: async () => {
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          try {
            setUploading(docType);
            const mimeType = asset.mimeType ?? "image/jpeg";
            const fileName = asset.fileName ?? `${docType}.jpg`;
            const fileSize = asset.fileSize ?? 500000;
            const urlRes: any = await requestUploadUrl({ data: { name: fileName, size: fileSize, contentType: mimeType } });
            const { uploadURL, objectPath } = urlRes?.data ?? urlRes;
            const fileResponse = await fetch(asset.uri);
            const blob = await fileResponse.blob();
            await fetch(uploadURL, { method: "PUT", body: blob, headers: { "Content-Type": mimeType } });
            await createDocument({ data: { documentType: docType, objectPath, fileName, mimeType, fileSizeBytes: fileSize } });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            refetchDocs();
          } catch {
            Alert.alert("Upload Failed", "Could not upload document.");
          } finally {
            setUploading(null);
          }
        }
      }},
      { text: "Photo Library", onPress: () => handleUpload(docType) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const requiredUploaded = DOCUMENT_TYPES.filter((d) => d.required).every((d) => getUploadedDoc(d.key));
  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={s.progressRow}>
          {STEPS.map((_, i) => (
            <View key={i} style={[s.progressDot, { backgroundColor: i <= 4 ? colors.primary : colors.border }]} />
          ))}
        </View>
        <Text style={[s.stepLabel, { color: colors.mutedForeground }]}>Step 5 of 6</Text>
        <Text style={[s.stepTitle, { color: colors.foreground }]}>Upload Documents</Text>
        <Text style={[s.stepSub, { color: colors.mutedForeground }]}>Clear photos of your documents</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {DOCUMENT_TYPES.map((docType) => {
          const uploaded = getUploadedDoc(docType.key);
          const isUploading = uploading === docType.key;
          return (
            <Pressable
              key={docType.key}
              style={[s.docCard, { borderColor: uploaded ? colors.primary : colors.border, backgroundColor: colors.card }]}
              onPress={() => handleCamera(docType.key)}
              disabled={isUploading}
            >
              <View style={[s.docIcon, { backgroundColor: uploaded ? colors.primary + "20" : colors.muted }]}>
                {isUploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather name={docType.icon} size={20} color={uploaded ? colors.primary : colors.mutedForeground} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.docLabel, { color: colors.foreground }]}>{docType.label}</Text>
                <Text style={[s.docStatus, { color: uploaded ? colors.primary : colors.mutedForeground }]}>
                  {uploaded ? "Uploaded" : docType.required ? "Required" : "Optional"}
                </Text>
              </View>
              {uploaded ? (
                <Feather name="check-circle" size={20} color={colors.primary} />
              ) : (
                <Feather name="upload" size={18} color={colors.mutedForeground} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        {!requiredUploaded && (
          <Text style={[s.hint, { color: colors.mutedForeground }]}>
            Upload all required documents to continue
          </Text>
        )}
        <Pressable
          style={({ pressed }) => [s.nextBtn, { backgroundColor: requiredUploaded ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.push("/(onboarding)/agreement")}
          disabled={!requiredUploaded}
        >
          <Text style={[s.nextBtnText, { color: requiredUploaded ? "#fff" : colors.mutedForeground }]}>Continue</Text>
          <Feather name="arrow-right" size={18} color={requiredUploaded ? "#fff" : colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: { paddingHorizontal: 24, paddingBottom: 20 },
    backBtn: { marginBottom: 12, alignSelf: "flex-start" },
    progressRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
    progressDot: { flex: 1, height: 4, borderRadius: 2 },
    stepLabel: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 4 },
    stepTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
    stepSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
    scroll: { flex: 1 },
    docCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1.5, marginBottom: 10 },
    docIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    docLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    docStatus: { fontSize: 12, fontFamily: "Inter_400Regular" },
    footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    hint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 8 },
    nextBtn: { height: 54, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    nextBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });
