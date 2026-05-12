import React, { useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Platform, ScrollView, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import {
  useGetActiveAgreement,
  useSignAgreement,
  useGetMyProfile,
} from "@workspace/api-client-react";
import { apiData } from "@/types/api";
import type { Agreement, DriverProfile } from "@/types/api";

const STEPS = ["Personal", "Address", "Banking", "Fleet", "Documents", "Agreement"];

function formatDateTime(date: Date) {
  return date.toLocaleDateString("en-ZA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AgreementStep() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: agreementRes, isLoading: loadingAgreement } = useGetActiveAgreement();
  const { data: profileRes } = useGetMyProfile();
  const { mutateAsync: signAgreement } = useSignAgreement();

  const agreement = apiData<Agreement>(agreementRes);
  const profile = apiData<DriverProfile>(profileRes);

  const defaultName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  const [legalName, setLegalName] = useState(defaultName);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const signatureTimestamp = new Date();

  const handleSign = async () => {
    if (!legalName || !accepted) {
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push("/(onboarding)/home");
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const e = err as { message?: string };
      Alert.alert("Signature Failed", e?.message ?? "Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const canSign = scrolledToBottom && legalName.trim().length > 0 && accepted;

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

      {loadingAgreement ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : agreement ? (
        <>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
            showsVerticalScrollIndicator
            onMomentumScrollEnd={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
              if (isBottom) setScrolledToBottom(true);
            }}
            onScrollEndDrag={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
              if (isBottom) setScrolledToBottom(true);
            }}
          >
            <View style={[s.agreementBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.agreementTitle, { color: colors.foreground }]}>{agreement.title}</Text>
              <Text style={[s.agreementMeta, { color: colors.mutedForeground }]}>
                Version {agreement.version}
                {agreement.effectiveDate
                  ? ` · Effective ${new Date(agreement.effectiveDate).toLocaleDateString("en-ZA")}`
                  : ""}
              </Text>
              <Text style={[s.agreementContent, { color: colors.foreground }]}>
                {agreement.content}
              </Text>
            </View>

            {!scrolledToBottom && (
              <View style={[s.scrollHint, { backgroundColor: colors.muted }]}>
                <Feather name="chevrons-down" size={16} color={colors.mutedForeground} />
                <Text style={[s.scrollHintText, { color: colors.mutedForeground }]}>
                  Scroll to the bottom to enable signing
                </Text>
              </View>
            )}

            <View style={{ gap: 6, marginTop: 20 }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>
                Your Legal Full Name
              </Text>
              <TextInput
                style={[
                  s.input,
                  {
                    borderColor: scrolledToBottom ? colors.border : colors.input,
                    backgroundColor: colors.card,
                    color: colors.foreground,
                    opacity: scrolledToBottom ? 1 : 0.5,
                  },
                ]}
                placeholder="As it appears on your SA ID"
                placeholderTextColor={colors.mutedForeground}
                value={legalName}
                onChangeText={setLegalName}
                autoCapitalize="words"
                editable={scrolledToBottom}
              />
            </View>

            <Pressable
              style={[s.checkRow, { opacity: scrolledToBottom ? 1 : 0.5 }]}
              onPress={() => { if (scrolledToBottom) { setAccepted((v) => !v); Haptics.selectionAsync(); } }}
              disabled={!scrolledToBottom}
            >
              <View style={[s.checkbox, { borderColor: accepted ? colors.primary : colors.border, backgroundColor: accepted ? colors.primary : "transparent" }]}>
                {accepted && <Feather name="check" size={12} color="#fff" />}
              </View>
              <Text style={[s.checkText, { color: colors.foreground }]}>
                I have read the full agreement and agree to be bound by its terms
              </Text>
            </Pressable>

            {accepted && legalName.trim() && (
              <View style={[s.signaturePreview, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="edit-3" size={14} color={colors.primary} />
                <Text style={[s.sigPreviewText, { color: colors.foreground }]}>
                  Signed electronically as{" "}
                  <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>
                    {legalName.trim()}
                  </Text>{"\n"}
                  <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 11 }}>
                    {formatDateTime(signatureTimestamp)} · Version {agreement.version}
                  </Text>
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable
              style={({ pressed }) => [
                s.signBtn,
                { backgroundColor: canSign ? colors.primary : colors.muted, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleSign}
              disabled={isLoading || !canSign}
              testID="sign-btn"
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="edit-3" size={18} color={canSign ? "#fff" : colors.mutedForeground} />
                  <Text style={[s.signBtnText, { color: canSign ? "#fff" : colors.mutedForeground }]}>
                    Sign Agreement
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </>
      ) : (
        <View style={s.emptyState}>
          <Feather name="file-text" size={36} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No active agreement found</Text>
          <Text style={[s.emptyBody, { color: colors.mutedForeground }]}>Please contact EcoRide support</Text>
        </View>
      )}
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
    scroll: { flex: 1 },
    agreementBox: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
    agreementTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
    agreementMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12 },
    agreementContent: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
    scrollHint: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, marginBottom: 8 },
    scrollHintText: { fontSize: 13, fontFamily: "Inter_400Regular" },
    input: { height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular" },
    checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 16 },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 2 },
    checkText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
    signaturePreview: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 16 },
    sigPreviewText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
    footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    signBtn: { height: 54, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
    signBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
    emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
    emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular" },
  });
