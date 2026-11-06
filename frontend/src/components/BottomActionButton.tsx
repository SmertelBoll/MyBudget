import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing } from "@/theme/tokens";
import { Button } from "./Button";

type Props = React.ComponentProps<typeof Button>;

// Pinned to the bottom of the screen, independent of scrolling (spec 2.7). Content above it needs
// paddingBottom: BOTTOM_ACTION_SPACE so the last item stays reachable.
export function BottomActionButton(props: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: insets.bottom + spacing.md,
        alignItems: "center",
      }}
    >
      {/* Floats over the content, not inside a card: the one place a fully round button is kept. */}
      <Button {...props} style={[{ minWidth: 220, minHeight: 56, borderRadius: radius.pill }, props.style]} />
    </View>
  );
}
