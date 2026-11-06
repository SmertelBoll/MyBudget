import { useState } from "react";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { KEYBOARD_GAP } from "@/utils/keyboard";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { RepeatRule } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts, radius, spacing } from "@/theme/tokens";
import { formatLongDate, todayLocal } from "@/utils/dates";
import { REPEAT_KINDS, describeCron, describeRule } from "@/utils/repeat";
import { isValidCron, nextOccurrence } from "@/utils/schedule";
import { useDialog } from "./AppDialog";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { FullScreenModal } from "./FullScreenModal";
import { SegmentedSwitch } from "./SegmentedSwitch";
import { TextField } from "./TextField";

const UNITS = ["day", "week", "month"] as const;
// Monday first.
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

const weekdayShort = (day: number, lang: string) => {
  try {
    return new Intl.DateTimeFormat(lang, { weekday: "short" }).format(new Date(2023, 0, 1 + day, 12));
  } catch {
    return String(day);
  }
};

// The next few dates of a rule, so the user sees what it does (spec 8.4: five dates under a cron expression).
const preview = (rule: RepeatRule, startDate: string, time: string, count = 5) => {
  const dates: string[] = [];
  let after = { date: startDate < todayLocal() ? todayLocal() : startDate, time: "" };
  // Today's occurrence counts if its time hasn't passed; "" sorts before any time.
  for (let i = 0; i < count; i++) {
    const next = nextOccurrence({ rule, startDate, time }, after);
    if (!next) break;
    dates.push(`${next.date} ${next.time}`);
    after = next;
  }
  return dates;
};

function CustomEditor({
  initial,
  startDate,
  time,
  onDone,
  onClose,
}: {
  initial: RepeatRule;
  startDate: string;
  time: string;
  onDone: (rule: RepeatRule) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<"builder" | "cron">(initial.cron ? "cron" : "builder");
  const [every, setEvery] = useState(String(initial.every ?? 1));
  const [unit, setUnit] = useState<(typeof UNITS)[number]>(initial.unit ?? "day");
  const [weekdays, setWeekdays] = useState<number[]>(initial.weekdays ?? []);
  const [cron, setCron] = useState(initial.cron ?? "0 9 * * 1");

  const everyNumber = Number(every);
  const builderValid = Number.isInteger(everyNumber) && everyNumber >= 1 && everyNumber <= 365;
  const cronValid = isValidCron(cron);
  const rule: RepeatRule =
    mode === "cron"
      ? { kind: "custom", cron: cron.trim() }
      : { kind: "custom", every: builderValid ? everyNumber : 1, unit, ...(unit === "week" && weekdays.length ? { weekdays } : {}) };
  const valid = mode === "cron" ? cronValid : builderValid;
  const dates = valid ? preview(rule, startDate, time) : [];

  return (
    <FullScreenModal visible title={t("repeat.customTitle")} onClose={onClose}>
      <KeyboardAwareScrollView bottomOffset={KEYBOARD_GAP} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
        <SegmentedSwitch
          options={[
            { value: "builder", label: t("repeat.builder") },
            { value: "cron", label: t("repeat.cron") },
          ]}
          value={mode}
          onChange={setMode}
        />

        {mode === "builder" ? (
          <View style={{ gap: spacing.md }}>
            <TextField
              label={t("repeat.every")}
              value={every}
              onChangeText={(text) => setEvery(text.replace(/\D/g, "").slice(0, 3))}
              keyboardType="number-pad"
              error={builderValid ? undefined : t("common.required")}
            />
            <SegmentedSwitch
              options={UNITS.map((value) => ({
                value,
                label: t(value === "day" ? "repeat.unitDay" : value === "week" ? "repeat.unitWeek" : "repeat.unitMonth"),
              }))}
              value={unit}
              onChange={setUnit}
            />
            {unit === "week" && (
              <View style={{ gap: spacing.xs }}>
                <AppText variant="label">{t("repeat.onDays")}</AppText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                  {WEEKDAYS.map((day) => {
                    const on = weekdays.includes(day);
                    return (
                      <Pressable
                        key={day}
                        onPress={() => setWeekdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]))}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        style={{
                          minWidth: 44,
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.sm,
                          alignItems: "center",
                          borderRadius: radius.md,
                          backgroundColor: on ? colors.accent : colors.tonal,
                        }}
                      >
                        <AppText variant="label" color={on ? colors.onAccent : colors.text} style={{ textTransform: "capitalize" }}>
                          {weekdayShort(day, lang)}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <TextField
              label={t("repeat.cronField")}
              value={cron}
              onChangeText={setCron}
              autoCapitalize="characters"
              autoCorrect={false}
              hint={t("repeat.cronHint")}
              error={cronValid ? undefined : t("repeat.cronInvalid")}
              style={{ fontFamily: fonts.medium }}
            />
            {cronValid && <AppText>{describeCron(cron, lang)}</AppText>}
          </View>
        )}

        {valid && (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label">{t("repeat.nextDates")}</AppText>
            {dates.map((value) => {
              const [date, at] = value.split(" ");
              return (
                <AppText key={value} secondary style={{ textTransform: "capitalize" }}>
                  {formatLongDate(date, lang)}, {at}
                </AppText>
              );
            })}
          </View>
        )}

        <Button title={t("common.ok")} onPress={() => onDone(rule)} disabled={!valid} />
      </KeyboardAwareScrollView>
    </FullScreenModal>
  );
}

// Spec 8.3, 9: the "Repeats" field. Plain choices come from a short list; "Custom" opens the editor (every N days /
// weeks / months with weekdays, or a cron expression with its description and next dates).
export function RepeatPicker({
  value,
  onChange,
  startDate,
  time,
}: {
  value: RepeatRule;
  onChange: (rule: RepeatRule) => void;
  startDate: string;
  time: string;
}) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const dialog = useDialog();
  const [custom, setCustom] = useState(false);

  const choose = async () => {
    const kind = await dialog.choose({
      title: t("recurring.repeat"),
      options: REPEAT_KINDS.map((kind) => ({ value: kind, label: t(`repeat.${kind}`) })),
    });
    if (!kind) return;
    if (kind === "custom") setCustom(true);
    else onChange({ kind: kind as RepeatRule["kind"] });
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{t("recurring.repeat")}</AppText>
      <Pressable
        onPress={choose}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          minHeight: 48,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: colors.selected,
          backgroundColor: pressed ? colors.selected : colors.surface,
        })}
      >
        <AppText style={{ flex: 1 }}>{describeRule(value, t, lang)}</AppText>
        <MaterialCommunityIcons name="repeat" size={22} color={colors.textSecondary} />
      </Pressable>
      {custom && (
        <CustomEditor
          initial={value}
          startDate={startDate}
          time={time}
          onClose={() => setCustom(false)}
          onDone={(rule) => {
            onChange(rule);
            setCustom(false);
          }}
        />
      )}
    </View>
  );
}
