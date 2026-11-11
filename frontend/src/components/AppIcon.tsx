import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

// Icons the Material set doesn't have, drawn on its 24-unit grid. `background` is the color under the icon: spots and
// eyes are cut out in it.
type Drawing = (color: string, background: string) => React.ReactNode;

const CUSTOM: Record<string, Drawing> = {
  giraffe: (fg, bg) => (
    <>
      <Rect x={3.5} y={10.4} width={11.6} height={5.6} rx={2.6} fill={fg} />
      <Path d="M10.4 12 L14.8 12.4 L18.8 5.4 L15.2 3.9 Z" fill={fg} />
      <Path d="M14.6 3.6 L18.6 2.3 Q21.3 2.3 21.6 4.4 L21.4 5.2 Q20.6 6.7 18.8 6.5 L16 6.9 Z" fill={fg} />
      <Rect x={15.5} y={0.5} width={1.3} height={3.2} rx={0.65} fill={fg} />
      <Rect x={17.4} y={0.2} width={1.3} height={3.2} rx={0.65} fill={fg} />
      <Ellipse cx={14.9} cy={3.7} rx={1.2} ry={0.6} transform="rotate(-25 14.9 3.7)" fill={fg} />
      {[4, 6.7, 10.8, 13.2].map((x) => (
        <Rect key={x} x={x} y={14} width={2} height={8.6} rx={1} fill={fg} />
      ))}
      <Path d="M3.9 11.6 L2.3 15.8" stroke={fg} strokeWidth={1.1} strokeLinecap="round" />
      <Circle cx={2.2} cy={16.5} r={0.95} fill={fg} />
      {[
        [7.1, 12.6, 1.15],
        [10.4, 13.3, 1],
        [12.9, 11.8, 0.75],
        [14.6, 9.8, 0.7],
        [16.3, 7.1, 0.6],
        [19.6, 4.2, 0.55],
      ].map(([cx, cy, r]) => (
        <Circle key={`${cx}`} cx={cx} cy={cy} r={r} fill={bg} />
      ))}
    </>
  ),
};

export type CustomIconName = "giraffe";

export const isKnownIcon = (name: string) => name in CUSTOM || name in MaterialCommunityIcons.glyphMap;

// A Material icon, or one of ours by the same kind of name (stored the same way in accounts, categories, avatars).
export function AppIcon({ name, size, color, background }: { name: string; size: number; color: string; background: string }) {
  const draw = CUSTOM[name];
  if (draw) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {draw(color, background)}
      </Svg>
    );
  }
  return <MaterialCommunityIcons name={name as keyof typeof MaterialCommunityIcons.glyphMap} size={size} color={color} />;
}
