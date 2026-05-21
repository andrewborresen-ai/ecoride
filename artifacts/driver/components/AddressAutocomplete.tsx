import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet,
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
  fullText: string;
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
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
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
          includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
        }),
      });
      const data = await res.json();
      if (data.suggestions?.length) {
        const preds: Prediction[] = data.suggestions.map((s: any) => ({
          placeId: s.placePrediction.placeId,
          mainText: s.placePrediction.structuredFormat.mainText.text,
          secondaryText: s.placePrediction.structuredFormat.secondaryText?.text ?? "",
          fullText: s.placePrediction.text.text,
        }));
        setPredictions(preds);
        setShowDropdown(true);
      } else {
        setPredictions([]);
        setShowDropdown(false);
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
    const comps: { longText: string; shortText: string; types: string[] }[] =
      data.addressComponents ?? [];

    const get = (...types: string[]) =>
      comps.find((c) => types.some((t) => c.types.includes(t)))?.longText ?? "";

    const streetNumber = get("street_number");
    const route = get("route");
    const streetAddress = [streetNumber, route].filter(Boolean).join(" ");
    const suburb = get("sublocality_level_1", "sublocality", "neighborhood");
    const city = get("locality", "administrative_area_level_2");
    const province = get("administrative_area_level_1");
    const postalCode = get("postal_code");

    return { streetAddress, suburb, city, province, postalCode };
  };

  const handleSelect = async (prediction: Prediction) => {
    Keyboard.dismiss();
    setShowDropdown(false);
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
        {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />}
        {!loading && value.length > 0 && (
          <Pressable
            onPress={() => { onChangeText(""); setPredictions([]); setShowDropdown(false); }}
            style={{ marginRight: 12 }}
            hitSlop={8}
          >
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {showDropdown && predictions.length > 0 && (
        <View style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FlatList
            data={predictions}
            keyExtractor={(p) => p.placeId}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: colors.border }]} />}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [s.suggestion, { backgroundColor: pressed ? colors.muted : "transparent" }]}
                onPress={() => handleSelect(item)}
              >
                <Feather name="map-pin" size={13} color={colors.primary} style={{ marginTop: 2 }} />
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
            )}
          />
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    wrapper: { marginBottom: 16, zIndex: 10 },
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
    dropdown: {
      position: "absolute",
      top: 82,
      left: 0,
      right: 0,
      borderWidth: 1.5,
      borderRadius: 12,
      overflow: "hidden",
      zIndex: 100,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
    suggestion: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    separator: { height: 1 },
    mainText: { fontSize: 14, fontFamily: "Inter_500Medium" },
    secondaryText: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  });
