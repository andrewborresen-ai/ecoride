import React, { useState } from "react";
import {
  View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator, Alert, RefreshControl, Platform,
} from "react-native";
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
} from "@workspace/api-client-react";

type TabType = "open" | "mine";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-ZA", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export default function ShiftsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("open");

  const openShiftsQuery = useListOpenShifts({
    query: { enabled: activeTab === "open" },
  });
  const myAllocationsQuery = useGetMyAllocations(undefined, {
    query: { enabled: activeTab === "mine" },
  });

  const { mutateAsync: requestShift } = useRequestShift();
  const { mutateAsync: cancelAllocation } = useCancelMyAllocation();

  const openShifts: any[] = (openShiftsQuery.data as any)?.data ?? [];
  const myAllocations: any[] = (myAllocationsQuery.data as any)?.data ?? [];
  const isLoading = activeTab === "open" ? openShiftsQuery.isLoading : myAllocationsQuery.isLoading;
  const refetch = activeTab === "open" ? openShiftsQuery.refetch : myAllocationsQuery.refetch;

  const handleRequestShift = async (shiftId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await requestShift({ shiftId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      openShiftsQuery.refetch();
      Alert.alert("Requested", "Shift request submitted successfully!");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Could not request shift.";
      Alert.alert("Error", msg);
    }
  };

  const handleCancelAllocation = (allocationId: string) => {
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

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const renderOpenShift = ({ item }: { item: any }) => (
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
          <Text style={[s.timeValue, { color: colors.foreground }]}>{formatDate(item.startTime)}</Text>
          <Text style={[s.timeHour, { color: colors.primary }]}>{formatTime(item.startTime)}</Text>
        </View>
        <Feather name="arrow-right" size={16} color={colors.mutedForeground} />
        <View style={s.timeBlock}>
          <Text style={[s.timeLabel, { color: colors.mutedForeground }]}>End</Text>
          <Text style={[s.timeValue, { color: colors.foreground }]}>{formatDate(item.endTime)}</Text>
          <Text style={[s.timeHour, { color: colors.primary }]}>{formatTime(item.endTime)}</Text>
        </View>
      </View>

      {item.description && (
        <Text style={[s.description, { color: colors.mutedForeground }]}>{item.description}</Text>
      )}

      <Pressable
        style={({ pressed }) => [s.requestBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        onPress={() => handleRequestShift(item.id)}
        testID={`request-shift-${item.id}`}
      >
        <Text style={s.requestBtnText}>Request Shift</Text>
      </Pressable>
    </View>
  );

  const renderAllocation = ({ item }: { item: any }) => (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardHeader}>
        <Text style={[s.shiftTitle, { color: colors.foreground }]}>Shift Allocation</Text>
        <StatusBadge status={item.status} size="sm" />
      </View>
      <Text style={[s.shiftMeta, { color: colors.mutedForeground }]}>
        Requested: {formatDate(item.requestedAt)}
      </Text>
      {item.status === "requested" && (
        <Pressable
          style={({ pressed }) => [s.cancelBtn, { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 }]}
          onPress={() => handleCancelAllocation(item.id)}
        >
          <Text style={[s.cancelBtnText, { color: colors.destructive }]}>Cancel Request</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.screenHeader, { paddingTop: topPad }]}>
        <Text style={[s.screenTitle, { color: colors.foreground }]}>Shifts</Text>
        <View style={[s.tabs, { backgroundColor: colors.muted }]}>
          {(["open", "mine"] as TabType[]).map((tab) => (
            <Pressable
              key={tab}
              style={[s.tab, activeTab === tab && { backgroundColor: colors.card }]}
              onPress={() => { setActiveTab(tab); Haptics.selectionAsync(); }}
            >
              <Text style={[s.tabText, { color: activeTab === tab ? colors.foreground : colors.mutedForeground }]}>
                {tab === "open" ? "Open Shifts" : "My Requests"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={activeTab === "open" ? openShifts : myAllocations}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === "open" ? renderOpenShift : renderAllocation}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(activeTab === "open" ? openShifts : myAllocations).length}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Feather name="calendar" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                {activeTab === "open" ? "No open shifts" : "No shift requests"}
              </Text>
              <Text style={[s.emptyBody, { color: colors.mutedForeground }]}>
                {activeTab === "open" ? "Check back later for available shifts" : "Request a shift from the Open Shifts tab"}
              </Text>
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
    screenHeader: { paddingHorizontal: 20, paddingBottom: 12 },
    screenTitle: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 16 },
    tabs: { flexDirection: "row", borderRadius: 10, padding: 3 },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
    tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    list: { paddingHorizontal: 20, paddingTop: 8 },
    card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10, gap: 10 },
    cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    shiftTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
    shiftMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
    timeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    timeBlock: { gap: 2 },
    timeLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
    timeValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
    timeHour: { fontSize: 15, fontFamily: "Inter_700Bold" },
    description: { fontSize: 13, fontFamily: "Inter_400Regular" },
    requestBtn: { height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    requestBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    cancelBtn: { height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
    cancelBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    emptyState: { alignItems: "center", gap: 8, marginTop: 60 },
    emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
    emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  });
