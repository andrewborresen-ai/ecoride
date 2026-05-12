import React, { useState } from "react";
import {
  View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useGetMyEarnings } from "@workspace/api-client-react";
import { apiData } from "@/types/api";
import type { Earning } from "@/types/api";

type FilterType = "week" | "month" | "all";

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatPeriod(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return {
    from: new Date(from).toLocaleDateString("en-ZA", opts),
    to: new Date(to).toLocaleDateString("en-ZA", opts),
  };
}

function filterEarnings(earnings: Earning[], filter: FilterType): Earning[] {
  const now = new Date();
  return earnings.filter((e) => {
    if (e.status !== "published") return false;
    if (filter === "all") return true;
    const end = new Date(e.periodEnd);
    if (filter === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return end >= weekAgo;
    }
    if (filter === "month") {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return end >= monthAgo;
    }
    return true;
  });
}

export default function EarningsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: earningsRes, isLoading, refetch } = useGetMyEarnings();
  const [filter, setFilter] = useState<FilterType>("month");

  const allEarnings: Earning[] = apiData<Earning[]>(earningsRes) ?? [];
  const earnings = filterEarnings(allEarnings, filter);

  const totalNet = earnings.reduce((sum, e) => sum + (e.netAmountCents ?? 0), 0);
  const totalGross = earnings.reduce((sum, e) => sum + (e.grossAmountCents ?? 0), 0);
  const totalTrips = earnings.reduce((sum, e) => sum + (e.tripCount ?? 0), 0);

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const renderEarning = ({ item }: { item: Earning }) => {
    const period = formatPeriod(item.periodStart, item.periodEnd);
    return (
      <Pressable
        style={({ pressed }) => [s.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.push({ pathname: "/earnings-detail", params: { id: item.id } })}
        testID={`earning-row-${item.id}`}
      >
        <View style={s.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[s.period, { color: colors.foreground }]}>
              {period.from} – {period.to}
            </Text>
            {item.tripCount != null && item.tripCount > 0 && (
              <Text style={[s.trips, { color: colors.mutedForeground }]}>{item.tripCount} trips</Text>
            )}
          </View>
          <View style={s.netWrap}>
            <Text style={[s.netAmount, { color: colors.primary }]}>{formatZAR(item.netAmountCents)}</Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </View>
        </View>

        <View style={[s.divider, { backgroundColor: colors.border }]} />

        <View style={s.breakdown}>
          {[
            { label: "Gross", value: item.grossAmountCents, color: colors.success, icon: "trending-up" as const },
            { label: "Deductions", value: item.deductionsCents, color: colors.destructive, icon: "trending-down" as const },
            { label: "Incentives", value: item.incentivesCents, color: colors.warning, icon: "star" as const },
          ].map(({ label, value, color, icon }) =>
            value != null && value !== 0 ? (
              <View key={label} style={s.breakdownRow}>
                <View style={s.breakdownLeft}>
                  <Feather name={icon} size={13} color={color} />
                  <Text style={[s.breakdownLabel, { color: colors.mutedForeground }]}>{label}</Text>
                </View>
                <Text style={[s.breakdownValue, { color: colors.foreground }]}>{formatZAR(value)}</Text>
              </View>
            ) : null
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.screenHeader, { paddingTop: topPad }]}>
        <Text style={[s.screenTitle, { color: colors.foreground }]}>Earnings</Text>
        <View style={s.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[
                s.filterChip,
                {
                  backgroundColor: filter === f.key ? colors.primary : colors.muted,
                  borderColor: filter === f.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.filterText, { color: filter === f.key ? "#fff" : colors.mutedForeground }]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={earnings}
          keyExtractor={(item) => item.id}
          renderItem={renderEarning}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            earnings.length > 0 ? (
              <View style={[s.summaryCard, { backgroundColor: colors.primary }]}>
                <Text style={s.summaryLabel}>
                  {FILTERS.find((f) => f.key === filter)?.label} · Net
                </Text>
                <Text style={s.summaryNet}>{formatZAR(totalNet)}</Text>
                <View style={s.summaryRow}>
                  <View style={s.summaryItem}>
                    <Text style={s.summaryItemLabel}>Gross</Text>
                    <Text style={s.summaryItemValue}>{formatZAR(totalGross)}</Text>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryItem}>
                    <Text style={s.summaryItemLabel}>Trips</Text>
                    <Text style={s.summaryItemValue}>{totalTrips}</Text>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryItem}>
                    <Text style={s.summaryItemLabel}>Records</Text>
                    <Text style={s.summaryItemValue}>{earnings.length}</Text>
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Feather name="dollar-sign" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                {filter === "all" ? "No published earnings yet" : "No earnings for this period"}
              </Text>
              <Text style={[s.emptyBody, { color: colors.mutedForeground }]}>
                {filter === "all"
                  ? "Your earnings will appear here after your first shift"
                  : "Try selecting a wider date range"}
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
    screenHeader: { paddingHorizontal: 20, paddingBottom: 8 },
    screenTitle: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 10 },
    filterRow: { flexDirection: "row", gap: 8 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
    filterText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    list: { paddingHorizontal: 20, paddingTop: 10 },
    summaryCard: { borderRadius: 20, padding: 24, marginBottom: 14 },
    summaryLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
    summaryNet: { color: "#fff", fontSize: 40, fontFamily: "Inter_700Bold", marginBottom: 20 },
    summaryRow: { flexDirection: "row", alignItems: "center" },
    summaryItem: { flex: 1, alignItems: "center" },
    summaryItemLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular" },
    summaryItemValue: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 2 },
    summaryDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },
    card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10, gap: 10 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    period: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    trips: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
    netWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
    netAmount: { fontSize: 20, fontFamily: "Inter_700Bold" },
    divider: { height: 1 },
    breakdown: { gap: 6 },
    breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    breakdownLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    breakdownLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
    breakdownValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
    emptyState: { alignItems: "center", gap: 8, marginTop: 60 },
    emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
    emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  });
