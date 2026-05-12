import React, { useState, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Platform, TextInput, ScrollView,
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

type FleetType = "electric" | "lpg";

const FLEET_OPTIONS: { value: FleetType; label: string; description: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { value: "electric", label: "EcoRide Electric", description: "Zero-emission electric vehicles", icon: "zap" },
  { value: "lpg", label: "Khula Rides LPG", description: "LPG-powered vehicles", icon: "droplet" },
];

export default function FleetStep() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: profileRes } = useGetMyProfile();
  const { mutateAsync: updateProfile } = useUpdateMyProfile();
  const profile = apiData<DriverProfile>(profileRes);

  const [fleetType, setFleetType] = useState<FleetType>("electric");
  const [boltDriverId, setBoltDriverId] = useState("");
  const [boltAccepted, setBoltAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.fleetType === "electric" || profile.fleetType === "lpg") setFleetType(profile.fleetType);
      setBoltDriverId(profile.boltDriverId ?? "");
      setBoltAccepted(!!profile.boltDeclarationAccepted);
    }
  }, [profile?.id]);

  const handleNext = async () => {
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateProfile({
        data: {
          fleetType,
          boltDriverId: boltDriverId || undefined,
          boltDeclarationAccepted: boltAccepted ? new Date().toISOString() : undefined,
        },
      });
      router.push("/(onboarding)/documents");
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
            <View key={i} style={[s.progressDot, { backgroundColor: i <= 3 ? colors.primary : colors.border }]} />
          ))}
        </View>
        <Text style={[s.stepLabel, { color: colors.mutedForeground }]}>Step 4 of 6</Text>
        <Text style={[s.stepTitle, { color: colors.foreground }]}>Fleet Type</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={[s.form, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>SELECT YOUR FLEET</Text>
        {FLEET_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[s.fleetCard, { borderColor: fleetType === opt.value ? colors.primary : colors.border, backgroundColor: fleetType === opt.value ? colors.primary + "10" : colors.card }]}
            onPress={() => { setFleetType(opt.value); Haptics.selectionAsync(); }}
          >
            <View style={[s.fleetIcon, { backgroundColor: fleetType === opt.value ? colors.primary : colors.muted }]}>
              <Feather name={opt.icon} size={22} color={fleetType === opt.value ? "#fff" : colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.fleetLabel, { color: colors.foreground }]}>{opt.label}</Text>
              <Text style={[s.fleetDesc, { color: colors.mutedForeground }]}>{opt.description}</Text>
            </View>
            {fleetType === opt.value && <Feather name="check-circle" size={20} color={colors.primary} />}
          </Pressable>
        ))}

        <Text style={[s.sectionLabel, { color: colors.mutedForeground, marginTop: 24 }]}>BOLT DRIVER INFO</Text>

        <View style={{ gap: 6, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>Bolt Driver ID</Text>
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="Your Bolt driver identifier"
            placeholderTextColor={colors.mutedForeground}
            value={boltDriverId}
            onChangeText={setBoltDriverId}
            autoCapitalize="none"
          />
        </View>

        <Pressable
          style={s.checkRow}
          onPress={() => { setBoltAccepted((v) => !v); Haptics.selectionAsync(); }}
        >
          <View style={[s.checkbox, { borderColor: boltAccepted ? colors.primary : colors.border, backgroundColor: boltAccepted ? colors.primary : "transparent" }]}>
            {boltAccepted && <Feather name="check" size={12} color="#fff" />}
          </View>
          <Text style={[s.checkText, { color: colors.foreground }]}>
            I agree to the Bolt driver declaration and terms
          </Text>
        </Pressable>
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
    sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 12 },
    fleetCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1.5, marginBottom: 10 },
    fleetIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    fleetLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    fleetDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },
    input: { height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular" },
    checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 2 },
    checkText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
    footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    nextBtn: { height: 54, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });
