import React, { useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Platform, ScrollView, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useGetActiveAgreement, useSignAgreement, useSubmitApplication, useGetMyProfile } from "@workspace/api-client-react";

const STEPS = ["Personal", "Address", "Banking", "Fleet", "Documents", "Agreement"];

export default function AgreementStep() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: agreementRes, isLoading: loadingAgreement } = useGetActiveAgreement();
  const { data: profileRes } = useGetMyProfile();
  const { mutateAsync: signAgreement } = useSignAgreement();
  const { mutateAsync: submitApplication } = useSubmitApplication();

  const agreement = (agreementRes as any)?.data;
  const profile = (profileRes as any)?.data;
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");

  const [legalName, setLegalName] = useState(fullName);
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!legalName || !agreed) {
      Alert.alert("Required", "Please enter your legal name and accept the agreement.");
      return;
    }
    if (!agreement) {
      Alert.alert("Error", "No active agreement found. Please contact support.");
      return;
    }
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await signAgreement({ data: { legalName } });
      await submitApplication();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(onboarding)/submitted");
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Submission Failed", err?.message ?? "Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
            <View key={i} style={[s.progressDot, { backgroundColor: colors.primary }]} />
          ))}
        </View>
        <Text style={[s.stepLabel, { color: colors.mutedForeground }]}>Step 6 of 6 · Final Step</Text>
        <Text style={[s.stepTitle, { color: colors.foreground }]}>Driver Agreement</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {loadingAgreement ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : agreement ? (
          <>
            <View style={[s.agreementBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.agreementTitle, { color: colors.foreground }]}>{agreement.title}</Text>
              <Text style={[s.agreementVersion, { color: colors.mutedForeground }]}>Version {agreement.version}</Text>
              <Text style={[s.agreementContent, { color: colors.foreground }]}>{agreement.content}</Text>
            </View>

            <View style={{ gap: 6, marginTop: 24, marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>Your Legal Full Name</Text>
              <TextInput
                style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
                placeholder="As it appears on your ID"
                placeholderTextColor={colors.mutedForeground}
                value={legalName}
                onChangeText={setLegalName}
                autoCapitalize="words"
              />
            </View>

            <Pressable style={s.checkRow} onPress={() => { setAgreed((v) => !v); Haptics.selectionAsync(); }}>
              <View style={[s.checkbox, { borderColor: agreed ? colors.primary : colors.border, backgroundColor: agreed ? colors.primary : "transparent" }]}>
                {agreed && <Feather name="check" size={12} color="#fff" />}
              </View>
              <Text style={[s.checkText, { color: colors.foreground }]}>
                I have read and agree to the EcoRide Driver Agreement and declare that all information I have provided is accurate.
              </Text>
            </Pressable>
          </>
        ) : (
          <View style={s.emptyState}>
            <Feather name="file-text" size={36} color={colors.mutedForeground} />
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No active agreement found</Text>
          </View>
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            s.submitBtn,
            { backgroundColor: agreed && legalName ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleSubmit}
          disabled={isLoading || !agreed || !legalName}
          testID="submit-btn"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="send" size={18} color={agreed && legalName ? "#fff" : colors.mutedForeground} />
              <Text style={[s.submitBtnText, { color: agreed && legalName ? "#fff" : colors.mutedForeground }]}>Submit Application</Text>
            </>
          )}
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
    scroll: { flex: 1 },
    agreementBox: { borderRadius: 14, borderWidth: 1, padding: 16 },
    agreementTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
    agreementVersion: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12 },
    agreementContent: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
    input: { height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular" },
    checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 2 },
    checkText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
    emptyState: { alignItems: "center", gap: 12, marginTop: 60 },
    emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
    footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    submitBtn: { height: 54, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
    submitBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });
