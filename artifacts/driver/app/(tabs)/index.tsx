import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
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

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatShiftTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useDriver();
  const { data: summaryRes, isLoading, refetch } = useGetDriverDashboardSummary();
  const { mutateAsync: requestUnlock } = useRequestVehicleUnlock();

  const [unlocking, setUnlocking] = useState(false);
  const summary = (summaryRes as any)?.data;

  const firstName = profile?.firstName ?? summary?.profile?.firstName ?? "Driver";
  const activeAssignment = summary?.activeVehicleAssignment;
  const vehicle = activeAssignment?.vehicle;
  const nextShift = summary?.nextShift;
  const weeklyEarnings: number = summary?.weeklyEarningsCents ?? 0;
  const shiftsThisWeek: number = summary?.shiftsThisWeek ?? 0;
  const unreadCount: number = summary?.unreadNotificationsCount ?? 0;

  const handleUnlock = async () => {
    if (!activeAssignment?.assignment?.id) return;
    try {
      setUnlocking(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await requestUnlock({ assignmentId: activeAssignment.assignment.id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Unlock Requested", "Vehicle unlock has been sent to telematics. Please wait for the vehicle to respond.");
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err?.response?.data?.error ?? "Unlock request failed. Please try again.";
      Alert.alert("Unlock Failed", msg);
    } finally {
      setUnlocking(false);
    }
  };

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  if (isLoading) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: topPad + 60 }} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: topPad + 8, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.greetingRow}>
          <View>
            <Text style={[s.greeting, { color: colors.mutedForeground }]}>Good day,</Text>
            <Text style={[s.name, { color: colors.foreground }]}>{firstName}</Text>
          </View>
          {unreadCount > 0 && (
            <View style={[s.notifBadge, { backgroundColor: colors.primary }]}>
              <Feather name="bell" size={14} color="#fff" />
              <Text style={s.notifBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {activeAssignment ? (
          <View style={[s.vehicleCard, { backgroundColor: colors.primary }]}>
            <View style={s.vehicleCardHeader}>
              <View>
                <Text style={s.vehicleCardLabel}>Active Vehicle</Text>
                <Text style={s.vehicleCardReg}>
                  {vehicle?.registrationNumber ?? "—"}
                </Text>
                <Text style={s.vehicleCardMeta}>
                  {[vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ")}
                </Text>
              </View>
              <View style={[s.vehicleTypeChip, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Feather name="zap" size={14} color="#fff" />
                <Text style={s.vehicleTypeText}>{vehicle?.fleetType ?? "EV"}</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                s.unlockBtn,
                { backgroundColor: "rgba(255,255,255,0.15)", opacity: pressed || unlocking ? 0.75 : 1 },
              ]}
              onPress={handleUnlock}
              disabled={unlocking}
              testID="unlock-btn"
            >
              {unlocking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="unlock" size={18} color="#fff" />
                  <Text style={s.unlockBtnText}>Unlock Vehicle</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={[s.noVehicleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="truck" size={28} color={colors.mutedForeground} />
            <View>
              <Text style={[s.noVehicleTitle, { color: colors.foreground }]}>No Active Vehicle</Text>
              <Text style={[s.noVehicleBody, { color: colors.mutedForeground }]}>
                Contact your fleet manager for vehicle assignment
              </Text>
            </View>
          </View>
        )}

        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.statValue, { color: colors.primary }]}>{formatZAR(weeklyEarnings)}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>This Week</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.statValue, { color: colors.foreground }]}>{shiftsThisWeek}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Shifts</Text>
          </View>
        </View>

        {nextShift ? (
          <View style={[s.shiftCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.shiftCardHeader}>
              <Text style={[s.shiftCardTitle, { color: colors.foreground }]}>Next Shift</Text>
              <StatusBadge status={nextShift.allocation?.status ?? "confirmed"} size="sm" />
            </View>
            <Text style={[s.shiftName, { color: colors.foreground }]}>{nextShift.shift?.title}</Text>
            <View style={s.shiftTimeRow}>
              <Feather name="clock" size={13} color={colors.mutedForeground} />
              <Text style={[s.shiftTime, { color: colors.mutedForeground }]}>
                {nextShift.shift?.startTime ? formatShiftTime(nextShift.shift.startTime) : "—"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[s.noShiftCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="calendar" size={22} color={colors.mutedForeground} />
            <Text style={[s.noShiftText, { color: colors.mutedForeground }]}>No upcoming shifts — check the Shifts tab</Text>
          </View>
        )}

        {summary?.latestNotifications?.length > 0 && (
          <View style={[s.recentSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.recentTitle, { color: colors.mutedForeground }]}>RECENT UPDATES</Text>
            {summary.latestNotifications.slice(0, 3).map((n: any) => (
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
    notifBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
    notifBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
    vehicleCard: { borderRadius: 20, padding: 20, gap: 16 },
    vehicleCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    vehicleCardLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_500Medium" },
    vehicleCardReg: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 2 },
    vehicleCardMeta: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
    vehicleTypeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
    vehicleTypeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
    unlockBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 14 },
    unlockBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
    noVehicleCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", padding: 20 },
    noVehicleTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
    noVehicleBody: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
    statsRow: { flexDirection: "row", gap: 10 },
    statCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 },
    statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
    statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
    shiftCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
    shiftCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    shiftCardTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    shiftName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
    shiftTimeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    shiftTime: { fontSize: 13, fontFamily: "Inter_400Regular" },
    noShiftCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", padding: 16 },
    noShiftText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
    recentSection: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
    recentTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, padding: 16, paddingBottom: 8 },
    recentItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderTopWidth: 1 },
    recentDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
    recentItemTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    recentItemBody: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  });
