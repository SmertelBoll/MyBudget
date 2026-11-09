import { useRef, useState, type ReactNode } from "react";
import { type LayoutRectangle, type StyleProp, type ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

// Spec 5.1, 7.1: a long press lifts an item, it follows the finger, the others make room, letting go puts it there.
// Works for a column (accounts) and a wrapping grid (categories): the place is found from the items' measured
// rectangles, not from a fixed row height.

const LIFT_AFTER_MS = 300;

type Props<T> = {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, state: { dragging: boolean }) => ReactNode;
  // The new order (all keys) when an item was dropped somewhere else.
  onReorder: (keys: string[]) => void;
  // While an item is lifted (e.g. to stop the page scrolling under the finger).
  onDragChange?: (dragging: boolean) => void;
  style?: StyleProp<ViewStyle>;
  // Each item's box: e.g. width "25%" in a grid.
  itemStyle?: StyleProp<ViewStyle>;
};

type Drag = { key: string; origin: LayoutRectangle; dx: number; dy: number };

export function Reorderable<T>({ items, keyOf, renderItem, onReorder, onDragChange, style, itemStyle }: Props<T>) {
  // The live order while dragging, and the items it was made from: once the saved order arrives (new items), it's
  // dropped by itself. The ref is what the gesture callbacks read.
  const [live, setLive] = useState<{ keys: string[]; from: T[] } | null>(null);
  const liveRef = useRef<string[] | null>(null);
  const setOrder = (keys: string[] | null) => {
    liveRef.current = keys;
    setLive(keys ? { keys, from: items } : null);
  };
  const [dragKey, setDragKey] = useState<string | null>(null);
  const layouts = useRef(new Map<string, LayoutRectangle>());
  const drag = useRef<Drag | null>(null);
  // Right after a move the measured rectangles are the old ones until the items are laid out again; testing
  // against them would swap the same two items back and forth.
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lift = useSharedValue(0);

  const byKey = new Map(items.map((item) => [keyOf(item), item]));
  const order = live && (dragKey || live.from === items) ? live.keys : null;
  const keys = (order ?? items.map(keyOf)).filter((key) => byKey.has(key));

  // Where the lifted item is drawn: its first place plus the finger's travel, minus the slot it sits in now.
  const place = () => {
    const current = drag.current;
    const slot = current && layouts.current.get(current.key);
    if (!current || !slot) return;
    tx.set(current.origin.x + current.dx - slot.x);
    ty.set(current.origin.y + current.dy - slot.y);
  };

  const start = (key: string) => {
    const origin = layouts.current.get(key);
    if (!origin) return;
    drag.current = { key, origin, dx: 0, dy: 0 };
    setOrder(items.map(keyOf));
    setDragKey(key);
    lift.set(withTiming(1, { duration: 120 }));
    onDragChange?.(true);
  };

  const move = (dx: number, dy: number) => {
    const current = drag.current;
    if (!current) return;
    current.dx = dx;
    current.dy = dy;
    place();
    if (settling.current) return;
    // The item under the lifted one's center takes its place in the order.
    const cx = current.origin.x + dx + current.origin.width / 2;
    const cy = current.origin.y + dy + current.origin.height / 2;
    const list = liveRef.current ?? items.map(keyOf);
    const target = list.find((key) => {
      if (key === current.key) return false;
      const rect = layouts.current.get(key);
      return rect && cx >= rect.x && cx <= rect.x + rect.width && cy >= rect.y && cy <= rect.y + rect.height;
    });
    if (!target) return;
    const next = list.filter((key) => key !== current.key);
    next.splice(list.indexOf(target), 0, current.key);
    setOrder(next);
    settling.current = setTimeout(() => {
      settling.current = null;
    }, 120);
  };

  const end = () => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    const final = liveRef.current ?? items.map(keyOf);
    const changed = final.some((key, index) => key !== keyOf(items[index]));
    tx.set(withTiming(0, { duration: 150 }));
    ty.set(withTiming(0, { duration: 150 }));
    lift.set(withTiming(0, { duration: 150 }));
    setDragKey(null);
    onDragChange?.(false);
    if (changed) onReorder(final);
    else setOrder(null);
  };

  return (
    <Animated.View style={style}>
      {keys.map((key) => (
        <Item
          key={key}
          dragging={key === dragKey}
          style={itemStyle}
          tx={tx}
          ty={ty}
          lift={lift}
          onLayout={(rect) => {
            layouts.current.set(key, rect);
            if (drag.current?.key === key) {
              place();
              if (settling.current) clearTimeout(settling.current);
              settling.current = null;
            }
          }}
          onStart={() => start(key)}
          onMove={move}
          onEnd={end}
        >
          {renderItem(byKey.get(key)!, { dragging: key === dragKey })}
        </Item>
      ))}
    </Animated.View>
  );
}

type Shared = ReturnType<typeof useSharedValue<number>>;

function Item({
  children,
  dragging,
  style,
  tx,
  ty,
  lift,
  onLayout,
  onStart,
  onMove,
  onEnd,
}: {
  children: ReactNode;
  dragging: boolean;
  style?: StyleProp<ViewStyle>;
  tx: Shared;
  ty: Shared;
  lift: Shared;
  onLayout: (rect: LayoutRectangle) => void;
  onStart: () => void;
  onMove: (dx: number, dy: number) => void;
  onEnd: () => void;
}) {
  const pan = usePanGesture({
    runOnJS: true,
    activateAfterLongPress: LIFT_AFTER_MS,
    // Once lifted, the press underneath (open the item) is cancelled.
    cancelsJSResponder: true,
    onActivate: onStart,
    onUpdate: (event) => onMove(event.translationX, event.translationY),
    onDeactivate: onEnd,
    onFinalize: onEnd,
  });

  const animated = useAnimatedStyle(() =>
    dragging
      ? {
          zIndex: 10,
          transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: 1 + lift.get() * 0.04 }],
          opacity: 1 - lift.get() * 0.1,
        }
      : { zIndex: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }], opacity: 1 }
  );

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[style, animated]} onLayout={(event) => onLayout(event.nativeEvent.layout)}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
