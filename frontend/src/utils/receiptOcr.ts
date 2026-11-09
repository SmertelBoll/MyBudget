import { requireOptionalNativeModule } from "expo";
import type { OcrLine } from "@/data/receiptParser";

type ReceiptOcrModule = { recognize: (uri: string) => Promise<{ width: number; height: number; lines: OcrLine[] }> };

// The local native module in modules/receipt-ocr (ML Kit). It's only in an installed build of the app: Expo Go and
// the browser don't have it, and there the receipt is filled in by hand.
const native = requireOptionalNativeModule<ReceiptOcrModule>("ReceiptOcr");

export const canRecognizeReceipts = Boolean(native);

export const recognizeReceipt = async (uri: string): Promise<OcrLine[]> => {
  if (!native) return [];
  return (await native.recognize(uri)).lines;
};
