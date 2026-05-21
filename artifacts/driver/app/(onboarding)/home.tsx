import React from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import {
  useGetMyProfile,
  useGetMyDocuments,
  useGetMyAgreementSignature,
  useSubmitApplication,
} from "@workspace/api-client-react";
import { apiData } from "@/types/api";
import type { DriverProfile, DriverDocument } from "@/types/api";

const REQUIRED_DOCS = ["profile_photo", "id_document", "drivers_license", "pdp_certificate"];

function isProfileComplete(profile: DriverProfile | null): boolean {
  if (!profile) return false;
  return !!(
    profile.firstName &&
    profile.lastName &&
    profile.phone &&
    profile.city &&
    profile.province &&
    profile.streetAddress &&
    profile.bankName &&
    profile.accountNumber &&
    profile.branchCode &&
    profile.fleetType
  );
}

function areDocsComplete(docs: DriverDocument[]): boolean {
  const uploaded = docs
    .filter((d) => !d.deletedAt && d.status !== "rejected")
    .map((d) => d.documentType);
  return REQUIRED_DOCS.every((t) => uploaded.includes(t));
}

interface Step {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  route: string;
  complete: boolean;
}

export default function OnboardingHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const profileQuery = useGetMyProfile();
  const docsQuery = useGetMyDocuments();
  const sigQuery = useGetMyAgreementSignature();
  const { mutateAsync: submitApp } = useSubmitApplication();

  const profile = apiData<DriverProfile>(profileQuery.data);
  const docs = (apiData<DriverDocument[]>(docsQuery.data) ?? []).filter(Boolean);
  const signature = apiData<{ id: string } | null>(sigQuery.data);

  const isLoading = profileQuery.isLoading || docsQuery.isLoading || sigQuery.isLoading;

  const profileComplete = isProfileComplete(profile);
  const docsComplete = areDocsComplete(docs);
  const agreementComplete = !!signature && docsComplete;
  const allComplete = profileComplete && docsComplete && agreementComplete;

  const steps: Step[] = [
    {
      key: "personal",
      title: "Personal Details",
      subtitle: "Identity, contact info, address & banking",
      icon: "user",
      route: "/(onboarding)/personal",
      complete: profileComplete,
    },
    {
      key: "documents",
      title: "Document Upload",
      subtitle: "Profile photo, ID, license & PDP",
      icon: "file-text",
      route: "/(onboarding)/documents",
      complete: docsComplete,
    },
    {
      key: "agreement",
      title: "Driver Agreement",
      subtitle: "Review and sign the driver contract",
      icon: "edit-3",
      route: "/(onboarding)/agreement",
      complete: agreementComplete,
    },
  ];

  const handleSubmit = async () => {
    if (!allComplete) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await submitApp();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(onboarding)/submitted");
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const e = err as { message?: string };
      Alert.alert("Submission Failed", e?.message ?? "Please complete all steps and try again.");
    }
  };

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 20);
  const completedCount = steps.filter((s) => s.complete).length;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad }]}>
        <View style={[s.logoMark, { backgroundColor: colors.primary }]}>
          <Feather name="zap" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>Application Review</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            {completedCount} of {steps.length} sections complete · Step 7 of 7
          </Text>
        </View>
      </View>

      <View style={s.progressBarWrap}>
        <View style={[s.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              s.progressFill,
              { backgroundColor: colors.primary, width: `${(completedCount / steps.length) * 100}%` as `${number}%` },
            ]}
          />
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>REQUIRED STEPS</Text>

          {steps.map((step) => (
            <Pressable
              key={step.key}
              style={({ pressed }) => [
                s.stepCard,
                {
                  backgroundColor: colors.card,
                  borderColor: step.complete ? colors.primary + "40" : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => { Haptics.selectionAsync(); router.push(step.route as never); }}
              testID={`step-${step.key}`}
            >
              <View style={[s.stepIcon, { backgroundColor: step.complete ? colors.primary + "20" : colors.muted }]}>
                <Feather
                  name={step.complete ? "check" : step.icon}
                  size={20}
                  color={step.complete ? colors.primary : colors.mutedForeground}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.stepTitle, { color: colors.foreground }]}>{step.title}</Text>
                <Text style={[s.stepSub, { color: colors.mutedForeground }]}>{step.subtitle}</Text>
              </View>
              <View style={s.stepRight}>
                {step.complete ? (
                  <View style={[s.completeBadge, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={[s.completeText, { color: colors.primary }]}>Done</Text>
                  </View>
                ) : (
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                )}
              </View>
            </Pressable>
          ))}

          {allComplete ? (
            <View style={[s.reviewCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.reviewTitle, { color: colors.primary }]}>Ready to Submit</Text>
                <Text style={[s.reviewBody, { color: colors.foreground }]}>
                  All sections are complete. Review your details above, then submit your application for EcoRide fleet approval.
                </Text>
              </View>
            </View>
          ) : (
            <View style={[s.infoCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="info" size={16} color={colors.mutedForeground} />
              <Text style={[s.infoText, { color: colors.mutedForeground }]}>
                Complete all {steps.length} sections above to submit your application for review.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <View style={[s.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 24 : 16) }]}>
        <Pressable
          style={({ pressed }) => [
            s.submitBtn,
            {
              backgroundColor: allComplete ? colors.primary : colors.muted,
              opacity: pressed && allComplete ? 0.85 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={!allComplete}
          testID="submit-btn"
        >
          <Feather name="send" size={18} color={allComplete ? "#fff" : colors.mutedForeground} />
          <Text style={[s.submitBtnText, { color: allComplete ? "#fff" : colors.mutedForeground }]}>
            Submit Application
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: { paddingHorizontal: 24, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 14 },
    logoMark: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    title: { fontSize: 20, fontFamily: "Inter_700Bold" },
    subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
    progressBarWrap: { paddingHorizontal: 24, marginBottom: 20 },
    progressBar: { height: 6, borderRadius: 3 },
    progressFill: { height: 6, borderRadius: 3 },
    content: { paddingHorizontal: 24, gap: 10 },
    sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 4 },
    stepCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1.5 },
    stepIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    stepTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
    stepSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
    stepRight: { alignItems: "flex-end" },
    completeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    completeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 4 },
    infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
    reviewCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1.5, padding: 14, marginTop: 4 },
    reviewTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 },
    reviewBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
    footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    submitBtn: { height: 54, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
    submitBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });
