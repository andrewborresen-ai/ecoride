import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useGetMyProfile, useUpdateMyProfile } from "@workspace/api-client-react";
import { apiData } from "@/types/api";
import type { DriverProfile } from "@/types/api";

const STEPS = ["Personal", "Address", "Banking", "Fleet", "Documents", "Agreement"];

export default function AddressStep() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: profileRes } = useGetMyProfile();
  const { mutateAsync: updateProfile } = useUpdateMyProfile();
  const profile = apiData<DriverProfile>(profileRes);

  const [streetAddress, setStreetAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setStreetAddress(profile.streetAddress ?? "");
      setSuburb(profile.suburb ?? "");
      setCity(profile.city ?? "");
      setProvince(profile.province ?? "");
      setPostalCode(profile.postalCode ?? "");
    }
  }, [profile?.id]);

  const handleNext = async () => {
    if (!streetAddress || !city || !province) {
      Alert.alert("Required", "Please enter your street address, city and province.");
      return;
    }
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateProfile({ data: { streetAddress, suburb: suburb || undefined, city, province, postalCode: postalCode || undefined } });
      router.push("/(onboarding)/banking");
    } catch {
      Alert.alert("Error", "Failed to save. Please try again.");
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

      <ScrollView style={s.scroll} contentContainerStyle={[s.form, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {(
          [
            { label: "Street Address *", value: streetAddress, onChange: setStreetAddress, placeholder: "123 Main Street" },
            { label: "Suburb", value: suburb, onChange: setSuburb, placeholder: "Sandton" },
            { label: "City *", value: city, onChange: setCity, placeholder: "Johannesburg" },
            { label: "Province *", value: province, onChange: setProvince, placeholder: "Gauteng" },
            { label: "Postal Code", value: postalCode, onChange: setPostalCode, placeholder: "2001", keyboard: "number-pad" as const },
          ] as { label: string; value: string; onChange: (v: string) => void; placeholder: string; keyboard?: "number-pad" }[]
        ).map(({ label, value, onChange, placeholder, keyboard }) => (
          <View key={label} style={{ gap: 6, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>{label}</Text>
            <TextInput
              style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
              placeholder={placeholder}
              placeholderTextColor={colors.mutedForeground}
              value={value}
              onChangeText={onChange}
              keyboardType={keyboard ?? "default"}
              autoCapitalize="words"
            />
          </View>
        ))}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 24 : 16) }]}>
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
    nextBtn: { height: 54, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });
