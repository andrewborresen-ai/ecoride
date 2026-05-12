import React, { useState, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useSignOut } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { StatusBadge } from "@/components/StatusBadge";
import { useGetMyProfile, useUpdateMyProfile } from "@workspace/api-client-react";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useSignOut();
  const { data: profileRes, refetch } = useGetMyProfile();
  const { mutateAsync: updateProfile } = useUpdateMyProfile();
  const profile = (profileRes as any)?.data;

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone ?? "");
    }
  }, [profile?.id]);

  const handleSave = async () => {
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateProfile({ data: { phone } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
      setEditing(false);
    } catch {
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setIsLoading(false);
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

  const InfoRow = ({ label, value, editable = false, field = "" }: any) => (
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
        <Text style={[s.infoValue, { color: colors.foreground }]}>{value ?? "—"}</Text>
      )}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.screenHeader, { paddingTop: topPad }]}>
        <Text style={[s.screenTitle, { color: colors.foreground }]}>Profile</Text>
        <Pressable
          onPress={() => {
            if (editing) {
              handleSave();
            } else {
              setEditing(true);
            }
          }}
          style={[s.editBtn, { borderColor: colors.border }]}
        >
          {isLoading ? (
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
          <View>
            <Text style={[s.fullName, { color: colors.foreground }]}>
              {[profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Driver"}
            </Text>
            <View style={{ marginTop: 6 }}>
              {profile?.status && <StatusBadge status={profile.status} size="sm" />}
            </View>
          </View>
        </View>

        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>PERSONAL INFO</Text>
          <InfoRow label="First Name" value={profile?.firstName} />
          <InfoRow label="Last Name" value={profile?.lastName} />
          <InfoRow label="Phone" value={profile?.phone} editable field="phone" />
          <InfoRow label="Date of Birth" value={profile?.dateOfBirth} />
          <InfoRow label="ID Number" value={profile?.idNumber} />
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
          <InfoRow label="Account" value={profile?.accountNumber ? `•••• ${profile.accountNumber.slice(-4)}` : null} />
          <InfoRow label="Type" value={profile?.accountType} />
          <InfoRow label="Branch Code" value={profile?.branchCode} />
        </View>

        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>FLEET</Text>
          <InfoRow label="Fleet Type" value={profile?.fleetType === "electric" ? "EcoRide Electric" : profile?.fleetType === "lpg" ? "Khula Rides LPG" : profile?.fleetType} />
          <InfoRow label="Bolt Driver ID" value={profile?.boltDriverId} />
        </View>

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
    avatarSection: { flexDirection: "row", alignItems: "center", gap: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
    avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
    avatarInitials: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
    fullName: { fontSize: 18, fontFamily: "Inter_700Bold" },
    section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
    sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 4 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    infoLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
    infoValue: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "right", flex: 1, marginLeft: 16 },
    infoInput: { fontSize: 13, fontFamily: "Inter_500Medium", borderBottomWidth: 1.5, paddingBottom: 2, flex: 1, marginLeft: 16, textAlign: "right" },
    signOutBtn: { height: 50, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
    signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  });
