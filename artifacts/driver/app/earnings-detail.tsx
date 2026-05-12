import React from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useGetMyEarnings } from "@workspace/api-client-react";
import { apiData } from "@/types/api";
import type { Earning } from "@/types/api";

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatPeriod(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  return {
    from: new Date(from).toLocaleDateString("en-ZA", opts),
    to: new Date(to).toLocaleDateString("en-ZA", opts),
  };
}

interface LineItem {
  label: string;
  cents: number;
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string;
  sign: "+" | "-";
}

export default function EarningsDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: earningsRes, isLoading } = useGetMyEarnings();
  const earnings = apiData<Earning[]>(earningsRes) ?? [];
  const earning = earnings.find((e) => e.id === id) ?? null;

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  if (isLoading) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: topPad + 60 }} />
      </View>
    );
  }

  if (!earning) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad }]}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Earnings Detail</Text>
        </View>
        <View style={s.emptyState}>
          <Feather name="dollar-sign" size={40} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Record not found</Text>
        </View>
      </View>
    );
  }

  const period = formatPeriod(earning.periodStart, earning.periodEnd);

  const lineItems: LineItem[] = [
    { label: "Gross Earnings", cents: earning.grossAmountCents, icon: "trending-up", color: colors.success, sign: "+" },
    { label: "Deductions", cents: earning.deductionsCents, icon: "minus-circle", color: colors.destructive, sign: "-" },
    { label: "Incentives", cents: earning.incentivesCents, icon: "star", color: colors.warning, sign: "+" },
    { label: "Penalties", cents: earning.penaltiesCents, icon: "alert-triangle", color: colors.destructive, sign: "-" },
  ].filter((item) => item.cents > 0);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Earnings Detail</Text>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.heroCard, { backgroundColor: colors.primary }]}>
          <Text style={s.heroPeriod}>{period.from}</Text>
          <Text style={s.heroPeriodTo}>– {period.to}</Text>
          <Text style={s.heroNet}>{formatZAR(earning.netAmountCents)}</Text>
          <Text style={s.heroLabel}>Net Earnings</Text>
          {earning.tripCount > 0 && (
            <View style={s.tripChip}>
              <Feather name="navigation" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={s.tripText}>{earning.tripCount} trips completed</Text>
            </View>
          )}
        </View>

        <View style={[s.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>BREAKDOWN</Text>

          {lineItems.map((item) => (
            <View key={item.label} style={s.lineItem}>
              <View style={[s.lineIcon, { backgroundColor: item.color + "20" }]}>
                <Feather name={item.icon} size={16} color={item.color} />
              </View>
              <Text style={[s.lineLabel, { color: colors.foreground }]}>{item.label}</Text>
              <Text style={[s.lineValue, { color: item.sign === "+" ? colors.success : colors.destructive }]}>
                {item.sign}{formatZAR(item.cents)}
              </Text>
            </View>
          ))}

          <View style={[s.divider, { backgroundColor: colors.border }]} />

          <View style={s.totalRow}>
            <Text style={[s.totalLabel, { color: colors.foreground }]}>Net Payout</Text>
            <Text style={[s.totalValue, { color: colors.primary }]}>{formatZAR(earning.netAmountCents)}</Text>
          </View>
        </View>

        {earning.notes ? (
          <View style={[s.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>NOTES</Text>
            <Text style={[s.notesText, { color: colors.foreground }]}>{earning.notes}</Text>
          </View>
        ) : null}

        <View style={[s.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>PERIOD INFO</Text>
          {[
            { label: "Start", value: period.from },
            { label: "End", value: period.to },
            { label: "Status", value: earning.status },
          ].map(({ label, value }) => (
            <View key={label} style={s.metaRow}>
              <Text style={[s.metaLabel, { color: colors.mutedForeground }]}>{label}</Text>
              <Text style={[s.metaValue, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
            </View>
          ))}
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
    heroCard: { borderRadius: 20, padding: 24 },
    heroPeriod: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_500Medium" },
    heroPeriodTo: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 8 },
    heroNet: { color: "#fff", fontSize: 44, fontFamily: "Inter_700Bold" },
    heroLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 12 },
    tripChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    tripText: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_500Medium" },
    breakdownCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
    sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
    lineItem: { flexDirection: "row", alignItems: "center", gap: 12 },
    lineIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    lineLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
    lineValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    divider: { height: 1 },
    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    totalLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
    totalValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
    notesCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
    notesText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
    metaCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
    metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    metaLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
    metaValue: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "right", flex: 1, marginLeft: 16 },
    emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  });
