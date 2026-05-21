import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform,
  KeyboardAvoidingView,
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
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

const STEPS = ["Personal", "Address", "Banking", "Fleet", "Agreement"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 6, marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>{label}</Text>
      {children}
    </View>
  );
}

export default function AddressStep() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: profileRes } = useGetMyProfile();
  const { mutateAsync: updateProfile } = useUpdateMyProfile();
  const profile = apiData<DriverProfile>(profileRes);

  const [searchText, setSearchText] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (profile) {
      const street = toTitleCase(profile.streetAddress);
      setStreetAddress(street);
      setSearchText(street);
      setSuburb(toTitleCase(profile.suburb));
      setCity(toTitleCase(profile.city));
      setProvince(toTitleCase(profile.province));
      setPostalCode(profile.postalCode ?? "");
    }
  }, [profile?.id]);

  const handleSelectAddress = (components: { streetAddress: string; suburb: string; city: string; province: string; postalCode: string }) => {
    setStreetAddress(toTitleCase(components.streetAddress));
    setSearchText(toTitleCase(components.streetAddress));
    setSuburb(toTitleCase(components.suburb));
    setCity(toTitleCase(components.city));
    setProvince(toTitleCase(components.province));
    setPostalCode(components.postalCode);
    setErrorMsg("");
  };

  const handleNext = async () => {
    setErrorMsg("");
    const missing: string[] = [];
    if (!streetAddress) missing.push("street address");
    if (!city) missing.push("city");
    if (!province) missing.push("province");
    if (missing.length > 0) {
      setErrorMsg(`Please fill in: ${missing.join(", ")}.`);
      return;
    }
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateProfile({ data: { streetAddress, suburb: suburb || undefined, city, province, postalCode: postalCode || undefined } });
      router.push("/(onboarding)/banking");
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
            <View key={i} style={[s.progressDot, { backgroundColor: i <= 1 ? colors.primary : colors.border }]} />
          ))}
        </View>
        <Text style={[s.stepLabel, { color: colors.mutedForeground }]}>Step 2 of 6</Text>
        <Text style={[s.stepTitle, { color: colors.foreground }]}>Home Address</Text>
      </View>

      <KeyboardAwareScrollViewCompat
        style={s.scroll}
        contentContainerStyle={[s.form, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AddressAutocomplete
          label="Street Address *"
          value={searchText}
          onChangeText={(t) => { setSearchText(t); setStreetAddress(t); setErrorMsg(""); }}
          onSelectAddress={handleSelectAddress}
          placeholder="Start typing your street address…"
        />

        <Field label="Suburb">
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="Sandton"
            placeholderTextColor={colors.mutedForeground}
            value={suburb}
            onChangeText={(v) => { setSuburb(v); setErrorMsg(""); }}
            autoCapitalize="words"
          />
        </Field>

        <Field label="City *">
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="Johannesburg"
            placeholderTextColor={colors.mutedForeground}
            value={city}
            onChangeText={(v) => { setCity(v); setErrorMsg(""); }}
            autoCapitalize="words"
          />
        </Field>

        <Field label="Province *">
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="Gauteng"
            placeholderTextColor={colors.mutedForeground}
            value={province}
            onChangeText={(v) => { setProvince(v); setErrorMsg(""); }}
            autoCapitalize="words"
          />
        </Field>

        <Field label="Postal Code">
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="2001"
            placeholderTextColor={colors.mutedForeground}
            value={postalCode}
            onChangeText={(v) => { setPostalCode(v); setErrorMsg(""); }}
            keyboardType="number-pad"
          />
        </Field>
      </KeyboardAwareScrollViewCompat>

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
    scroll: { flex: 1 },
    form: { paddingHorizontal: 24, paddingTop: 8 },
    input: { height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular" },
    footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
    errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#B91C1C" },
    nextBtn: { height: 54, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });
