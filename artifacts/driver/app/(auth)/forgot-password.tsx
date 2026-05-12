import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

type Step = "email" | "code" | "password";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async () => {
    if (!isLoaded || !email) return;
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await signIn!.create({
        identifier: email,
        strategy: "reset_password_email_code",
      });
      setStep("code");
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      const msg =
        clerkErr?.errors?.[0]?.longMessage ??
        clerkErr?.errors?.[0]?.message ??
        "Could not send reset code. Check your email address.";
      Alert.alert("Reset Failed", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!isLoaded || !code) return;
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await signIn!.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
      });
      if (result.status === "needs_new_password") {
        setStep("password");
      }
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      const msg =
        clerkErr?.errors?.[0]?.longMessage ??
        clerkErr?.errors?.[0]?.message ??
        "Invalid code. Please check and try again.";
      Alert.alert("Verification Failed", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isLoaded || !newPassword) return;
    if (newPassword.length < 8) {
      Alert.alert("Too Short", "Password must be at least 8 characters.");
      return;
    }
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await signIn!.resetPassword({ password: newPassword });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/");
      }
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      const msg =
        clerkErr?.errors?.[0]?.longMessage ??
        clerkErr?.errors?.[0]?.message ??
        "Password reset failed. Please try again.";
      Alert.alert("Reset Failed", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 40);

  const stepConfig = {
    email: {
      title: "Forgot Password",
      subtitle: "Enter your email and we'll send you a reset code",
      action: handleSendCode,
      disabled: !email,
      actionLabel: "Send Reset Code",
    },
    code: {
      title: "Check Your Email",
      subtitle: `We sent a reset code to ${email}`,
      action: handleVerifyCode,
      disabled: code.length < 6,
      actionLabel: "Verify Code",
    },
    password: {
      title: "New Password",
      subtitle: "Choose a strong password for your account",
      action: handleResetPassword,
      disabled: newPassword.length < 8,
      actionLabel: "Reset Password",
    },
  };

  const current = stepConfig[step];

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
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <View style={[s.iconWrap, { backgroundColor: colors.primary + "20" }]}>
          <Feather name="lock" size={28} color={colors.primary} />
        </View>

        <Text style={[s.title, { color: colors.foreground }]}>{current.title}</Text>
        <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{current.subtitle}</Text>

        <View style={s.form}>
          {step === "email" && (
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
                returnKeyType="done"
                onSubmitEditing={handleSendCode}
                testID="email-input"
              />
            </View>
          )}

          {step === "code" && (
            <View style={s.fieldGroup}>
              <Text style={[s.label, { color: colors.foreground }]}>Verification Code</Text>
              <TextInput
                style={[
                  s.input,
                  { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground, textAlign: "center", fontSize: 24, letterSpacing: 8 },
                ]}
                placeholder="000000"
                placeholderTextColor={colors.mutedForeground}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerifyCode}
                testID="code-input"
              />
            </View>
          )}

          {step === "password" && (
            <View style={s.fieldGroup}>
              <Text style={[s.label, { color: colors.foreground }]}>New Password</Text>
              <View style={[s.passwordRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <TextInput
                  style={[s.passwordInput, { color: colors.foreground }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={handleResetPassword}
                  testID="password-input"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={s.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              s.btn,
              { backgroundColor: current.disabled ? colors.muted : colors.primary, opacity: pressed || isLoading ? 0.85 : 1 },
            ]}
            onPress={current.action}
            disabled={isLoading || current.disabled}
            testID="action-btn"
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[s.btnText, { color: current.disabled ? colors.mutedForeground : "#fff" }]}>
                {current.actionLabel}
              </Text>
            )}
          </Pressable>

          {step !== "email" && (
            <Pressable
              onPress={() => setStep(step === "password" ? "code" : "email")}
              style={s.changeBtn}
            >
              <Text style={[s.changeBtnText, { color: colors.primary }]}>
                {step === "code" ? "Change email address" : "Re-enter code"}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    container: { paddingHorizontal: 24, flexGrow: 1 },
    backBtn: { alignSelf: "flex-start", marginBottom: 32 },
    iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 20 },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 8 },
    subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 32, lineHeight: 22 },
    form: { gap: 16 },
    fieldGroup: { gap: 6 },
    label: { fontSize: 14, fontFamily: "Inter_500Medium" },
    input: { height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular" },
    passwordRow: { flexDirection: "row", alignItems: "center", height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16 },
    passwordInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
    eyeBtn: { padding: 4 },
    btn: { height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
    btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
    changeBtn: { alignItems: "center", paddingVertical: 8 },
    changeBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  });
