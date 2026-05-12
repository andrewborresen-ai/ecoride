import React, { useState, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useClerk } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useGetMyProfile,
  useUpdateMyProfile,
  useGetMyDocuments,
  useRequestDocumentUploadUrl,
  useCreateMyDocument,
} from "@workspace/api-client-react";
import { apiData } from "@/types/api";
import type { DriverProfile, DriverDocument } from "@/types/api";

const DOC_LABELS: Record<string, string> = {
  profile_photo: "Profile Photo",
  id_document: "SA ID Document",
  drivers_license: "Driver's License",
  pdp_certificate: "PDP Certificate",
  proof_of_address: "Proof of Address",
  bank_statement: "Bank Statement",
};

function TelematicsSyncBadge({ status, colors }: {
  status: string | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const conf: Record<string, { label: string; color: string }> = {
    synced: { label: "Synced", color: colors.success },
    pending: { label: "Pending Sync", color: colors.warning },
    failed: { label: "Sync Failed", color: colors.destructive },
  };
  const c = status ? (conf[status] ?? { label: status, color: colors.mutedForeground }) : null;
  if (!c) return <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium" }}>—</Text>;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.color }} />
      <Text style={{ color: c.color, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{c.label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useClerk();
  const { data: profileRes, refetch: refetchProfile } = useGetMyProfile();
  const { data: docsRes, refetch: refetchDocs } = useGetMyDocuments();
  const { mutateAsync: updateProfile } = useUpdateMyProfile();
  const { mutateAsync: requestUploadUrl } = useRequestDocumentUploadUrl();
  const { mutateAsync: createDocument } = useCreateMyDocument();

  const profile = apiData<DriverProfile>(profileRes);
  const allDocs: DriverDocument[] = apiData<DriverDocument[]>(docsRes) ?? [];
  const rejectedDocs = allDocs.filter((d) => d.status === "rejected" && !d.deletedAt);

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [reuploadingDoc, setReuploadingDoc] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setPhone(profile.phone ?? "");
  }, [profile?.id]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateProfile({ data: { phone } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchProfile();
      setEditing(false);
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert("Update Failed", e?.message ?? "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReupload = async (docType: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      setReuploadingDoc(docType);
      const urlRes = await requestUploadUrl({
        data: { name: asset.fileName ?? `${docType}.jpg`, size: asset.fileSize ?? 500_000, contentType: asset.mimeType ?? "image/jpeg" },
      });
      const uploadData = apiData<{ uploadURL: string; objectPath: string }>(urlRes) ??
        { uploadURL: (urlRes as { uploadURL?: string }).uploadURL ?? "", objectPath: (urlRes as { objectPath?: string }).objectPath ?? "" };
      const fileBlob = await (await fetch(asset.uri)).blob();
      await fetch(uploadData.uploadURL, { method: "PUT", body: fileBlob, headers: { "Content-Type": asset.mimeType ?? "image/jpeg" } });
      await createDocument({
        data: {
          documentType: docType,
          objectPath: uploadData.objectPath,
          fileName: asset.fileName ?? `${docType}.jpg`,
          mimeType: asset.mimeType ?? "image/jpeg",
          fileSizeBytes: asset.fileSize ?? 500_000,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchDocs();
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert("Upload Failed", e?.message ?? "Could not re-upload document.");
    } finally {
      setReuploadingDoc(null);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const InfoRow = ({ label, value, editable = false }: { label: string; value?: string | null; editable?: boolean }) => (
    <View style={s.infoRow}>
      <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {editing && editable ? (
        <TextInput
          style={[s.infoInput, { color: colors.foreground, borderBottomColor: colors.primary }]}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCapitalize="none"
        />
      ) : (
        <Text style={[s.infoValue, { color: colors.foreground }]} numberOfLines={1}>{value ?? "—"}</Text>
      )}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.screenHeader, { paddingTop: topPad }]}>
        <Text style={[s.screenTitle, { color: colors.foreground }]}>Profile</Text>
        <Pressable
          onPress={() => { if (editing) handleSave(); else setEditing(true); }}
          style={[s.editBtn, { borderColor: colors.border }]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name={editing ? "check" : "edit-2"} size={18} color={editing ? colors.primary : colors.foreground} />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.avatarSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.avatar, { backgroundColor: colors.primary }]}>
            <Text style={s.avatarInitials}>
              {[profile?.firstName?.[0], profile?.lastName?.[0]].filter(Boolean).join("") || "?"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.fullName, { color: colors.foreground }]}>
              {[profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Driver"}
            </Text>
            {profile?.email ? (
              <Text style={[s.email, { color: colors.mutedForeground }]}>{profile.email}</Text>
            ) : null}
            <View style={{ marginTop: 8 }}>
              {profile?.status && <StatusBadge status={profile.status} size="sm" />}
            </View>
          </View>
        </View>

        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>PERSONAL INFO</Text>
          <InfoRow label="First Name" value={profile?.firstName} />
          <InfoRow label="Last Name" value={profile?.lastName} />
          <InfoRow label="Phone" value={profile?.phone} editable />
          <InfoRow label="Date of Birth" value={profile?.dateOfBirth} />
          <InfoRow label="SA ID Number" value={profile?.idNumber} />
        </View>

        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>ADDRESS</Text>
          <InfoRow label="Street" value={profile?.streetAddress} />
          <InfoRow label="Suburb" value={profile?.suburb} />
          <InfoRow label="City" value={profile?.city} />
          <InfoRow label="Province" value={profile?.province} />
          <InfoRow label="Postal Code" value={profile?.postalCode} />
        </View>

        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>BANKING</Text>
          <InfoRow label="Bank" value={profile?.bankName} />
          <InfoRow
            label="Account"
            value={profile?.accountNumber ? `•••• ${profile.accountNumber.slice(-4)}` : null}
          />
          <InfoRow label="Account Type" value={profile?.accountType} />
          <InfoRow label="Branch Code" value={profile?.branchCode} />
        </View>

        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>FLEET</Text>
          <InfoRow
            label="Fleet Type"
            value={profile?.fleetType === "electric" ? "EcoRide Electric" : profile?.fleetType === "lpg" ? "Khula Rides LPG" : profile?.fleetType}
          />
          <InfoRow label="Bolt Driver ID" value={profile?.boltDriverId} />
        </View>

        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>TELEMATICS</Text>
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Registered</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Feather
                name={profile?.telematicsRegistered ? "check-circle" : "x-circle"}
                size={15}
                color={profile?.telematicsRegistered ? colors.success : colors.mutedForeground}
              />
              <Text style={[s.infoValue, { color: colors.foreground, flex: 0 }]}>
                {profile?.telematicsRegistered ? "Yes" : "No"}
              </Text>
            </View>
          </View>
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Sync Status</Text>
            <TelematicsSyncBadge status={profile?.telematicsSyncStatus ?? null} colors={colors} />
          </View>
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Last Sync</Text>
            <Text style={[s.infoValue, { color: colors.foreground }]}>
              {profile?.telematicsLastSyncAt
                ? new Date(profile.telematicsLastSyncAt).toLocaleDateString("en-ZA", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })
                : "Never"}
            </Text>
          </View>
        </View>

        {rejectedDocs.length > 0 && (
          <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.destructive + "40" }]}>
            <View style={s.docsHeaderRow}>
              <Text style={[s.sectionTitle, { color: colors.destructive }]}>REJECTED DOCUMENTS</Text>
              <View style={[s.rejBadge, { backgroundColor: colors.destructive + "15" }]}>
                <Text style={[s.rejBadgeText, { color: colors.destructive }]}>{rejectedDocs.length} need re-upload</Text>
              </View>
            </View>
            {rejectedDocs.map((doc) => (
              <View key={doc.id} style={[s.docRow, { borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.docLabel, { color: colors.foreground }]}>
                    {DOC_LABELS[doc.documentType] ?? doc.documentType}
                  </Text>
                  {doc.reviewNotes ? (
                    <Text style={[s.docNotes, { color: colors.destructive }]}>{doc.reviewNotes}</Text>
                  ) : null}
                </View>
                <Pressable
                  style={({ pressed }) => [
                    s.reuploadBtn,
                    { borderColor: colors.primary, opacity: pressed ? 0.75 : 1 },
                  ]}
                  onPress={() => handleReupload(doc.documentType)}
                  disabled={reuploadingDoc === doc.documentType}
                >
                  {reuploadingDoc === doc.documentType ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Feather name="upload" size={13} color={colors.primary} />
                      <Text style={[s.reuploadBtnText, { color: colors.primary }]}>Re-upload</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [s.signOutBtn, { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 }]}
          onPress={handleSignOut}
          testID="sign-out-btn"
        >
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text style={[s.signOutText, { color: colors.destructive }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    screenHeader: { paddingHorizontal: 20, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    screenTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
    editBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    content: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
    avatarSection: { flexDirection: "row", alignItems: "flex-start", gap: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
    avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
    avatarInitials: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
    fullName: { fontSize: 18, fontFamily: "Inter_700Bold" },
    email: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
    section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
    sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 4 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    infoLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
    infoValue: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "right", flex: 1, marginLeft: 16 },
    infoInput: { fontSize: 13, fontFamily: "Inter_500Medium", borderBottomWidth: 1.5, paddingBottom: 2, flex: 1, marginLeft: 16, textAlign: "right" },
    docsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    rejBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    rejBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
    docRow: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, paddingTop: 10 },
    docLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    docNotes: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
    reuploadBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1.5 },
    reuploadBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    signOutBtn: { height: 50, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
    signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  });
