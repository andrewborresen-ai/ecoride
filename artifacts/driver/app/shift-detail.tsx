import React, { useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useGetMyAllocations,
  useRequestVehicleUnlock,
  getGetMyAllocationsQueryKey,
} from "@workspace/api-client-react";
import { apiData } from "@/types/api";
import type { Allocation } from "@/types/api";

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-ZA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export default function ShiftDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const allocationsQuery = useGetMyAllocations(undefined, {
    query: {
      enabled: !!id,
      queryKey: getGetMyAllocationsQueryKey(),
    },
  });
  const allocations = apiData<Allocation[]>(allocationsQuery.data) ?? [];
  const allocation = allocations.find((a) => a.id === id) ?? null;

  const { mutateAsync: requestUnlock } = useRequestVehicleUnlock();
  const [unlocking, setUnlocking] = useState(false);
  const [sessionUnlockResult, setSessionUnlockResult] = useState<{ success: boolean; message: string } | null>(null);

  const shift = allocation?.shift;
  const vehicle = allocation?.vehicleAssignment?.vehicle;
  const assignment = allocation?.vehicleAssignment?.assignment;
  const isConfirmed = allocation?.status === "confirmed";
  const now = new Date();
  const shiftStarted = shift?.startTime ? new Date(shift.startTime) <= now : false;
  const shiftEnded = shift?.endTime ? new Date(shift.endTime) < now : false;
  const canUnlock = isConfirmed && !!assignment?.id;

  const handleUnlock = () => {
    if (!assignment?.id) return;
    Alert.alert(
      "Unlock Vehicle",
      `This will send an unlock signal to ${vehicle?.registrationNumber ?? "your vehicle"}. Proceed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlock",
          onPress: async () => {
            try {
              setUnlocking(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await requestUnlock({ assignmentId: assignment.id });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setSessionUnlockResult({ success: true, message: "Unlock signal sent successfully" });
            } catch (err: unknown) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              const e = err as { response?: { data?: { error?: string } }; message?: string };
              const msg = e?.response?.data?.error ?? e?.message ?? "Unlock request failed";
              setSessionUnlockResult({ success: false, message: msg });
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

  if (allocationsQuery.isLoading) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: topPad + 60 }} />
      </View>
    );
  }

  if (!allocation) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad }]}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Shift Detail</Text>
        </View>
        <View style={s.emptyState}>
          <Feather name="calendar" size={40} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Shift not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Shift Detail</Text>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.cardHeaderRow}>
            <Text style={[s.shiftTitle, { color: colors.foreground }]}>{shift?.title ?? "Shift"}</Text>
            <StatusBadge status={allocation.status} size="sm" />
          </View>
          {shift?.fleetType && (
            <Text style={[s.meta, { color: colors.mutedForeground }]}>
              {shift.fleetType === "electric" ? "EcoRide Electric" : "Khula Rides LPG"}
            </Text>
          )}

          {shift?.startTime && (
            <View style={s.timeSection}>
              <View style={s.timeBlock}>
                <Text style={[s.timeLabel, { color: colors.mutedForeground }]}>Start</Text>
                <Text style={[s.timeValue, { color: colors.foreground }]}>{formatDateTime(shift.startTime)}</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.timeBlock}>
                <Text style={[s.timeLabel, { color: colors.mutedForeground }]}>End</Text>
                <Text style={[s.timeValue, { color: colors.foreground }]}>{shift.endTime ? formatDateTime(shift.endTime) : "—"}</Text>
              </View>
            </View>
          )}

          {shift?.description ? (
            <Text style={[s.description, { color: colors.mutedForeground }]}>{shift.description}</Text>
          ) : null}
        </View>

        {isConfirmed && vehicle && (
          <View style={[s.vehicleCard, { backgroundColor: colors.primary }]}>
            <View style={s.vehicleCardHeader}>
              <View>
                <Text style={s.vehicleLabel}>Assigned Vehicle</Text>
                <Text style={s.vehicleReg}>{vehicle.registrationNumber}</Text>
                <Text style={s.vehicleMeta}>
                  {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                </Text>
              </View>
              <View style={[s.vehicleTypeChip, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Feather name="truck" size={14} color="#fff" />
              </View>
            </View>

            {sessionUnlockResult ? (
              <View style={[s.unlockResult, { backgroundColor: sessionUnlockResult.success ? "rgba(255,255,255,0.2)" : "rgba(239,68,68,0.3)" }]}>
                <Feather name={sessionUnlockResult.success ? "check-circle" : "alert-circle"} size={14} color="#fff" />
                <Text style={s.unlockResultText}>{sessionUnlockResult.message}</Text>
              </View>
            ) : assignment?.lastUnlockResult ? (
              <View style={s.persistedUnlock}>
                <View style={s.persistedUnlockRow}>
                  <Feather name="clock" size={12} color="rgba(255,255,255,0.65)" />
                  <Text style={s.persistedUnlockLabel}>Last unlock</Text>
                </View>
                <Text style={s.persistedUnlockResult}>{assignment.lastUnlockResult}</Text>
                {assignment.lastUnlockAt ? (
                  <Text style={s.persistedUnlockAt}>
                    {new Date(assignment.lastUnlockAt).toLocaleString("en-ZA", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {canUnlock && (
              <Pressable
                style={({ pressed }) => [s.unlockBtn, { opacity: pressed || unlocking ? 0.75 : 1 }]}
                onPress={handleUnlock}
                disabled={unlocking}
                testID="unlock-btn"
              >
                {unlocking ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="unlock" size={16} color="#fff" />
                    <Text style={s.unlockBtnText}>Unlock Vehicle</Text>
                  </>
                )}
              </Pressable>
            )}

            {isConfirmed && !canUnlock && (
              <Text style={s.unlockNote}>
                {shiftEnded
                  ? "Shift has ended — unlock not available"
                  : !shiftStarted
                  ? `Unlock available at ${shift?.startTime ? formatTime(shift.startTime) : "shift start"}`
                  : "Vehicle unlock not available"}
              </Text>
            )}
          </View>
        )}

        {isConfirmed && !vehicle && (
          <View style={[s.noVehicleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="truck" size={22} color={colors.mutedForeground} />
            <Text style={[s.noVehicleText, { color: colors.mutedForeground }]}>
              No vehicle assigned yet — check back closer to the shift
            </Text>
          </View>
        )}

        <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.infoTitle, { color: colors.mutedForeground }]}>ALLOCATION INFO</Text>
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Requested</Text>
            <Text style={[s.infoValue, { color: colors.foreground }]}>{formatDateTime(allocation.requestedAt)}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Status</Text>
            <StatusBadge status={allocation.status} size="sm" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
    content: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
    card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
    cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    shiftTitle: { fontSize: 18, fontFamily: "Inter_700Bold", flex: 1, marginRight: 8 },
    meta: { fontSize: 13, fontFamily: "Inter_400Regular" },
    timeSection: { gap: 8, marginTop: 4 },
    timeBlock: { gap: 2 },
    timeLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
    timeValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
    divider: { height: 1 },
    description: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
    vehicleCard: { borderRadius: 16, padding: 18, gap: 12 },
    vehicleCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    vehicleLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontFamily: "Inter_500Medium" },
    vehicleReg: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold", marginTop: 2 },
    vehicleMeta: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular" },
    vehicleTypeChip: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    unlockResult: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10 },
    unlockResultText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
    unlockBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)" },
    unlockBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
    unlockNote: { color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
    persistedUnlock: { gap: 2 },
    persistedUnlockRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    persistedUnlockLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "Inter_400Regular" },
    persistedUnlockResult: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" },
    persistedUnlockAt: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "Inter_400Regular" },
    noVehicleCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", padding: 16 },
    noVehicleText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
    infoCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
    infoTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    infoLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
    infoValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
    emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  });
