import React, { useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, Alert, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useDriver } from "@/contexts/DriverContext";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useGetDriverDashboardSummary,
  useRequestVehicleUnlock,
} from "@workspace/api-client-react";
import { apiData } from "@/types/api";
import type { DashboardSummary, Notification } from "@/types/api";

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile: driverProfile } = useDriver();
  const { data: summaryRes, isLoading, refetch } = useGetDriverDashboardSummary();
  const { mutateAsync: requestUnlock } = useRequestVehicleUnlock();

  const [refreshing, setRefreshing] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockResult, setUnlockResult] = useState<{
    success: boolean; message: string; at: string;
  } | null>(null);

  const summary = apiData<DashboardSummary>(summaryRes);
  const profile = summary?.profile ?? driverProfile;
  const vehicleAssignment = summary?.activeVehicleAssignment;
  const nextShift = summary?.nextShift;
  const weeklyEarnings: number = summary?.weeklyEarningsCents ?? 0;
  const shiftsThisWeek: number = summary?.shiftsThisWeek ?? 0;
  const unreadCount: number = summary?.unreadNotificationsCount ?? 0;
  const latestNotifs: Notification[] = summary?.latestNotifications ?? [];

  const now = new Date();
  const shiftStarted = nextShift?.shift?.startTime
    ? new Date(nextShift.shift.startTime) <= now : false;
  const shiftEnded = nextShift?.shift?.endTime
    ? new Date(nextShift.shift.endTime) < now : false;
  const hasAssignment = !!vehicleAssignment;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleUnlock = () => {
    if (!vehicleAssignment) return;
    const reg = vehicleAssignment.vehicle.registrationNumber;
    Alert.alert(
      "Unlock Vehicle",
      `Send an unlock signal to ${reg}?\n\nMake sure you are physically at the vehicle before proceeding.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlock",
          onPress: async () => {
            try {
              setUnlocking(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await requestUnlock({ assignmentId: vehicleAssignment.assignment.id });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setUnlockResult({
                success: true,
                message: "Unlock signal sent successfully",
                at: new Date().toISOString(),
              });
            } catch (err: unknown) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              const e = err as { response?: { data?: { error?: string } }; message?: string };
              const msg = e?.response?.data?.error ?? e?.message ?? "Unlock request failed";
              setUnlockResult({ success: false, message: msg, at: new Date().toISOString() });
            } finally {
              setUnlocking(false);
            }
          },
        },
      ]
    );
  };

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const displayResult = unlockResult ?? (vehicleAssignment?.assignment.lastUnlockResult
    ? {
        success: vehicleAssignment.assignment.lastUnlockResult === "success",
        message: vehicleAssignment.assignment.lastUnlockResult === "success"
          ? "Last unlock successful"
          : vehicleAssignment.assignment.lastUnlockResult,
        at: vehicleAssignment.assignment.lastUnlockAt ?? "",
      }
    : null);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: topPad + 12, paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={s.greetingRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[s.greeting, { color: colors.mutedForeground }]}>{getGreeting()},</Text>
            <Text style={[s.name, { color: colors.foreground }]} numberOfLines={2}>
              {[profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Driver"}
            </Text>
          </View>
          <View style={s.greetingRight}>
            {profile?.status && <StatusBadge status={profile.status} size="sm" />}
            {unreadCount > 0 && (
              <Pressable
                style={[s.notifBadge, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/(tabs)/notifications")}
              >
                <Feather name="bell" size={13} color="#fff" />
                <Text style={s.notifBadgeText}>{unreadCount}</Text>
              </Pressable>
            )}
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            {vehicleAssignment ? (
              <View style={[s.vehicleCard, { backgroundColor: colors.primary }]}>
                <View style={s.vehicleCardHeader}>
                  <View>
                    <Text style={s.vehicleCardLabel}>Active Vehicle</Text>
                    <Text style={s.vehicleCardReg}>{vehicleAssignment.vehicle.registrationNumber}</Text>
                    <Text style={s.vehicleCardMeta}>
                      {[vehicleAssignment.vehicle.year, vehicleAssignment.vehicle.make, vehicleAssignment.vehicle.model]
                        .filter(Boolean).join(" ")}
                    </Text>
                  </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={[s.vehicleTypeChip, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                      <Feather name="zap" size={14} color="#fff" />
                      <Text style={s.vehicleTypeText}>{vehicleAssignment.vehicle.fleetType?.toUpperCase() ?? "EV"}</Text>
                    </View>
                    {vehicleAssignment.vehicle.status && (
                      <View style={[s.vehicleStatusChip, { backgroundColor: vehicleAssignment.vehicle.status === "active" ? "rgba(255,255,255,0.15)" : "rgba(239,68,68,0.3)" }]}>
                        <Text style={s.vehicleStatusText}>{vehicleAssignment.vehicle.status.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {nextShift?.shift && (
                  <View style={s.shiftWindowRow}>
                    <Feather name="clock" size={13} color="rgba(255,255,255,0.75)" />
                    <Text style={s.shiftWindowText}>
                      {nextShift.shift.title
                        ? `${nextShift.shift.title} · `
                        : ""}
                      {formatDate(nextShift.shift.startTime)}{" "}
                      {formatTime(nextShift.shift.startTime)}–{formatTime(nextShift.shift.endTime)}
                    </Text>
                    {shiftStarted && !shiftEnded && (
                      <View style={s.liveChip}>
                        <Text style={s.liveChipText}>LIVE</Text>
                      </View>
                    )}
                  </View>
                )}

                {displayResult && (
                  <View style={[
                    s.unlockResultBox,
                    { backgroundColor: displayResult.success ? "rgba(255,255,255,0.15)" : "rgba(239,68,68,0.25)" },
                  ]}>
                    <Feather
                      name={displayResult.success ? "check-circle" : "alert-circle"}
                      size={13} color="#fff"
                    />
                    <Text style={s.unlockResultText}>{displayResult.message}</Text>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    s.unlockBtn,
                    { backgroundColor: "rgba(255,255,255,0.18)", opacity: pressed || unlocking ? 0.75 : 1 },
                  ]}
                  onPress={handleUnlock}
                  disabled={!hasAssignment || unlocking}
                  testID="unlock-btn"
                >
                  {unlocking ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Feather name="unlock" size={16} color="#fff" />
                      <Text style={[s.unlockBtnText, { color: "#fff" }]}>Unlock Vehicle</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={[s.noVehicleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="truck" size={26} color={colors.mutedForeground} />
                <View>
                  <Text style={[s.noVehicleTitle, { color: colors.foreground }]}>No Active Vehicle</Text>
                  <Text style={[s.noVehicleBody, { color: colors.mutedForeground }]}>
                    Contact your fleet manager for vehicle assignment
                  </Text>
                </View>
              </View>
            )}

            <View style={s.statsRow}>
              <Pressable
                style={({ pressed }) => [s.statCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
                onPress={() => router.push("/(tabs)/earnings")}
              >
                <Feather name="trending-up" size={18} color={colors.primary} />
                <Text style={[s.statValue, { color: colors.primary }]}>{formatZAR(weeklyEarnings)}</Text>
                <Text style={[s.statLabel, { color: colors.mutedForeground }]}>This Week</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.statCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
                onPress={() => router.push("/(tabs)/shifts")}
              >
                <Feather name="calendar" size={18} color={colors.primary} />
                <Text style={[s.statValue, { color: colors.foreground }]}>{shiftsThisWeek}</Text>
                <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Shifts</Text>
              </Pressable>
            </View>

            {nextShift ? (
              <Pressable
                style={({ pressed }) => [s.shiftCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
                onPress={() => router.push({ pathname: "/shift-detail", params: { id: nextShift.allocation.id } })}
              >
                <View style={s.shiftCardHeader}>
                  <Text style={[s.shiftCardLabel, { color: colors.mutedForeground }]}>Next Confirmed Shift</Text>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </View>
                <Text style={[s.shiftName, { color: colors.foreground }]}>{nextShift.shift.title}</Text>
                <View style={s.shiftTimeRow}>
                  <Feather name="clock" size={13} color={colors.primary} />
                  <Text style={[s.shiftTime, { color: colors.foreground }]}>
                    {formatDate(nextShift.shift.startTime)} · {formatTime(nextShift.shift.startTime)} – {formatTime(nextShift.shift.endTime)}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <View style={[s.noShiftCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="calendar" size={20} color={colors.mutedForeground} />
                <Text style={[s.noShiftText, { color: colors.mutedForeground }]}>
                  No upcoming confirmed shifts — check the Shifts tab
                </Text>
              </View>
            )}

            {latestNotifs.length > 0 && (
              <View style={[s.recentSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.recentHeader}>
                  <Text style={[s.recentTitle, { color: colors.mutedForeground }]}>RECENT UPDATES</Text>
                  <Pressable onPress={() => router.push("/(tabs)/notifications")}>
                    <Text style={[s.recentSeeAll, { color: colors.primary }]}>See all</Text>
                  </Pressable>
                </View>
                {[...latestNotifs].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()).slice(0, 3).map((n) => (
                  <View key={n.id} style={[s.recentItem, { borderTopColor: colors.border }]}>
                    <View style={[s.recentDot, { backgroundColor: n.status === "unread" ? colors.primary : colors.border }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.recentItemTitle, { color: colors.foreground }]} numberOfLines={1}>{n.title}</Text>
                      <Text style={[s.recentItemBody, { color: colors.mutedForeground }]} numberOfLines={1}>{n.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    content: { paddingHorizontal: 20, gap: 12 },
    greetingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
    greeting: { fontSize: 14, fontFamily: "Inter_400Regular" },
    name: { fontSize: 26, fontFamily: "Inter_700Bold" },
    greetingRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    notifBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
    notifBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
    vehicleCard: { borderRadius: 20, padding: 20, gap: 14 },
    vehicleCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    vehicleCardLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_500Medium" },
    vehicleCardReg: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 2 },
    vehicleCardMeta: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
    vehicleTypeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
    vehicleTypeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
    vehicleStatusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    vehicleStatusText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
    shiftWindowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    shiftWindowText: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
    liveChip: { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
    liveChipText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
    unlockResultBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10 },
    unlockResultText: { color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
    unlockBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 14 },
    unlockBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
    noVehicleCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", padding: 20 },
    noVehicleTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
    noVehicleBody: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
    statsRow: { flexDirection: "row", gap: 10 },
    statCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 },
    statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
    statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
    shiftCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
    shiftCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    shiftCardLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
    shiftName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
    shiftTimeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    shiftTime: { fontSize: 13, fontFamily: "Inter_400Regular" },
    noShiftCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", padding: 16 },
    noShiftText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
    recentSection: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
    recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, paddingBottom: 8 },
    recentTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
    recentSeeAll: { fontSize: 13, fontFamily: "Inter_500Medium" },
    recentItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderTopWidth: 1 },
    recentDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
    recentItemTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    recentItemBody: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  });
