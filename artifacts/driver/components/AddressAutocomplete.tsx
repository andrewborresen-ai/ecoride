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
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress: (components: AddressComponents) => void;
  placeholder?: string;
  errorMsg?: string;
}

export function AddressAutocomplete({
  label,
  value,
  onChangeText,
  onSelectAddress,
  placeholder = "Start typing your address…",
  errorMsg,
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
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(input)}` +
        `&types=address` +
        `&components=country:za` +
        `&key=${GOOGLE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "OK") {
        setPredictions(data.predictions ?? []);
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
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}` +
      `&fields=address_components` +
      `&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const comps: { long_name: string; short_name: string; types: string[] }[] =
      data.result?.address_components ?? [];

    const get = (...types: string[]) =>
      comps.find((c) => types.some((t) => c.types.includes(t)))?.long_name ?? "";

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
    onChangeText(prediction.description);
    setLoading(true);
    try {
      const components = await fetchPlaceDetails(prediction.place_id);
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
      <View style={[s.inputRow, { borderColor: errorMsg ? "#EF4444" : colors.border, backgroundColor: colors.card }]}>
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
      {!!errorMsg && (
        <Text style={s.errorText}>{errorMsg}</Text>
      )}

      {showDropdown && predictions.length > 0 && (
        <View style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FlatList
            data={predictions}
            keyExtractor={(p) => p.place_id}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: colors.border }]} />}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [s.suggestion, { backgroundColor: pressed ? colors.muted : "transparent" }]}
                onPress={() => handleSelect(item)}
              >
                <Feather name="map-pin" size={13} color={colors.primary} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.mainText, { color: colors.foreground }]} numberOfLines={1}>
                    {item.structured_formatting.main_text}
                  </Text>
                  <Text style={[s.secondaryText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.structured_formatting.secondary_text}
                  </Text>
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
    errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#EF4444", marginTop: 4 },
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
