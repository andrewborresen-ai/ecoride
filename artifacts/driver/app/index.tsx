import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useColors } from "@/hooks/useColors";
import { useDriver } from "@/contexts/DriverContext";
import type { ProfileStatus } from "@/types/api";

export default function IndexScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { profile, isLoading } = useDriver();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.replace("/(auth)/sign-in");
      return;
    }

    if (isLoading) return;

    if (!profile) {
      router.replace("/(onboarding)/index");
      return;
    }

    const status: ProfileStatus = profile.status ?? "incomplete";

    if (status === "approved") {
      router.replace("/(tabs)");
    } else if (status === "pending" || status === "rejected" || status === "suspended") {
      router.replace("/(onboarding)/submitted");
    } else {
      router.replace("/(onboarding)/index");
    }
  }, [isLoaded, isSignedIn, isLoading, profile]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
});
