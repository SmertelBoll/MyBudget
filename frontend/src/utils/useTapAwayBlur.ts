import { useRef } from "react";
import { findNodeHandle, Keyboard, TextInput, type GestureResponderEvent } from "react-native";

const TAP_SLOP = 10;

type Touch = { focused: unknown; x: number; y: number; onFocused: boolean };

// Forms keep taps on their buttons working while the keyboard is up (keyboardShouldPersistTaps), so the amount field
// kept its focus and the keyboard stayed open. Spread these on the screen's root view: a tap anywhere outside the
// focused field (a chip, a button, empty space) closes the keyboard. A drag (scrolling) doesn't, and a tap on another
// field just moves the focus there.
export function useTapAwayBlur() {
  const touch = useRef<Touch | null>(null);

  const onTouchStart = (event: GestureResponderEvent) => {
    const focused = TextInput.State.currentlyFocusedInput();
    if (!focused) {
      touch.current = null;
      return;
    }
    const target = event.nativeEvent.target as unknown;
    const onFocused = (event.target as unknown) === focused || target === findNodeHandle(focused as never);
    touch.current = { focused, x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, onFocused };
  };

  const onTouchEnd = (event: GestureResponderEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || start.onFocused) return;
    const moved = Math.abs(event.nativeEvent.pageX - start.x) > TAP_SLOP || Math.abs(event.nativeEvent.pageY - start.y) > TAP_SLOP;
    if (moved) return;
    // After the tap has done its work: if it focused another field, the focus has moved and there is nothing to close.
    setTimeout(() => {
      if (TextInput.State.currentlyFocusedInput() === start.focused) Keyboard.dismiss();
    }, 50);
  };

  return { onTouchStart, onTouchEnd };
}
