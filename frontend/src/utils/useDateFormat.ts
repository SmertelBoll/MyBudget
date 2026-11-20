import { useAuth } from "@/auth/AuthProvider";
import { toDateFormat } from "./dates";

// The user's numeric date format (Settings -> Advanced); day first until one is picked.
export const useDateFormat = () => toDateFormat(useAuth().user?.settings.dateFormat);
