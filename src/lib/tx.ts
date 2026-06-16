import type { Hash, PublicClient } from "viem";
import { TX_RECEIPT_TIMEOUT } from "@/lib/constants";

/** waitForTransactionReceipt resolves on revert instead of throwing; check status here so every caller fails loudly. */
export async function waitForSuccessfulReceipt(client: PublicClient, hash: Hash) {
  const receipt = await client.waitForTransactionReceipt({
    hash,
    timeout: TX_RECEIPT_TIMEOUT,
  });
  if (receipt.status === "reverted") {
    throw new Error("Transaction reverted on-chain");
  }
  return receipt;
}
