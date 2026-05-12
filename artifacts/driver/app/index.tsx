import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useColors } from "@/hooks/useColors";
import { useDriver } from "@/contexts/DriverContext";

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
      router.replace("/(onboarding)/personal");
      return;
    }

    const status: string = profile.status ?? "incomplete";

    if (status === "approved") {
      router.replace("/(tabs)");
    } else if (status === "pending") {
      router.replace("/(onboarding)/submitted");
    } else if (status === "suspended") {
      router.replace("/(onboarding)/submitted");
    } else {
      router.replace("/(onboarding)/personal");
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
