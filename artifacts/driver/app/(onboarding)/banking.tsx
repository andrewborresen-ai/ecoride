import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useGetMyProfile, useUpdateMyProfile } from "@workspace/api-client-react";
import { toTitleCase } from "@/utils/text";
import { apiData } from "@/types/api";
import type { DriverProfile } from "@/types/api";

const STEPS = ["Personal", "Address", "Banking", "Fleet", "Documents", "Agreement"];
const ACCOUNT_TYPES = ["Cheque", "Savings", "Transmission"];

export default function BankingStep() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: profileRes } = useGetMyProfile();
  const { mutateAsync: updateProfile } = useUpdateMyProfile();
  const profile = apiData<DriverProfile>(profileRes);

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("Cheque");
  const [branchCode, setBranchCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (profile) {
      setBankName(toTitleCase(profile.bankName));
      setAccountNumber(profile.accountNumber ?? "");
      setAccountType(profile.accountType ?? "Cheque");
      setBranchCode(profile.branchCode ?? "");
    }
  }, [profile?.id]);

  const handleNext = async () => {
    setErrorMsg("");
    if (!bankName || !accountNumber || !branchCode) {
      setErrorMsg("Please complete bank name, account number and branch code.");
      return;
    }
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateProfile({ data: { bankName, accountNumber, accountType, branchCode } });
      router.push("/(onboarding)/fleet");
    } catch {
      setErrorMsg("Failed to save. Please try again.");
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
            <View key={i} style={[s.progressDot, { backgroundColor: i <= 2 ? colors.primary : colors.border }]} />
          ))}
        </View>
        <Text style={[s.stepLabel, { color: colors.mutedForeground }]}>Step 3 of 6</Text>
        <Text style={[s.stepTitle, { color: colors.foreground }]}>Banking Details</Text>
        <Text style={[s.stepSub, { color: colors.mutedForeground }]}>
          For earnings payments
        </Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={[s.form, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ gap: 6, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>Bank Name *</Text>
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="e.g. FNB, Standard Bank, ABSA"
            placeholderTextColor={colors.mutedForeground}
            value={bankName}
            onChangeText={(v) => { setBankName(v); setErrorMsg(""); }}
            autoCapitalize="words"
          />
        </View>

        <View style={{ gap: 6, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>Account Number *</Text>
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="Your bank account number"
            placeholderTextColor={colors.mutedForeground}
            value={accountNumber}
            onChangeText={(v) => { setAccountNumber(v); setErrorMsg(""); }}
            keyboardType="number-pad"
          />
        </View>

        <View style={{ gap: 6, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>Account Type</Text>
          <View style={s.typeRow}>
            {ACCOUNT_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[s.typeBtn, { borderColor: accountType === t ? colors.primary : colors.border, backgroundColor: accountType === t ? colors.primary + "15" : colors.card }]}
                onPress={() => setAccountType(t)}
              >
                <Text style={[s.typeText, { color: accountType === t ? colors.primary : colors.mutedForeground }]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 6, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>Branch Code *</Text>
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="6-digit branch code"
            placeholderTextColor={colors.mutedForeground}
            value={branchCode}
            onChangeText={(v) => { setBranchCode(v); setErrorMsg(""); }}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 24 : 16) }]}>
        {!!errorMsg && (
          <View style={[s.errorBox, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
            <Feather name="alert-circle" size={14} color="#B91C1C" />
            <Text style={s.errorText}>{errorMsg}</Text>
          </View>
        )}
        <Pressable style={({ pressed }) => [s.nextBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]} onPress={handleNext} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <><Text style={s.nextBtnText}>Continue</Text><Feather name="arrow-right" size={18} color="#fff" /></>}
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
    form: { paddingHorizontal: 24, paddingTop: 8 },
    input: { height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular" },
    typeRow: { flexDirection: "row", gap: 8 },
    typeBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
    typeText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
    errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#B91C1C" },
    nextBtn: { height: 54, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });
