import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [step, setStep] = useState<"credentials" | "verify">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSignIn = async () => {
    setErrorMsg("");

    if (!email.trim() || !password) {
      setErrorMsg("Please enter your email and password.");
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
      return;
    }

    if (!isLoaded || !signIn) {
      setErrorMsg("Still loading — please wait a moment and try again.");
      return;
    }

    setIsLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    try {
      const result = await signIn.create({
        identifier: email.trim(),
        strategy: "password",
        password,
      });

      if (result.status === "complete") {
        if (!result.createdSessionId) throw new Error("No session created");
        await setActive({ session: result.createdSessionId });
        router.replace("/");
        return;
      }

      if (result.status === "needs_second_factor") {
        const prepareFn = (signIn as unknown as Record<string, unknown>).prepareSecondFactor;
        if (typeof prepareFn === "function") {
          await (prepareFn as (arg: unknown) => Promise<unknown>).call(signIn, { strategy: "email_code" });
          setStep("verify");
        } else {
          setErrorMsg(
            "Email verification is required to sign in. Please use 'Forgot password?' to reset and access your account."
          );
        }
        return;
      }

      setErrorMsg(`Sign in failed (${result.status}). Please try again or contact support.`);
    } catch (err: unknown) {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      const msg =
        clerkErr?.errors?.[0]?.longMessage ??
        clerkErr?.errors?.[0]?.message ??
        (err instanceof Error ? err.message : null) ??
        "Sign in failed. Please check your credentials.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!isLoaded || !signIn || !code) return;
    setErrorMsg("");
    setIsLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    try {
      const attemptFn = (signIn as unknown as Record<string, unknown>).attemptSecondFactor;
      if (typeof attemptFn !== "function") {
        setErrorMsg("Verification is not available. Please use 'Forgot password?' to sign in.");
        return;
      }
      const result = await (attemptFn as (arg: unknown) => Promise<{ status: string; createdSessionId: string | null }>).call(
        signIn,
        { strategy: "email_code", code }
      );
      if (result.status === "complete") {
        if (!result.createdSessionId) throw new Error("No session created");
        await setActive({ session: result.createdSessionId });
        router.replace("/");
      } else {
        setErrorMsg("Verification failed. Please try again.");
      }
    } catch (err: unknown) {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      const msg =
        clerkErr?.errors?.[0]?.longMessage ??
        clerkErr?.errors?.[0]?.message ??
        (err instanceof Error ? err.message : null) ??
        "Invalid code. Please try again.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 40);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: topPad, paddingBottom: insets.bottom + 24 }]}
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

        {step === "credentials" ? (
          <>
            <Text style={[s.title, { color: colors.foreground }]}>Welcome back</Text>
            <Text style={[s.subtitle, { color: colors.mutedForeground }]}>Sign in to your driver account</Text>

            <View style={s.form}>
              <View style={s.fieldGroup}>
                <Text style={[s.label, { color: colors.foreground }]}>Email</Text>
                <TextInput
                  style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
                  placeholder="driver@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setErrorMsg(""); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="next"
                  testID="email-input"
                />
              </View>

              <View style={s.fieldGroup}>
                <View style={s.labelRow}>
                  <Text style={[s.label, { color: colors.foreground }]}>Password</Text>
                  <Link href="/(auth)/forgot-password" asChild>
                    <Pressable>
                      <Text style={[s.forgotLink, { color: colors.primary }]}>Forgot password?</Text>
                    </Pressable>
                  </Link>
                </View>
                <View style={[s.passwordRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <TextInput
                    style={[s.passwordInput, { color: colors.foreground }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.mutedForeground}
                    value={password}
                    onChangeText={(v) => { setPassword(v); setErrorMsg(""); }}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    returnKeyType="done"
                    onSubmitEditing={handleSignIn}
                    testID="password-input"
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)} style={s.eyeBtn}>
                    <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              </View>

              {!!errorMsg && (
                <View style={[s.errorBox, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
                  <Feather name="alert-circle" size={14} color="#B91C1C" />
                  <Text style={s.errorText}>{errorMsg}</Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed || isLoading ? 0.85 : 1 }]}
                onPress={handleSignIn}
                disabled={isLoading}
                testID="sign-in-btn"
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign In</Text>}
              </Pressable>
            </View>

            <View style={s.footer}>
              <Text style={[s.footerText, { color: colors.mutedForeground }]}>Don't have an account? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable>
                  <Text style={[s.footerLink, { color: colors.primary }]}>Register as Driver</Text>
                </Pressable>
              </Link>
            </View>
          </>
        ) : (
          <>
            <Text style={[s.title, { color: colors.foreground }]}>Verify your email</Text>
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
                  onChangeText={(v) => { setCode(v); setErrorMsg(""); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyCode}
                  testID="code-input"
                />
              </View>

              {!!errorMsg && (
                <View style={[s.errorBox, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
                  <Feather name="alert-circle" size={14} color="#B91C1C" />
                  <Text style={s.errorText}>{errorMsg}</Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed || isLoading ? 0.85 : 1 }]}
                onPress={handleVerifyCode}
                disabled={isLoading || code.length < 6}
                testID="verify-btn"
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify & Sign In</Text>}
              </Pressable>

              <Pressable onPress={() => { setStep("credentials"); setCode(""); setErrorMsg(""); }} style={s.backBtn}>
                <Feather name="arrow-left" size={16} color={colors.primary} />
                <Text style={[s.backText, { color: colors.primary }]}>Back</Text>
              </Pressable>
            </View>
          </>
        )}
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
    labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    label: { fontSize: 14, fontFamily: "Inter_500Medium" },
    forgotLink: { fontSize: 13, fontFamily: "Inter_500Medium" },
    input: { height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular" },
    passwordRow: { flexDirection: "row", alignItems: "center", height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16 },
    passwordInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
    eyeBtn: { padding: 4 },
    errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
    errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#B91C1C" },
    btn: { height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
    btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
    backBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
    backText: { fontSize: 14, fontFamily: "Inter_500Medium" },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
    footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
    footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  });
