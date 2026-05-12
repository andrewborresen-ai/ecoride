import React from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useGetMyEarnings } from "@workspace/api-client-react";

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatPeriod(from: string, to: string) {
  const f = new Date(from);
  const t = new Date(to);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${f.toLocaleDateString("en-ZA", opts)} – ${t.toLocaleDateString("en-ZA", opts)}`;
}

export default function EarningsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: earningsRes, isLoading, refetch } = useGetMyEarnings();
  const earnings: any[] = (earningsRes as any)?.data ?? [];

  const totalNet = earnings.reduce((sum: number, e: any) => sum + (e.netAmountCents ?? 0), 0);
  const totalGross = earnings.reduce((sum: number, e: any) => sum + (e.grossAmountCents ?? 0), 0);
  const totalTrips = earnings.reduce((sum: number, e: any) => sum + (e.tripCount ?? 0), 0);

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const renderEarning = ({ item }: { item: any }) => (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardHeader}>
        <View>
          <Text style={[s.period, { color: colors.foreground }]}>{formatPeriod(item.periodStart, item.periodEnd)}</Text>
          {item.tripCount != null && (
            <Text style={[s.trips, { color: colors.mutedForeground }]}>{item.tripCount} trips</Text>
          )}
        </View>
        <Text style={[s.netAmount, { color: colors.primary }]}>{formatZAR(item.netAmountCents)}</Text>
      </View>

      <View style={[s.divider, { backgroundColor: colors.border }]} />

      <View style={s.breakdown}>
        {[
          { label: "Gross", value: item.grossAmountCents, icon: "trending-up" as const, color: colors.success },
          { label: "Deductions", value: item.deductionsCents, icon: "trending-down" as const, color: colors.destructive },
          { label: "Incentives", value: item.incentivesCents, icon: "star" as const, color: colors.warning },
        ].map(({ label, value, icon, color }) =>
          value != null && value !== 0 ? (
            <View key={label} style={s.breakdownRow}>
              <View style={s.breakdownLeft}>
                <Feather name={icon} size={14} color={color} />
                <Text style={[s.breakdownLabel, { color: colors.mutedForeground }]}>{label}</Text>
              </View>
              <Text style={[s.breakdownValue, { color: colors.foreground }]}>{formatZAR(value)}</Text>
            </View>
          ) : null
        )}
      </View>

      {item.notes ? (
        <Text style={[s.notes, { color: colors.mutedForeground }]}>{item.notes}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.screenHeader, { paddingTop: topPad }]}>
        <Text style={[s.screenTitle, { color: colors.foreground }]}>Earnings</Text>
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
          scrollEnabled={!!earnings.length}
          ListHeaderComponent={
            earnings.length > 0 ? (
              <View style={[s.summaryCard, { backgroundColor: colors.primary }]}>
                <Text style={s.summaryLabel}>Total Earnings</Text>
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
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No earnings yet</Text>
              <Text style={[s.emptyBody, { color: colors.mutedForeground }]}>
                Your earnings will appear here after your first shift
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
    screenTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
    list: { paddingHorizontal: 20, paddingTop: 8 },
    summaryCard: { borderRadius: 20, padding: 24, marginBottom: 16 },
    summaryLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
    summaryNet: { color: "#fff", fontSize: 40, fontFamily: "Inter_700Bold", marginBottom: 20 },
    summaryRow: { flexDirection: "row", alignItems: "center" },
    summaryItem: { flex: 1, alignItems: "center" },
    summaryItemLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular" },
    summaryItemValue: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 2 },
    summaryDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },
    card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10, gap: 10 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    period: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
    trips: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
    netAmount: { fontSize: 22, fontFamily: "Inter_700Bold" },
    divider: { height: 1 },
    breakdown: { gap: 6 },
    breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    breakdownLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    breakdownLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
    breakdownValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
    notes: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
    emptyState: { alignItems: "center", gap: 8, marginTop: 60 },
    emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
    emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  });
