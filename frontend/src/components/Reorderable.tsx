import { useEffect, useRef, useState, type ReactNode } from "react";
import { View, type LayoutRectangle, type StyleProp, type ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

// Spec 5.1, 7.1: a long press lifts an item, it follows the finger, the others slide to make room, letting go puts
// it there. Works for a column (accounts) and a wrapping grid (categories).
// Nothing is laid out again while the finger moves: every place ("slot") is measured once when the item is lifted,
// the lifted item is moved by the finger's travel and the others are shifted into their new slots. The new order is
// saved on release, and only then does the list lay itself out again.

const LIFT_AFTER_MS = 300;
const SHIFT_MS = 160;

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

type Shift = { x: SharedValue<number>; y: SharedValue<number> };
type Drag = { from: number; to: number; slots: LayoutRectangle[] };

const inside = (x: number, y: number, rect: LayoutRectangle) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

// Where an item at `index` ends up when the one at `from` moves to `to`.
const newIndex = (index: number, from: number, to: number) => {
  if (index === from) return to;
  if (from < to && index > from && index <= to) return index - 1;
  if (to < from && index >= to && index < from) return index + 1;
  return index;
};

export function Reorderable<T>({ items, keyOf, renderItem, onReorder, onDragChange, style, itemStyle }: Props<T>) {
  const keys = items.map(keyOf);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const layouts = useRef(new Map<string, LayoutRectangle>());
  const [shifts] = useState(() => new Map<string, Shift>());
  const drag = useRef<Drag | null>(null);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lift = useSharedValue(0);

  const shiftOthers = (current: Drag) => {
    keys.forEach((key, index) => {
      if (index === current.from) return;
      const shift = shifts.get(key);
      if (!shift) return;
      const target = current.slots[newIndex(index, current.from, current.to)];
      const own = current.slots[index];
      shift.x.set(withTiming(target.x - own.x, { duration: SHIFT_MS }));
      shift.y.set(withTiming(target.y - own.y, { duration: SHIFT_MS }));
    });
  };

  const start = (key: string) => {
    const slots = keys.map((k) => layouts.current.get(k));
    const from = keys.indexOf(key);
    if (from < 0 || slots.some((slot) => !slot)) return;
    drag.current = { from, to: from, slots: slots as LayoutRectangle[] };
    tx.set(0);
    ty.set(0);
    lift.set(withTiming(1, { duration: 120 }));
    setDragKey(key);
    onDragChange?.(true);
  };

  const move = (dx: number, dy: number) => {
    const current = drag.current;
    if (!current) return;
    tx.set(dx);
    ty.set(dy);
    // The slot under the lifted item's center is where it would go.
    const own = current.slots[current.from];
    const cx = own.x + dx + own.width / 2;
    const cy = own.y + dy + own.height / 2;
    const to = current.slots.findIndex((slot) => inside(cx, cy, slot));
    if (to < 0 || to === current.to) return;
    current.to = to;
    shiftOthers(current);
  };

  const end = () => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    const { from, to, slots } = current;
    lift.set(withTiming(0, { duration: 120 }));
    onDragChange?.(false);
    if (from === to) {
      tx.set(withTiming(0, { duration: SHIFT_MS }));
      ty.set(withTiming(0, { duration: SHIFT_MS }));
      setTimeout(() => setDragKey(null), SHIFT_MS);
      return;
    }
    // Glides into its new slot; then the saved order lays the list out and every shift goes back to zero.
    tx.set(withTiming(slots[to].x - slots[from].x, { duration: SHIFT_MS }));
    ty.set(withTiming(slots[to].y - slots[from].y, { duration: SHIFT_MS }));
    const order = [...keys];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    setTimeout(() => {
      onReorder(order);
      setDragKey(null);
      tx.set(0);
      ty.set(0);
      shifts.forEach((shift) => {
        shift.x.set(0);
        shift.y.set(0);
      });
    }, SHIFT_MS);
  };

  return (
    <View style={style}>
      {items.map((item) => {
        const key = keyOf(item);
        return (
          <Item
            key={key}
            id={key}
            registry={shifts}
            dragging={key === dragKey}
            style={itemStyle}
            tx={tx}
            ty={ty}
            lift={lift}
            onLayout={(rect) => layouts.current.set(key, rect)}
            onStart={() => start(key)}
            onMove={move}
            onEnd={end}
          >
            {renderItem(item, { dragging: key === dragKey })}
          </Item>
        );
      })}
    </View>
  );
}

function Item({
  children,
  id,
  registry,
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
  id: string;
  // Where the list finds this item's shift to move it aside while another one is dragged.
  registry: Map<string, Shift>;
  dragging: boolean;
  style?: StyleProp<ViewStyle>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  lift: SharedValue<number>;
  onLayout: (rect: LayoutRectangle) => void;
  onStart: () => void;
  onMove: (dx: number, dy: number) => void;
  onEnd: () => void;
}) {
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  useEffect(() => {
    registry.set(id, { x: sx, y: sy });
    return () => {
      registry.delete(id);
    };
  }, [registry, id, sx, sy]);

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
          transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: 1 + lift.get() * 0.05 }],
          opacity: 1 - lift.get() * 0.1,
        }
      : { transform: [{ translateX: sx.get() }, { translateY: sy.get() }, { scale: 1 }], opacity: 1 }
  );

  return (
    // Measured on this outer view: on the phone the gesture detector wraps its child in a view of its own, so the
    // child's position would come out as 0, 0 for every item. The lifted item is drawn above its neighbours.
    <View style={[style, { zIndex: dragging ? 10 : 0, elevation: dragging ? 10 : 0 }]} onLayout={(event) => onLayout(event.nativeEvent.layout)}>
      <GestureDetector gesture={pan}>
        <Animated.View style={animated}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
