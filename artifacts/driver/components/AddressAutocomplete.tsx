import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Keyboard,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export interface AddressComponents {
  streetAddress: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
}

interface Prediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress: (components: AddressComponents) => void;
  placeholder?: string;
}

export function AddressAutocomplete({
  label,
  value,
  onChangeText,
  onSelectAddress,
  placeholder = "Start typing your address…",
}: Props) {
  const colors = useColors();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_API_KEY,
        },
        body: JSON.stringify({
          input,
          includedRegionCodes: ["za"],
        }),
      });
      const data = await res.json();
      if (data.suggestions?.length) {
        setPredictions(
          data.suggestions.map((s: any) => ({
            placeId: s.placePrediction.placeId,
            mainText: s.placePrediction.structuredFormat.mainText.text,
            secondaryText: s.placePrediction.structuredFormat.secondaryText?.text ?? "",
          }))
        );
      } else {
        setPredictions([]);
      }
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(text), 350);
  };

  const fetchPlaceDetails = async (placeId: string): Promise<AddressComponents> => {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?fields=addressComponents`,
      { headers: { "X-Goog-Api-Key": GOOGLE_API_KEY } }
    );
    const data = await res.json();
    const comps: { longText: string; types: string[] }[] = data.addressComponents ?? [];
    const get = (...types: string[]) =>
      comps.find((c) => types.some((t) => c.types.includes(t)))?.longText ?? "";

    return {
      streetAddress: [get("street_number"), get("route")].filter(Boolean).join(" "),
      suburb: get("sublocality_level_1", "sublocality", "neighborhood"),
      city: get("locality", "administrative_area_level_2"),
      province: get("administrative_area_level_1"),
      postalCode: get("postal_code"),
    };
  };

  const handleSelect = async (prediction: Prediction) => {
    Keyboard.dismiss();
    setPredictions([]);
    onChangeText(prediction.mainText);
    setLoading(true);
    try {
      const components = await fetchPlaceDetails(prediction.placeId);
      onSelectAddress(components);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <View style={s.wrapper}>
      <Text style={[s.label, { color: colors.foreground }]}>{label}</Text>

      <View style={[s.inputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Feather name="map-pin" size={16} color={colors.mutedForeground} style={{ marginLeft: 14 }} />
        <TextInput
          style={[s.input, { color: colors.foreground }]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={handleChangeText}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />
        ) : value.length > 0 ? (
          <Pressable
            onPress={() => { onChangeText(""); setPredictions([]); }}
            style={{ marginRight: 12 }}
            hitSlop={8}
          >
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {predictions.length > 0 && (
        <View style={[s.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {predictions.map((item, index) => (
            <Pressable
              key={item.placeId}
              style={({ pressed }) => [
                s.suggestion,
                index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                { backgroundColor: pressed ? colors.muted : "transparent" },
              ]}
              onPress={() => handleSelect(item)}
            >
              <Feather name="map-pin" size={13} color={colors.primary} style={{ marginTop: 2, flexShrink: 0 }} />
              <View style={{ flex: 1 }}>
                <Text style={[s.mainText, { color: colors.foreground }]} numberOfLines={1}>
                  {item.mainText}
                </Text>
                {!!item.secondaryText && (
                  <Text style={[s.secondaryText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.secondaryText}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    wrapper: { marginBottom: 16 },
    label: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 6 },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      height: 52,
      borderWidth: 1.5,
      borderRadius: 12,
      gap: 8,
    },
    input: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      paddingVertical: 0,
    },
    suggestions: {
      marginTop: 4,
      borderWidth: 1.5,
      borderRadius: 12,
      overflow: "hidden",
    },
    suggestion: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    mainText: { fontSize: 14, fontFamily: "Inter_500Medium" },
    secondaryText: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  });
