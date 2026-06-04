import React, { useState, useCallback } from "react";
import {
  View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator,
  Alert, RefreshControl, Platform, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useListOpenShifts,
  useGetMyAllocations,
  useRequestShift,
  useCancelMyAllocation,
  getListOpenShiftsQueryKey,
  getGetMyAllocationsQueryKey,
} from "@workspace/api-client-react";
import { apiData } from "@/types/api";
import type { Shift, Allocation } from "@/types/api";

type TabType = "available" | "requested" | "confirmed" | "past";
type ShiftDateFilter = "thisWeek" | "nextWeek" | "all";

const TABS: { key: TabType; label: string }[] = [
  { key: "available", label: "Open" },
  { key: "requested", label: "Requested" },
  { key: "confirmed", label: "Confirmed" },
  { key: "past", label: "Past" },
];

const DATE_FILTERS: { key: ShiftDateFilter; label: string }[] = [
  { key: "thisWeek", label: "This Week" },
  { key: "nextWeek", label: "Next Week" },
  { key: "all", label: "All" },
];

function getWeekBounds(offset: 0 | 1): { from: string; to: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    from: monday.toISOString(),
    to: sunday.toISOString(),
  };
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-ZA", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export default function ShiftsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("available");
  const [dateFilter, setDateFilter] = useState<ShiftDateFilter>("thisWeek");
  const [pendingShiftIds, setPendingShiftIds] = useState<Set<string>>(new Set());

  const isMyShiftsTab = activeTab !== "available";

  const openShiftParams = (() => {
    if (dateFilter === "thisWeek") return getWeekBounds(0);
    if (dateFilter === "nextWeek") return getWeekBounds(1);
    return {};
  })();

  const openShiftsQuery = useListOpenShifts(openShiftParams, {
    query: {
      enabled: activeTab === "available",
      queryKey: getListOpenShiftsQueryKey(openShiftParams),
    },
  });
  const myAllocationsQuery = useGetMyAllocations(undefined, {
    query: {
      enabled: isMyShiftsTab,
      queryKey: getGetMyAllocationsQueryKey(),
    },
  });

  const { mutateAsync: requestShift } = useRequestShift();
  const { mutateAsync: cancelAllocation } = useCancelMyAllocation();

  const openShifts: Shift[] = apiData<Shift[]>(openShiftsQuery.data) ?? [];
  const allAllocations: Allocation[] = apiData<Allocation[]>(myAllocationsQuery.data) ?? [];

  const now = new Date();
  const requestedAllocations = allAllocations.filter((a) => a.status === "requested");
  const confirmedAllocations = allAllocations.filter(
    (a) => a.status === "confirmed" && (!a.shift?.endTime || new Date(a.shift.endTime) >= now)
  );
  const pastAllocations = allAllocations.filter(
    (a) =>
      a.status === "cancelled" ||
      a.status === "declined" ||
      (a.shift?.endTime ? new Date(a.shift.endTime) < now : false)
  );

  const isLoading =
    activeTab === "available" ? openShiftsQuery.isLoading : myAllocationsQuery.isLoading;
  const refetch = activeTab === "available" ? openShiftsQuery.refetch : myAllocationsQuery.refetch;

  const currentData: (Shift | Allocation)[] =
    activeTab === "available"
      ? openShifts
      : activeTab === "requested"
      ? requestedAllocations
      : activeTab === "confirmed"
      ? confirmedAllocations
      : pastAllocations;

  const handleRequest = useCallback(async (shiftId: string) => {
    setPendingShiftIds((prev) => new Set(prev).add(shiftId));
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await requestShift({ shiftId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all([openShiftsQuery.refetch(), myAllocationsQuery.refetch()]);
      setActiveTab("requested");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      Alert.alert("Request Failed", e?.response?.data?.error ?? e?.message ?? "Could not request shift.");
    } finally {
      setPendingShiftIds((prev) => { const next = new Set(prev); next.delete(shiftId); return next; });
    }
  }, [requestShift, openShiftsQuery, myAllocationsQuery]);

  const handleCancel = (allocationId: string) => {
    Alert.alert("Cancel Request", "Are you sure you want to cancel this shift request?", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Request",
        style: "destructive",
        onPress: async () => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await cancelAllocation({ allocationId });
            myAllocationsQuery.refetch();
          } catch {
            Alert.alert("Error", "Could not cancel shift request.");
          }
        },
      },
    ]);
  };

  const emptyMessages: Record<TabType, { title: string; body: string }> = {
    available: { title: "No open shifts", body: "Check back later for available shifts" },
    requested: { title: "No pending requests", body: "Request a shift from the Open tab" },
    confirmed: { title: "No confirmed shifts", body: "Your confirmed upcoming shifts will appear here" },
    past: { title: "No past shifts", body: "Your completed and cancelled shifts will appear here" },
  };

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const renderOpenShift = ({ item }: { item: Shift }) => (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[s.shiftTitle, { color: colors.foreground }]}>{item.title}</Text>
          {item.fleetType && (
            <Text style={[s.shiftMeta, { color: colors.mutedForeground }]}>
              {item.fleetType === "electric" ? "EcoRide Electric" : "Khula Rides LPG"}
            </Text>
          )}
        </View>
        <StatusBadge status={item.status ?? "open"} size="sm" />
      </View>
      <View style={s.timeRow}>
        <View style={s.timeBlock}>
          <Text style={[s.timeLabel, { color: colors.mutedForeground }]}>Start</Text>
          <Text style={[s.timeDate, { color: colors.foreground }]}>{formatDate(item.startTime)}</Text>
          <Text style={[s.timeHour, { color: colors.primary }]}>{formatTime(item.startTime)}</Text>
        </View>
        <Feather name="arrow-right" size={16} color={colors.mutedForeground} />
        <View style={s.timeBlock}>
          <Text style={[s.timeLabel, { color: colors.mutedForeground }]}>End</Text>
          <Text style={[s.timeDate, { color: colors.foreground }]}>{formatDate(item.endTime)}</Text>
          <Text style={[s.timeHour, { color: colors.primary }]}>{formatTime(item.endTime)}</Text>
        </View>
      </View>
      {item.description ? (
        <Text style={[s.description, { color: colors.mutedForeground }]}>{item.description}</Text>
      ) : null}
      {(() => {
        const isPending = pendingShiftIds.has(item.id);
        return (
          <Pressable
            style={({ pressed }) => [
              s.requestBtn,
              { backgroundColor: isPending ? colors.primary + "99" : colors.primary, opacity: pressed && !isPending ? 0.85 : 1 },
            ]}
            onPress={() => !isPending && handleRequest(item.id)}
            disabled={isPending}
            testID={`request-shift-${item.id}`}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.requestBtnText}>Request Shift</Text>
            )}
          </Pressable>
        );
      })()}
    </View>
  );

  const renderAllocation = ({ item }: { item: Allocation }) => {
    const shift = item.shift;
    const vehicle = item.vehicleAssignment?.vehicle;
    const isConfirmed = item.status === "confirmed";

    return (
      <Pressable
        style={({ pressed }) => [
          s.card,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={() => router.push({ pathname: "/shift-detail", params: { id: item.id } })}
      >
        <View style={s.cardHeader}>
          <Text style={[s.shiftTitle, { color: colors.foreground }]} numberOfLines={1}>
            {shift?.title ?? "Shift Request"}
          </Text>
          <StatusBadge status={item.status} size="sm" />
        </View>

        {shift ? (
          <View style={s.timeRow}>
            <View style={s.timeBlock}>
              <Text style={[s.timeLabel, { color: colors.mutedForeground }]}>Start</Text>
              <Text style={[s.timeDate, { color: colors.foreground }]}>{formatDate(shift.startTime)}</Text>
              <Text style={[s.timeHour, { color: colors.primary }]}>{formatTime(shift.startTime)}</Text>
            </View>
            <Feather name="arrow-right" size={16} color={colors.mutedForeground} />
            <View style={s.timeBlock}>
              <Text style={[s.timeLabel, { color: colors.mutedForeground }]}>End</Text>
              <Text style={[s.timeDate, { color: colors.foreground }]}>{formatDate(shift.endTime)}</Text>
              <Text style={[s.timeHour, { color: colors.primary }]}>{formatTime(shift.endTime)}</Text>
            </View>
          </View>
        ) : (
          <Text style={[s.shiftMeta, { color: colors.mutedForeground }]}>
            Requested: {formatDate(item.requestedAt)}
          </Text>
        )}

        {isConfirmed && vehicle && (
          <View style={[s.vehicleChip, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
            <Feather name="truck" size={13} color={colors.primary} />
            <Text style={[s.vehicleChipText, { color: colors.primary }]}>{vehicle.registrationNumber}</Text>
            <Text style={[s.vehicleChipMeta, { color: colors.mutedForeground }]}>
              {[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
            </Text>
          </View>
        )}

        {isConfirmed && !vehicle && (
          <Text style={[s.noVehicleHint, { color: colors.mutedForeground }]}>
            Vehicle not assigned yet
          </Text>
        )}

        <View style={s.cardFooter}>
          {item.status === "requested" && (
            <Pressable
              style={({ pressed }) => [s.cancelBtn, { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 }]}
              onPress={() => handleCancel(item.id)}
            >
              <Text style={[s.cancelBtnText, { color: colors.destructive }]}>Cancel Request</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.screenHeader, { paddingTop: topPad }]}>
        <Text style={[s.screenTitle, { color: colors.foreground }]}>Shifts</Text>
        <View style={s.tabsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
            {TABS.map((tab) => {
              const isActive = tab.key === activeTab;
              return (
                <Pressable
                  key={tab.key}
                  style={[s.tabChip, { backgroundColor: isActive ? colors.primary : colors.muted }]}
                  onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
                >
                  <Text style={[s.tabChipText, { color: isActive ? "#fff" : colors.mutedForeground }]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {activeTab === "available" && (
          <View style={s.dateFilterRow}>
            {DATE_FILTERS.map((f) => {
              const isActive = f.key === dateFilter;
              return (
                <Pressable
                  key={f.key}
                  style={[
                    s.dateFilterChip,
                    {
                      backgroundColor: isActive ? colors.primary + "15" : "transparent",
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { setDateFilter(f.key); Haptics.selectionAsync(); }}
                >
                  <Text style={[s.dateFilterText, { color: isActive ? colors.primary : colors.mutedForeground }]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={currentData as (Shift | Allocation)[]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            activeTab === "available"
              ? renderOpenShift({ item: item as Shift })
              : renderAllocation({ item: item as Allocation })
          }
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Feather name="calendar" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>{emptyMessages[activeTab].title}</Text>
              <Text style={[s.emptyBody, { color: colors.mutedForeground }]}>{emptyMessages[activeTab].body}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    screenHeader: { paddingHorizontal: 20, paddingBottom: 10 },
    screenTitle: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 12 },
    tabsRow: { marginBottom: 10 },
    dateFilterRow: { flexDirection: "row", gap: 8, marginTop: 4 },
    dateFilterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
    dateFilterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    tabChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
    tabChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    list: { paddingHorizontal: 20, paddingTop: 10 },
    card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10, gap: 10 },
    cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    shiftTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1, marginRight: 8 },
    shiftMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
    timeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    timeBlock: { gap: 2 },
    timeLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
    timeDate: { fontSize: 13, fontFamily: "Inter_500Medium" },
    timeHour: { fontSize: 15, fontFamily: "Inter_700Bold" },
    description: { fontSize: 13, fontFamily: "Inter_400Regular" },
    vehicleChip: {
      flexDirection: "row", alignItems: "center", gap: 8,
      borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
    },
    vehicleChipText: { fontSize: 13, fontFamily: "Inter_700Bold" },
    vehicleChipMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
    noVehicleHint: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
    cardFooter: { flexDirection: "row", alignItems: "center" },
    requestBtn: { height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    requestBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    cancelBtn: { height: 36, paddingHorizontal: 14, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
    cancelBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    emptyState: { alignItems: "center", gap: 8, marginTop: 60 },
    emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
    emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  });
