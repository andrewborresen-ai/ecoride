import React from "react";
import { View, Text, Pressable, StyleSheet, Platform, Linking, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useSignOut } from "@clerk/clerk-expo";
import { useColors } from "@/hooks/useColors";
import { StatusBadge } from "@/components/StatusBadge";
import { useGetMyProfile } from "@workspace/api-client-react";
import { apiData } from "@/types/api";
import type { DriverProfile } from "@/types/api";

const SUPPORT_EMAIL = "support@ecoride.co.za";

export default function AccountStatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useSignOut();
  const { data: profileRes, isLoading } = useGetMyProfile();
  const profile = apiData<DriverProfile>(profileRes);

  const status = profile?.status ?? "pending";
  const isRejected = status === "rejected";
  const isSuspended = status === "suspended";
  const isPending = status === "pending";

  const iconName: React.ComponentProps<typeof Feather>["name"] = isSuspended || isRejected ? "x-circle" : "clock";
  const iconColor = isSuspended || isRejected ? colors.destructive : colors.primary;
  const iconBg = isSuspended || isRejected ? colors.destructive + "15" : colors.primary + "15";

  const title = isSuspended
    ? "Account Suspended"
    : isRejected
    ? "Application Not Approved"
    : "Application Under Review";

  const body = isSuspended
    ? "Your driver account has been suspended. Please contact EcoRide support for further assistance and to understand next steps."
    : isRejected
    ? profile?.rejectionReason
      ? `Your application was not approved. Reason: ${profile.rejectionReason}`
      : "Your application was not approved at this time. You can update your information and reapply."
    : "Your application has been submitted and is being reviewed by our team. This typically takes 1–2 business days.";

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 24);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: topPad, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
          <Feather name={iconName} size={40} color={iconColor} />
        </View>

        <View style={s.statusRow}>
          {profile?.status && <StatusBadge status={profile.status} size="md" />}
        </View>

        <Text style={[s.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[s.body, { color: colors.mutedForeground }]}>{body}</Text>

        {isRejected && (
          <Pressable
            style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push("/(onboarding)/index")}
          >
            <Feather name="edit-2" size={18} color="#fff" />
            <Text style={s.primaryBtnText}>Update & Reapply</Text>
          </Pressable>
        )}

        <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.infoCardTitle, { color: colors.mutedForeground }]}>WHAT TO EXPECT</Text>
          {isPending && (
            <InfoRow icon="mail" text="You'll receive an email once your application is reviewed" colors={colors} />
          )}
          <InfoRow icon="bell" text="Check your notifications tab for status updates" colors={colors} />
          <InfoRow icon="phone" text="Contact our support team if you have questions" colors={colors} />
        </View>

        <Pressable
          style={({ pressed }) => [s.supportBtn, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Driver Application - ${profile?.id ?? ""}`)}
        >
          <Feather name="mail" size={16} color={colors.primary} />
          <Text style={[s.supportBtnText, { color: colors.primary }]}>Contact Support</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [s.signOutBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => signOut()}
          testID="sign-out-btn"
        >
          <Feather name="log-out" size={16} color={colors.mutedForeground} />
          <Text style={[s.signOutText, { color: colors.mutedForeground }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, text, colors }: { icon: React.ComponentProps<typeof Feather>["name"]; text: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <Feather name={icon} size={15} color={colors.primary} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 18 }}>
        {text}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    content: { paddingHorizontal: 24, alignItems: "center", gap: 16 },
    iconWrap: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    statusRow: { alignItems: "center" },
    title: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center" },
    body: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
    primaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, height: 52, paddingHorizontal: 28, borderRadius: 12 },
    primaryBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
    infoCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12, width: "100%" },
    infoCardTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
    supportBtn: { flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1.5 },
    supportBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    signOutBtn: { flexDirection: "row", alignItems: "center", gap: 8 },
    signOutText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  });
