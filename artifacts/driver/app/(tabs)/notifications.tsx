import React from "react";
import {
  View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useGetMyNotifications, useMarkNotificationRead } from "@workspace/api-client-react";
import { apiData } from "@/types/api";
import type { Notification } from "@/types/api";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

const NOTIF_ICONS: Record<string, { icon: FeatherIconName; color: string }> = {
  approval: { icon: "check-circle", color: "#16A34A" },
  rejection: { icon: "x-circle", color: "#EF4444" },
  shift: { icon: "calendar", color: "#3B82F6" },
  earnings: { icon: "dollar-sign", color: "#F59E0B" },
  vehicle: { icon: "truck", color: "#8B5CF6" },
  suspension: { icon: "alert-circle", color: "#EF4444" },
  general: { icon: "bell", color: "#6B7280" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: notifsRes, isLoading, refetch } = useGetMyNotifications();
  const { mutateAsync: markRead } = useMarkNotificationRead();

  const notifications: Notification[] = (apiData<Notification[]>(notifsRes) ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  const handleMarkRead = async (id: string, status: string) => {
    if (status === "read") return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await markRead({ notificationId: id });
      refetch();
    } catch {}
  };

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const renderNotification = ({ item }: { item: Notification }) => {
    const isUnread = item.status === "unread";
    const notifType = item.type ?? "general";
    const iconConf = NOTIF_ICONS[notifType] ?? NOTIF_ICONS.general!;

    return (
      <Pressable
        style={[
          s.card,
          {
            backgroundColor: isUnread ? colors.primary + "08" : colors.card,
            borderColor: isUnread ? colors.primary + "30" : colors.border,
          },
        ]}
        onPress={() => handleMarkRead(item.id, item.status)}
        testID={`notification-${item.id}`}
      >
        <View style={[s.iconWrap, { backgroundColor: iconConf.color + "20" }]}>
          <Feather name={iconConf.icon} size={18} color={iconConf.color} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={s.titleRow}>
            <Text style={[s.notifTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
            {isUnread && <View style={[s.unreadDot, { backgroundColor: colors.primary }]} />}
          </View>
          <Text style={[s.notifBody, { color: colors.mutedForeground }]} numberOfLines={2}>{item.body}</Text>
          <Text style={[s.notifTime, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.screenHeader, { paddingTop: topPad }]}>
        <View style={s.headerRow}>
          <Text style={[s.screenTitle, { color: colors.foreground }]}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={[s.badge, { backgroundColor: colors.primary }]}>
              <Text style={s.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!notifications.length}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Feather name="bell-off" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No notifications</Text>
              <Text style={[s.emptyBody, { color: colors.mutedForeground }]}>
                Updates about your account and shifts will appear here
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
    headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    screenTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
    badge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    badgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
    list: { paddingHorizontal: 20, paddingTop: 8 },
    card: { flexDirection: "row", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8, alignItems: "flex-start" },
    iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    notifTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
    unreadDot: { width: 8, height: 8, borderRadius: 4 },
    notifBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
    notifTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
    emptyState: { alignItems: "center", gap: 8, marginTop: 60 },
    emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
    emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  });
