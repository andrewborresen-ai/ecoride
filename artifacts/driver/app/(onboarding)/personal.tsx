import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
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

type Colors = ReturnType<typeof import("@/hooks/useColors").useColors>;

function Field({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  colors: Colors;
}) {
  return (
    <View style={{ gap: 6, marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>{label}</Text>
      {children}
    </View>
  );
}

export default function PersonalStep() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: profileRes } = useGetMyProfile();
  const { mutateAsync: updateProfile } = useUpdateMyProfile();
  const profile = apiData<DriverProfile>(profileRes);

  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? "");
  const [idNumber, setIdNumber] = useState(profile?.idNumber ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName ?? "");
      setLastName(profile.lastName ?? "");
      setDateOfBirth(profile.dateOfBirth ?? "");
      setIdNumber(profile.idNumber ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile?.id]);

  const handleNext = async () => {
    if (!firstName || !lastName) {
      Alert.alert("Required", "Please enter your first and last name.");
      return;
    }
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateProfile({
        data: { firstName, lastName, dateOfBirth: dateOfBirth || undefined, idNumber: idNumber || undefined, phone: phone || undefined },
      });
      router.push("/(onboarding)/address");
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
        <View style={s.progressRow}>
          {STEPS.map((step, i) => (
            <View key={step} style={[s.progressDot, { backgroundColor: i === 0 ? colors.primary : colors.border }]} />
          ))}
        </View>
        <Text style={[s.stepLabel, { color: colors.mutedForeground }]}>Step 1 of 6</Text>
        <Text style={[s.stepTitle, { color: colors.foreground }]}>Personal Info</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.form, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Field label="First Name *" colors={colors}>
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="John"
            placeholderTextColor={colors.mutedForeground}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
        </Field>

        <Field label="Last Name *" colors={colors}>
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="Doe"
            placeholderTextColor={colors.mutedForeground}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
        </Field>

        <Field label="Date of Birth" colors={colors}>
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            keyboardType="numbers-and-punctuation"
          />
        </Field>

        <Field label="SA ID Number" colors={colors}>
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="13-digit ID number"
            placeholderTextColor={colors.mutedForeground}
            value={idNumber}
            onChangeText={setIdNumber}
            keyboardType="number-pad"
            maxLength={13}
          />
        </Field>

        <Field label="Phone Number" colors={colors}>
          <TextInput
            style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="+27 82 000 0000"
            placeholderTextColor={colors.mutedForeground}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </Field>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [s.nextBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          onPress={handleNext}
          disabled={isLoading}
          testID="next-btn"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={s.nextBtnText}>Continue</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
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
    progressRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
    progressDot: { flex: 1, height: 4, borderRadius: 2 },
    stepLabel: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 4 },
    stepTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
    scroll: { flex: 1 },
    form: { paddingHorizontal: 24, paddingTop: 8 },
    input: {
      height: 52,
      borderWidth: 1.5,
      borderRadius: 12,
      paddingHorizontal: 16,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
    },
    footer: {
      paddingHorizontal: 24,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    nextBtn: {
      height: 54,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });
