// Anvil JSON-RPC access and canonical mainnet-fork fixtures shared by the e2e and fork suites.

export const RPC = "http://localhost:8545";

// Canonical stuck-user (Koen's case) and the contracts the suites read/write.
export const CANONICAL_USER = "0x78FA029F04251cc810DFF72CCC7B4764DBC16899";
export const CANONICAL_ATP = "0x2C4464618f9b5d7601bED221Ad02cABB285245D8";
export const CANONICAL_STAKER = "0xEaDd1e65dCCeB249156bB3E558479418E19B4fC0";
export const AZT = "0xa27Ec0006E59F245217ff08CD52A7E8b169e62d2";
export const GOV = "0x1102471eb3378fee427121c9efcea452e4b6b75e";

// Retries network-level failures only; RPC-level errors (j.error) bail immediately.
export async function anvilRpc<T = unknown>(
  method: string,
  params: unknown[] = []
): Promise<T> {
  const ATTEMPTS = 2;
  let lastFetchErr: unknown;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const r = await fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = (await r.json()) as { result?: T; error?: { message: string } };
      if (j.error) throw new Error(`${method}: ${j.error.message}`);
      return j.result as T;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith(`${method}:`)) throw err;
      lastFetchErr = err;
      if (i < ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastFetchErr instanceof Error
    ? new Error(`${method}: ${lastFetchErr.message} (after ${ATTEMPTS} attempts)`)
    : new Error(`${method}: anvil unreachable (after ${ATTEMPTS} attempts)`);
}

export async function snapshot(): Promise<string> {
  return anvilRpc<string>("evm_snapshot");
}

export async function revert(id: string): Promise<void> {
  await anvilRpc("evm_revert", [id]);
}
