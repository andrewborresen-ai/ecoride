import React, { useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Platform, ScrollView,
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
import { apiData } from "@/types/api";
import type { DriverDocument } from "@/types/api";

const STEPS = ["Personal", "Address", "Banking", "Fleet", "Documents", "Agreement"];

const DOCUMENT_TYPES: {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  required: boolean;
}[] = [
  { key: "profile_photo", label: "Profile Photo", icon: "camera", required: true },
  { key: "id_document", label: "SA ID Document", icon: "credit-card", required: true },
  { key: "drivers_license", label: "Driver's License", icon: "truck", required: true },
  { key: "pdp_certificate", label: "PDP Certificate", icon: "award", required: true },
  { key: "proof_of_address", label: "Proof of Address", icon: "home", required: false },
  { key: "bank_statement", label: "Bank Statement", icon: "file-text", required: false },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  "pending-review": { bg: "#DBEAFE", text: "#1D4ED8", label: "Under Review" },
  verified: { bg: "#DCFCE7", text: "#15803D", label: "Verified" },
  rejected: { bg: "#FEE2E2", text: "#B91C1C", label: "Rejected" },
};

export default function DocumentsStep() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: docsRes, refetch: refetchDocs } = useGetMyDocuments();
  const { mutateAsync: requestUploadUrl } = useRequestDocumentUploadUrl();
  const { mutateAsync: createDocument } = useCreateMyDocument();

  const allDocs: DriverDocument[] = apiData<DriverDocument[]>(docsRes) ?? [];
  const [uploading, setUploading] = useState<string | null>(null);

  const getDoc = (type: string): DriverDocument | undefined =>
    allDocs.find((d) => d.documentType === type && !d.deletedAt);

  const uploadFile = async (docType: string, uri: string, mimeType: string, fileName: string, fileSize: number) => {
    const urlRes = await requestUploadUrl({
      data: { name: fileName, size: fileSize, contentType: mimeType },
    });
    const { uploadURL, objectPath } = (apiData<{ uploadURL: string; objectPath: string }>(urlRes) ?? {
      uploadURL: (urlRes as { uploadURL?: string }).uploadURL ?? "",
      objectPath: (urlRes as { objectPath?: string }).objectPath ?? "",
    });
    const fileResponse = await fetch(uri);
    const blob = await fileResponse.blob();
    await fetch(uploadURL, { method: "PUT", body: blob, headers: { "Content-Type": mimeType } });
    await createDocument({
      data: { documentType: docType, objectPath, fileName, mimeType, fileSizeBytes: fileSize },
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await refetchDocs();
  };

  const handlePickAndUpload = async (docType: string) => {
    Alert.alert("Upload Document", "Choose a source", [
      {
        text: "Camera",
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
          if (result.canceled || !result.assets[0]) return;
          const asset = result.assets[0];
          try {
            setUploading(docType);
            await uploadFile(
              docType,
              asset.uri,
              asset.mimeType ?? "image/jpeg",
              asset.fileName ?? `${docType}.jpg`,
              asset.fileSize ?? 500_000
            );
          } catch {
            Alert.alert("Upload Failed", "Could not upload document. Please try again.");
          } finally {
            setUploading(null);
          }
        },
      },
      {
        text: "Photo Library",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
          if (result.canceled || !result.assets[0]) return;
          const asset = result.assets[0];
          try {
            setUploading(docType);
            await uploadFile(
              docType,
              asset.uri,
              asset.mimeType ?? "image/jpeg",
              asset.fileName ?? `${docType}.jpg`,
              asset.fileSize ?? 500_000
            );
          } catch {
            Alert.alert("Upload Failed", "Could not upload document. Please try again.");
          } finally {
            setUploading(null);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const requiredUploaded = DOCUMENT_TYPES.filter((d) => d.required).every((d) => {
    const doc = getDoc(d.key);
    return !!doc && doc.status !== "rejected";
  });

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
        <Text style={[s.stepSub, { color: colors.mutedForeground }]}>Clear photos of required documents</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {DOCUMENT_TYPES.map((docType) => {
          const doc = getDoc(docType.key);
          const isUploading = uploading === docType.key;
          const statusConf = doc?.status ? STATUS_COLORS[doc.status] : null;

          return (
            <Pressable
              key={docType.key}
              style={[
                s.docCard,
                {
                  borderColor:
                    doc?.status === "verified"
                      ? colors.primary
                      : doc?.status === "rejected"
                      ? colors.destructive
                      : doc
                      ? colors.border
                      : colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              onPress={() => handlePickAndUpload(docType.key)}
              disabled={isUploading}
            >
              <View
                style={[
                  s.docIcon,
                  {
                    backgroundColor:
                      doc?.status === "verified"
                        ? colors.primary + "20"
                        : doc?.status === "rejected"
                        ? colors.destructive + "15"
                        : colors.muted,
                  },
                ]}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather
                    name={doc?.status === "verified" ? "check" : doc?.status === "rejected" ? "alert-circle" : docType.icon}
                    size={20}
                    color={
                      doc?.status === "verified"
                        ? colors.primary
                        : doc?.status === "rejected"
                        ? colors.destructive
                        : colors.mutedForeground
                    }
                  />
                )}
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.docLabel, { color: colors.foreground }]}>{docType.label}</Text>
                {statusConf ? (
                  <View style={s.statusRow}>
                    <View style={[s.statusBadge, { backgroundColor: statusConf.bg }]}>
                      <Text style={[s.statusText, { color: statusConf.text }]}>{statusConf.label}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[s.docHint, { color: colors.mutedForeground }]}>
                    {docType.required ? "Required — tap to upload" : "Optional — tap to upload"}
                  </Text>
                )}
                {doc?.status === "rejected" && doc.reviewNotes ? (
                  <Text style={[s.reviewNotes, { color: colors.destructive }]} numberOfLines={2}>
                    {doc.reviewNotes}
                  </Text>
                ) : null}
                {doc?.status === "rejected" && (
                  <Text style={[s.reuploadHint, { color: colors.primary }]}>Tap to re-upload</Text>
                )}
              </View>

              {doc?.status === "verified" ? (
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
          style={({ pressed }) => [
            s.nextBtn,
            { backgroundColor: requiredUploaded ? colors.primary : colors.muted, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => router.push("/(onboarding)/agreement")}
          disabled={!requiredUploaded}
        >
          <Text style={[s.nextBtnText, { color: requiredUploaded ? "#fff" : colors.mutedForeground }]}>
            Continue
          </Text>
          <Feather name="arrow-right" size={18} color={requiredUploaded ? "#fff" : colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: { paddingHorizontal: 24, paddingBottom: 16 },
    backBtn: { marginBottom: 12, alignSelf: "flex-start" },
    progressRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
    progressDot: { flex: 1, height: 4, borderRadius: 2 },
    stepLabel: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 4 },
    stepTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
    stepSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
    scroll: { flex: 1 },
    docCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1.5, marginBottom: 10 },
    docIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    docLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    docHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
    statusRow: { flexDirection: "row", alignItems: "center" },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
    statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
    reviewNotes: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
    reuploadHint: { fontSize: 12, fontFamily: "Inter_500Medium" },
    footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    hint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 8 },
    nextBtn: { height: 54, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    nextBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });
