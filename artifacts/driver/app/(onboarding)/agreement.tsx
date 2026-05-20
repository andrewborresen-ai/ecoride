import React, { useRef, useState, useMemo } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Platform, ScrollView, TextInput,
  PanResponder, GestureResponderEvent,
} from "react-native";
import Markdown from "react-native-markdown-display";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import {
  useGetActiveAgreement,
  useSignAgreement,
  useGetMyProfile,
  useRequestDocumentUploadUrl,
} from "@workspace/api-client-react";
import { apiData } from "@/types/api";
import type { Agreement, DriverProfile } from "@/types/api";

const STEPS = ["Personal", "Address", "Banking", "Fleet", "Documents", "Agreement"];

function formatDateTime(date: Date) {
  return date.toLocaleDateString("en-ZA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface Point { x: number; y: number; }
interface Stroke { points: Point[]; }

function strokeToPath(stroke: Stroke): string {
  if (stroke.points.length < 2) return "";
  const [first, ...rest] = stroke.points;
  return `M${first.x},${first.y} ` + rest.map((p) => `L${p.x},${p.y}`).join(" ");
}

function strokesToSvgString(strokes: Stroke[], width: number, height: number): string {
  const paths = strokes.map((s) => strokeToPath(s)).filter(Boolean);
  const pathsXml = paths.map(
    (d) => `<path d="${d}" stroke="#1C2126" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  ).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${pathsXml}</svg>`;
}

const PAD_HEIGHT = 120;
const PAD_WIDTH = 320;

function SignaturePad({
  strokes,
  onStrokesChange,
  color,
  borderColor,
  backgroundColor,
  disabled,
}: {
  strokes: Stroke[];
  onStrokesChange: (s: Stroke[]) => void;
  color: string;
  borderColor: string;
  backgroundColor: string;
  disabled?: boolean;
}) {
  const currentStroke = useRef<Point[]>([]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        currentStroke.current = [{ x: locationX, y: locationY }];
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        currentStroke.current = [...currentStroke.current, { x: locationX, y: locationY }];
        onStrokesChange([...strokes, { points: currentStroke.current }]);
      },
      onPanResponderRelease: () => {
        if (currentStroke.current.length > 1) {
          onStrokesChange([...strokes, { points: currentStroke.current }]);
        }
        currentStroke.current = [];
      },
    })
  ).current;

  const allPaths = strokes.map((s) => strokeToPath(s)).filter(Boolean);

  return (
    <View
      style={[sigStyles.pad, { borderColor, backgroundColor, opacity: disabled ? 0.4 : 1 }]}
      {...(disabled ? {} : panResponder.panHandlers)}
    >
      {allPaths.length === 0 && (
        <Text style={[sigStyles.placeholder, { color: borderColor }]}>Draw your signature here</Text>
      )}
      <Svg style={StyleSheet.absoluteFill} width="100%" height={PAD_HEIGHT}>
        {allPaths.map((d, i) => (
          <Path key={i} d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    </View>
  );
}

const sigStyles = StyleSheet.create({
  pad: { height: PAD_HEIGHT, borderWidth: 1.5, borderRadius: 12, overflow: "hidden", justifyContent: "center", alignItems: "center" },
  placeholder: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic" },
});

function injectDriverData(content: string, profile: DriverProfile | null | undefined): string {
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "________________";
  const id = profile?.idNumber || "________________";
  return content
    .replace(/\{\{contractorName\}\}/g, name)
    .replace(/\{\{idNumber\}\}/g, id);
}

export default function AgreementStep() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: agreementRes, isLoading: loadingAgreement } = useGetActiveAgreement();
  const { data: profileRes } = useGetMyProfile();
  const { mutateAsync: signAgreement } = useSignAgreement();
  const { mutateAsync: requestUploadUrl } = useRequestDocumentUploadUrl();

  const agreement = apiData<Agreement>(agreementRes);
  const profile = apiData<DriverProfile>(profileRes);

  const defaultName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  const [legalName, setLegalName] = useState(defaultName);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const signatureTimestamp = new Date();

  const hasDrawnSignature = strokes.length > 0;

  const renderedContent = useMemo(
    () => (agreement?.content ? injectDriverData(agreement.content, profile) : ""),
    [agreement?.content, profile]
  );

  const markdownStyles = useMemo(() => ({
    body: { fontFamily: "Inter_400Regular", fontSize: 13, color: colors.foreground, lineHeight: 20 },
    heading1: { fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground, marginTop: 16, marginBottom: 8 },
    heading2: { fontFamily: "Inter_700Bold", fontSize: 14, color: colors.foreground, marginTop: 14, marginBottom: 6 },
    heading3: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground, marginTop: 10, marginBottom: 4 },
    strong: { fontFamily: "Inter_700Bold", color: colors.foreground },
    em: { fontFamily: "Inter_400Regular", fontStyle: "italic" as const, color: colors.mutedForeground },
    hr: { backgroundColor: colors.border, height: 1, marginVertical: 12 },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    list_item: { marginBottom: 4 },
    paragraph: { marginBottom: 8 },
    table: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: 12, overflow: "hidden" as const },
    th: { backgroundColor: colors.muted, padding: 8, fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.foreground },
    td: { padding: 8, borderTopWidth: 1, borderTopColor: colors.border, fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground },
    tr: {},
    code_inline: { fontFamily: "Inter_400Regular", fontSize: 12, backgroundColor: colors.muted, paddingHorizontal: 4, borderRadius: 4 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 12, marginVertical: 8 },
  }), [colors]);

  const handleClearSignature = () => { setStrokes([]); Haptics.selectionAsync(); };

  const handleSign = async () => {
    setErrorMsg("");
    if (!legalName || !accepted) {
      setErrorMsg("Please enter your legal name and accept the agreement.");
      return;
    }
    if (!hasDrawnSignature) {
      setErrorMsg("Please draw your signature in the signature pad.");
      return;
    }
    if (!agreement) {
      setErrorMsg("No active agreement found. Please contact support.");
      return;
    }
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      let signatureObjectPath: string | undefined;
      try {
        const svgString = strokesToSvgString(strokes, PAD_WIDTH, PAD_HEIGHT);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
        const svgSize = svgBlob.size;
        const urlRes = await requestUploadUrl({
          data: { name: "signature.svg", size: svgSize, contentType: "image/svg+xml" },
        });
        const uploadData = apiData<{ uploadURL: string; objectPath: string }>(urlRes);
        if (uploadData?.uploadURL && uploadData?.objectPath) {
          await fetch(uploadData.uploadURL, {
            method: "PUT",
            body: svgBlob,
            headers: { "Content-Type": "image/svg+xml" },
          });
          signatureObjectPath = uploadData.objectPath;
        }
      } catch {
      }

      await signAgreement({ data: { legalName, signatureObjectPath } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push("/(onboarding)/home");
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const e = err as { message?: string };
      setErrorMsg(e?.message ?? "Signature failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const s = makeStyles(colors);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const canSign = scrolledToBottom && legalName.trim().length > 0 && accepted && hasDrawnSignature;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={s.progressRow}>
          {STEPS.map((_, i) => (
            <View key={i} style={[s.progressDot, { backgroundColor: colors.primary }]} />
          ))}
        </View>
        <Text style={[s.stepLabel, { color: colors.mutedForeground }]}>Step 6 of 6 · Final Step</Text>
        <Text style={[s.stepTitle, { color: colors.foreground }]}>Driver Agreement</Text>
      </View>

      {loadingAgreement ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : agreement ? (
        <>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
            showsVerticalScrollIndicator
            onMomentumScrollEnd={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) setScrolledToBottom(true);
            }}
            onScrollEndDrag={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) setScrolledToBottom(true);
            }}
          >
            <View style={[s.agreementBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.agreementTitle, { color: colors.foreground }]}>{agreement.title}</Text>
              <Text style={[s.agreementMeta, { color: colors.mutedForeground }]}>
                Version {agreement.version}
                {(agreement as Agreement & { effectiveDate?: string }).effectiveDate
                  ? ` · Effective ${new Date((agreement as Agreement & { effectiveDate?: string }).effectiveDate!).toLocaleDateString("en-ZA")}`
                  : ""}
              </Text>
              <Markdown style={markdownStyles}>
                {renderedContent}
              </Markdown>
            </View>

            {!scrolledToBottom && (
              <View style={[s.scrollHint, { backgroundColor: colors.muted }]}>
                <Feather name="chevrons-down" size={16} color={colors.mutedForeground} />
                <Text style={[s.scrollHintText, { color: colors.mutedForeground }]}>
                  Scroll to the bottom to enable signing
                </Text>
              </View>
            )}

            <View style={[s.signingSection, { opacity: scrolledToBottom ? 1 : 0.45 }]}>
              <View style={{ gap: 6, marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>
                  Your Legal Full Name
                </Text>
                <TextInput
                  style={[s.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
                  placeholder="As it appears on your SA ID"
                  placeholderTextColor={colors.mutedForeground}
                  value={legalName}
                  onChangeText={setLegalName}
                  autoCapitalize="words"
                  editable={scrolledToBottom}
                />
              </View>

              <View style={{ gap: 8, marginBottom: 16 }}>
                <View style={s.sigLabelRow}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>
                    Draw Your Signature
                  </Text>
                  {hasDrawnSignature && (
                    <Pressable onPress={handleClearSignature} style={s.clearBtn}>
                      <Feather name="rotate-ccw" size={13} color={colors.mutedForeground} />
                      <Text style={[s.clearBtnText, { color: colors.mutedForeground }]}>Clear</Text>
                    </Pressable>
                  )}
                </View>
                <SignaturePad
                  strokes={strokes}
                  onStrokesChange={setStrokes}
                  color={colors.primary}
                  borderColor={hasDrawnSignature ? colors.primary : colors.border}
                  backgroundColor={colors.card}
                  disabled={!scrolledToBottom}
                />
              </View>

              <Pressable
                style={s.checkRow}
                onPress={() => { if (scrolledToBottom) { setAccepted((v) => !v); Haptics.selectionAsync(); } }}
                disabled={!scrolledToBottom}
              >
                <View style={[s.checkbox, { borderColor: accepted ? colors.primary : colors.border, backgroundColor: accepted ? colors.primary : "transparent" }]}>
                  {accepted && <Feather name="check" size={12} color="#fff" />}
                </View>
                <Text style={[s.checkText, { color: colors.foreground }]}>
                  I have read the full agreement and agree to be bound by its terms
                </Text>
              </Pressable>

              {accepted && legalName.trim() && hasDrawnSignature && (
                <View style={[s.signaturePreview, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="edit-3" size={14} color={colors.primary} />
                  <Text style={[s.sigPreviewText, { color: colors.foreground }]}>
                    Signed electronically as{" "}
                    <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>{legalName.trim()}</Text>{"\n"}
                    <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 11 }}>
                      {formatDateTime(signatureTimestamp)} · Version {agreement.version}
                    </Text>
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={[s.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 24 : 16) }]}>
            {!!errorMsg && (
              <View style={[s.errorBox, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
                <Feather name="alert-circle" size={14} color="#B91C1C" />
                <Text style={s.errorText}>{errorMsg}</Text>
              </View>
            )}
            <Pressable
              style={({ pressed }) => [s.signBtn, { backgroundColor: canSign ? colors.primary : colors.muted, opacity: pressed ? 0.85 : 1 }]}
              onPress={handleSign}
              disabled={isLoading || !canSign}
              testID="sign-btn"
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="edit-3" size={18} color={canSign ? "#fff" : colors.mutedForeground} />
                  <Text style={[s.signBtnText, { color: canSign ? "#fff" : colors.mutedForeground }]}>
                    Sign Agreement
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </>
      ) : (
        <View style={s.emptyState}>
          <Feather name="file-text" size={36} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No active agreement found</Text>
          <Text style={[s.emptyBody, { color: colors.mutedForeground }]}>Please contact EcoRide support</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: { paddingHorizontal: 24, paddingBottom: 16 },
    backBtn: { marginBottom: 12, alignSelf: "flex-start" },
    progressRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
    progressDot: { flex: 1, height: 4, borderRadius: 2 },
    stepLabel: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 4 },
    stepTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
    scroll: { flex: 1 },
    agreementBox: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
    agreementTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
    agreementMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12 },
    scrollHint: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, marginBottom: 8 },
    scrollHintText: { fontSize: 13, fontFamily: "Inter_400Regular" },
    signingSection: { gap: 4 },
    input: { height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular" },
    sigLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    clearBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    clearBtnText: { fontSize: 12, fontFamily: "Inter_400Regular" },
    checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 8 },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 2 },
    checkText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
    signaturePreview: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 16 },
    sigPreviewText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
    footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
    errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#B91C1C" },
    signBtn: { height: 54, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
    signBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
    emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
    emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular" },
  });
