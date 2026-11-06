import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { IconName } from "@/constants/appearance";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";

// Round "+" pinned to the bottom of list screens (spec 5.1, 7.1, 8.1): floats, so it stays fully round.
export function Fab({ onPress, label, icon = "plus" }: { onPress: () => void; label: string; icon?: IconName }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + spacing.md, alignItems: "center" }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.accentPressed : colors.accent,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        })}
      >
        <MaterialCommunityIcons name={icon} size={32} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}
