import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  incomplete: { label: "Incomplete", color: "#F59E0B", bg: "#FEF3C7" },
  pending: { label: "Pending Review", color: "#3B82F6", bg: "#DBEAFE" },
  approved: { label: "Approved", color: "#16A34A", bg: "#DCFCE7" },
  rejected: { label: "Rejected", color: "#EF4444", bg: "#FEE2E2" },
  suspended: { label: "Suspended", color: "#DC2626", bg: "#FEE2E2" },
  active: { label: "Active", color: "#16A34A", bg: "#DCFCE7" },
  inactive: { label: "Inactive", color: "#6B7280", bg: "#F3F4F6" },
  confirmed: { label: "Confirmed", color: "#16A34A", bg: "#DCFCE7" },
  requested: { label: "Requested", color: "#3B82F6", bg: "#DBEAFE" },
  cancelled: { label: "Cancelled", color: "#6B7280", bg: "#F3F4F6" },
  declined: { label: "Declined", color: "#EF4444", bg: "#FEE2E2" },
  open: { label: "Open", color: "#3DB324", bg: "#DCFCE7" },
  published: { label: "Published", color: "#16A34A", bg: "#DCFCE7" },
  unread: { label: "Unread", color: "#3B82F6", bg: "#DBEAFE" },
  read: { label: "Read", color: "#6B7280", bg: "#F3F4F6" },
  verified: { label: "Verified", color: "#16A34A", bg: "#DCFCE7" },
  "pending-review": { label: "Under Review", color: "#F59E0B", bg: "#FEF3C7" },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    color: "#6B7280",
    bg: "#F3F4F6",
  };

  const fontSize = size === "sm" ? 10 : 12;
  const paddingH = size === "sm" ? 6 : 8;
  const paddingV = size === "sm" ? 2 : 4;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
        },
      ]}
    >
      <Text style={[styles.label, { color: config.color, fontSize }]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
});
