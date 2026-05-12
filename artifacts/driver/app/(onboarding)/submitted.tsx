import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useSignOut } from "@clerk/clerk-expo";
import { useColors } from "@/hooks/useColors";
import { useGetMyProfile } from "@workspace/api-client-react";

export default function SubmittedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useSignOut();
  const { data: profileRes } = useGetMyProfile();
  const profile = (profileRes as any)?.data;
  const isRejected = profile?.status === "rejected";
  const isSuspended = profile?.status === "suspended";

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 24);

  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.content}>
        <View style={[s.iconRing, { borderColor: isRejected || isSuspended ? colors.destructive : colors.primary }]}>
          <View style={[s.iconCircle, { backgroundColor: isRejected || isSuspended ? colors.destructive : colors.primary }]}>
            <Feather
              name={isRejected || isSuspended ? "x" : "clock"}
              size={36}
              color="#fff"
            />
          </View>
        </View>

        <Text style={[s.title, { color: colors.foreground }]}>
          {isSuspended ? "Account Suspended" : isRejected ? "Application Rejected" : "Application Submitted!"}
        </Text>

        <Text style={[s.body, { color: colors.mutedForeground }]}>
          {isSuspended
            ? "Your account has been suspended. Please contact EcoRide support for assistance."
            : isRejected
            ? profile?.rejectionReason
              ? `Your application was rejected: ${profile.rejectionReason}`
              : "Your application was not approved this time. You can update your information and reapply."
            : "Our team will review your application within 1–2 business days. You'll be notified once it's approved."}
        </Text>

        {isRejected && (
          <Pressable
            style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push("/(onboarding)/personal")}
          >
            <Feather name="edit-2" size={18} color="#fff" />
            <Text style={s.btnText}>Update & Reapply</Text>
          </Pressable>
        )}

        <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { icon: "bell" as const, text: "You'll receive a notification when your status changes" },
            { icon: "mail" as const, text: "Check your email for updates from EcoRide" },
            { icon: "phone" as const, text: "Contact support if you have questions" },
          ].map(({ icon, text }) => (
            <View key={text} style={s.infoRow}>
              <Feather name={icon} size={16} color={colors.primary} />
              <Text style={[s.infoText, { color: colors.mutedForeground }]}>{text}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [s.signOutBtn, { opacity: pressed ? 0.7 : 1 }]}
        onPress={() => signOut()}
      >
        <Feather name="log-out" size={16} color={colors.mutedForeground} />
        <Text style={[s.signOutText, { color: colors.mutedForeground }]}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1, paddingHorizontal: 24 },
    content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
    iconRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
    title: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center" },
    body: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
    btn: { flexDirection: "row", alignItems: "center", gap: 8, height: 52, paddingHorizontal: 28, borderRadius: 12, marginTop: 8 },
    btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
    infoCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12, width: "100%", marginTop: 8 },
    infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
    signOutBtn: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 12 },
    signOutText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  });
