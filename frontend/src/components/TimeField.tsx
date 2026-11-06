import { TextField } from "./TextField";

export const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

// "HH:MM" typed as digits: the colon is put in automatically (0930 -> 09:30). Empty shows the default faintly and
// means "the default" (the parent uses timeOrDefault), so there's nothing to erase before typing.
export const timeOrDefault = (value: string, fallback: string) => value || fallback;

export function TimeField({
  label,
  value,
  onChange,
  error,
  placeholder = "09:00",
}: {
  label: string;
  value: string;
  onChange: (time: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, "").slice(0, 4);
        onChange(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
      }}
      keyboardType="number-pad"
      placeholder={placeholder}
      maxLength={5}
      error={error}
    />
  );
}
