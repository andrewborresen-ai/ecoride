import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useRegisterUser } from "@workspace/api-client-react";

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const { mutateAsync: registerUser } = useRegisterUser();

  const [step, setStep] = useState<"details" | "verify">("details");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  void router;

  const handleSignUp = async () => {
    if (!isLoaded || !email || !password) return;
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await signUp!.create({ emailAddress: email, password });
      await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      const msg =
        clerkErr?.errors?.[0]?.longMessage ??
        clerkErr?.errors?.[0]?.message ??
        "Registration failed. Please try again.";
      Alert.alert("Registration Failed", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !code) return;
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await signUp!.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        try {
          await registerUser({ data: { email } });
        } catch (regErr: unknown) {
          const e = regErr as { response?: { data?: { error?: string } }; message?: string };
          const regMsg = e?.response?.data?.error ?? e?.message ?? "Profile setup failed";
          Alert.alert(
            "Account Setup Issue",
            `Your account was created but driver profile setup failed: ${regMsg}. Please contact support if this persists.`
          );
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/");
      }
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      const msg =
        clerkErr?.errors?.[0]?.longMessage ??
        clerkErr?.errors?.[0]?.message ??
        "Verification failed. Check the code and try again.";
      Alert.alert("Verification Failed", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          s.container,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 40), paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View style={[s.logoMark, { backgroundColor: colors.primary }]}>
            <Feather name="zap" size={28} color="#fff" />
          </View>
          <Text style={[s.brand, { color: colors.primary }]}>ECORIDE</Text>
          <Text style={[s.tagline, { color: colors.mutedForeground }]}>RIDE SMARTER</Text>
        </View>

        {step === "details" ? (
          <>
            <Text style={[s.title, { color: colors.foreground }]}>Become a Driver</Text>
            <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
              Create your EcoRide driver account
            </Text>
            <View style={s.form}>
              <View style={s.fieldGroup}>
                <Text style={[s.label, { color: colors.foreground }]}>Email Address</Text>
                <TextInput
                  style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="next"
                  testID="email-input"
                />
              </View>
              <View style={s.fieldGroup}>
                <Text style={[s.label, { color: colors.foreground }]}>Phone Number</Text>
                <TextInput
                  style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
                  placeholder="+27 82 000 0000"
                  placeholderTextColor={colors.mutedForeground}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  returnKeyType="next"
                  testID="phone-input"
                />
              </View>
              <View style={s.fieldGroup}>
                <Text style={[s.label, { color: colors.foreground }]}>Password</Text>
                <View style={[s.passwordRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <TextInput
                    style={[s.passwordInput, { color: colors.foreground }]}
                    placeholder="Min. 8 characters"
                    placeholderTextColor={colors.mutedForeground}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    returnKeyType="done"
                    onSubmitEditing={handleSignUp}
                    testID="password-input"
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)} style={s.eyeBtn}>
                    <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed || isLoading ? 0.85 : 1 }]}
                onPress={handleSignUp}
                disabled={isLoading || !email || !password}
                testID="create-account-btn"
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Account</Text>}
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={[s.title, { color: colors.foreground }]}>Verify Email</Text>
            <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
              We sent a 6-digit code to {email}
            </Text>
            <View style={s.form}>
              <View style={s.fieldGroup}>
                <Text style={[s.label, { color: colors.foreground }]}>Verification Code</Text>
                <TextInput
                  style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground, textAlign: "center", fontSize: 24, letterSpacing: 8 }]}
                  placeholder="000000"
                  placeholderTextColor={colors.mutedForeground}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleVerify}
                  testID="code-input"
                />
              </View>
              <Pressable
                style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed || isLoading ? 0.85 : 1 }]}
                onPress={handleVerify}
                disabled={isLoading || code.length < 6}
                testID="verify-btn"
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify & Continue</Text>}
              </Pressable>
              <Pressable onPress={() => setStep("details")} style={s.backBtn}>
                <Feather name="arrow-left" size={16} color={colors.primary} />
                <Text style={[s.backText, { color: colors.primary }]}>Change email</Text>
              </Pressable>
            </View>
          </>
        )}

        <View style={s.footer}>
          <Text style={[s.footerText, { color: colors.mutedForeground }]}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Text style={[s.footerLink, { color: colors.primary }]}>Sign In</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    container: { paddingHorizontal: 24, flexGrow: 1 },
    header: { alignItems: "center", marginBottom: 40 },
    logoMark: { width: 64, height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    brand: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: 4 },
    tagline: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 3, marginTop: 2 },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 6 },
    subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 32 },
    form: { gap: 16 },
    fieldGroup: { gap: 6 },
    label: { fontSize: 14, fontFamily: "Inter_500Medium" },
    input: { height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular" },
    passwordRow: { flexDirection: "row", alignItems: "center", height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16 },
    passwordInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
    eyeBtn: { padding: 4 },
    btn: { height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
    btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
    backBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
    backText: { fontSize: 14, fontFamily: "Inter_500Medium" },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
    footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
    footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  });
