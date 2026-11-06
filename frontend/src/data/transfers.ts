import { newId } from "./accounts";
import { removeEntity, saveEntity } from "./store";
import type { Transfer } from "./types";

// Screen 10. A new transfer is stamped with the device time: that is what the balance rule compares (spec 5.4).
export const saveTransfer = async (
  fields: Pick<Transfer, "fromAccountId" | "toAccountId" | "amountFrom" | "amountTo" | "date" | "comment">,
  existing?: Transfer
) => {
  const transfer: Transfer = {
    ...existing,
    id: existing?.id ?? newId(),
    ...fields,
    rate: fields.amountTo / fields.amountFrom,
    clientCreatedAt: existing?.clientCreatedAt ?? new Date().toISOString(),
  };
  await saveEntity("transfers", transfer);
  return transfer;
};

export const deleteTransfer = (id: string) => removeEntity("transfers", id);
