import { createServerFn } from "@tanstack/react-start";
import { isSolanaAddress } from "@/lib/desk/wallet";
import { SOL_MINT } from "@/lib/desk/live-score";

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
const JUP = ["https://lite-api.jup.ag/swap/v1", "https://api.jup.ag/swap/v1"];
const TOKEN_PROGRAMS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
];

export type ScreenResult = {
  ok: boolean;
  reason: string;
  top10: number | null;
  lpLockedPct: number | null;
};

export type SwapBuild = {
  ok: boolean;
  tx: string | null;
  outAmount: string | null;
  impact: number | null;
  error: string | null;
};

export type HoldResult = {
  ok: boolean;
  raw: string;
  ui: number;
  error: string | null;
};

export type SendResult = {
  ok: boolean;
  signature: string | null;
  error: string | null;
};

export type HashResult = {
  ok: boolean;
  blockhash: string | null;
  error: string | null;
};

export type Marks = {
  ok: boolean;
  solUsd: number | null;
  prices: Record<string, number>;
};

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  let last = "The chain did not answer.";
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const body: unknown = await res.json();
      if (!body || typeof body !== "object") continue;
      if ("error" in body && body.error) {
        const message =
          typeof body.error === "object" && body.error && "message" in body.error
            ? String(body.error.message)
            : "The chain refused the request.";
        last = message.slice(0, 180);
        continue;
      }
      return "result" in body ? body.result : null;
    } catch {
      last = "The chain did not answer.";
    }
  }
  throw new Error(last);
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : NaN;
}

function judge(report: unknown, venue: "pump.fun" | "raydium"): ScreenResult {
  if (!report || typeof report !== "object") return { ok: false, reason: "RugCheck returned nothing.", top10: null, lpLockedPct: null };
  const row = report as Record<string, unknown>;
  const token = row.token && typeof row.token === "object" ? (row.token as Record<string, unknown>) : null;
  if (!token) return { ok: false, reason: "RugCheck has no mint record yet.", top10: null, lpLockedPct: null };
  if (!("mintAuthority" in token) || token.mintAuthority != null) {
    return { ok: false, reason: "Mint authority is still live.", top10: null, lpLockedPct: null };
  }
  if (!("freezeAuthority" in token) || token.freezeAuthority != null) {
    return { ok: false, reason: "Freeze authority is still live.", top10: null, lpLockedPct: null };
  }

  const risks = Array.isArray(row.risks) ? row.risks : [];
  for (const risk of risks) {
    if (!risk || typeof risk !== "object") continue;
    const name = "name" in risk ? String(risk.name) : "risk";
    const level = "level" in risk ? String(risk.level).toLowerCase() : "";
    const lower = name.toLowerCase();
    if (level === "danger" || level === "critical") {
      return { ok: false, reason: `RugCheck danger: ${name}.`, top10: null, lpLockedPct: null };
    }
    if (lower.includes("honeypot") || lower.includes("mint authority") || lower.includes("freeze")) {
      return { ok: false, reason: `RugCheck: ${name}.`, top10: null, lpLockedPct: null };
    }
  }

  const pcts: number[] = [];
  if (Array.isArray(row.topHolders)) {
    for (const holder of row.topHolders) {
      if (!holder || typeof holder !== "object" || !("pct" in holder)) continue;
      const pct = num(holder.pct);
      if (Number.isFinite(pct)) pcts.push(pct);
    }
  }
  pcts.sort((a, b) => b - a);
  const usable = pcts[0] !== undefined && pcts[0] > 35 ? pcts.slice(1) : pcts;
  const top10 = usable.slice(0, 10).reduce((sum, pct) => sum + pct, 0);
  const counted = Math.min(10, usable.length);
  if (counted > 0 && top10 > 20) {
    return { ok: false, reason: `Top holders control ${top10.toFixed(1)}% (limit 20%).`, top10, lpLockedPct: null };
  }

  const lp = num(row.lpLockedPct);
  const lpLockedPct = Number.isFinite(lp) ? lp : null;
  if (venue === "raydium" && lpLockedPct !== null && lpLockedPct < 80) {
    return { ok: false, reason: `LP lock is ${lpLockedPct.toFixed(0)}% (need 80% on Raydium).`, top10: counted ? top10 : null, lpLockedPct };
  }

  const holderNote = counted ? `top holders ${top10.toFixed(1)}%` : "holder table missing";
  const lpNote = lpLockedPct === null ? "LP lock unknown" : `LP lock ${lpLockedPct.toFixed(0)}%`;
  return {
    ok: true,
    reason: `Mint and freeze revoked. ${holderNote}. ${lpNote}.`,
    top10: counted ? top10 : null,
    lpLockedPct,
  };
}

export const screenMint = createServerFn({ method: "POST" })
  .validator((input: { mint: string; venue: "pump.fun" | "raydium" }): { mint: string; venue: "pump.fun" | "raydium" } => {
    const mint = input.mint.trim();
    if (!isSolanaAddress(mint)) throw new Error("Bad mint.");
    const venue = input.venue === "raydium" ? "raydium" : "pump.fun";
    return { mint, venue };
  })
  .handler(async ({ data }): Promise<ScreenResult> => {
    try {
      const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${data.mint}/report`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429) return { ok: false, reason: "RugCheck is rate limiting. Skipped this pass.", top10: null, lpLockedPct: null };
      if (!res.ok) return { ok: false, reason: "RugCheck did not answer.", top10: null, lpLockedPct: null };
      return judge(await res.json(), data.venue);
    } catch {
      return { ok: false, reason: "RugCheck did not answer.", top10: null, lpLockedPct: null };
    }
  });

async function quoteOn(host: string, params: URLSearchParams): Promise<{ quote: unknown } | { error: string }> {
  try {
    const res = await fetch(`${host}/quote?${params}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { error: `Jupiter quote failed (${res.status}).` };
    const quote: unknown = await res.json();
    if (!quote || typeof quote !== "object") return { error: "Jupiter quote was empty." };
    if ("error" in quote && quote.error) return { error: String(quote.error).slice(0, 160) };
    return { quote };
  } catch {
    return { error: "Jupiter did not quote." };
  }
}

export const buildSwap = createServerFn({ method: "POST" })
  .validator((input: { user: string; inputMint: string; outputMint: string; amount: string; slippageBps: number }) => {
    const user = input.user.trim();
    const inputMint = input.inputMint.trim();
    const outputMint = input.outputMint.trim();
    const amount = input.amount.trim();
    const slippageBps = Math.round(input.slippageBps);
    if (!isSolanaAddress(user) || !isSolanaAddress(inputMint) || !isSolanaAddress(outputMint)) throw new Error("Bad address.");
    if (!/^\d+$/.test(amount) || amount === "0" || amount.length > 30) throw new Error("Bad amount.");
    if (slippageBps < 30 || slippageBps > 500) throw new Error("Slippage is out of range.");
    return { user, inputMint, outputMint, amount, slippageBps };
  })
  .handler(async ({ data }): Promise<SwapBuild> => {
    const params = new URLSearchParams({
      inputMint: data.inputMint,
      outputMint: data.outputMint,
      amount: data.amount,
      slippageBps: String(data.slippageBps),
    });
    let last = "Jupiter did not quote.";
    for (const host of JUP) {
      const quoted = await quoteOn(host, params);
      if ("error" in quoted) {
        last = quoted.error;
        continue;
      }
      const quote = quoted.quote as { outAmount?: string; priceImpactPct?: string };
      const impact = num(quote.priceImpactPct);
      if (Number.isFinite(impact) && impact > 0.05) {
        return { ok: false, tx: null, outAmount: null, impact, error: `Price impact ${(impact * 100).toFixed(1)}% is over 5%.` };
      }
      try {
        const res = await fetch(`${host}/swap`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            quoteResponse: quoted.quote,
            userPublicKey: data.user,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          last = `Jupiter swap failed (${res.status}).`;
          continue;
        }
        const body: unknown = await res.json();
        if (!body || typeof body !== "object") {
          last = "Jupiter swap was empty.";
          continue;
        }
        if ("simulationError" in body && body.simulationError) {
          return { ok: false, tx: null, outAmount: quote.outAmount ?? null, impact: Number.isFinite(impact) ? impact : null, error: "Jupiter simulation failed." };
        }
        const tx = "swapTransaction" in body ? String(body.swapTransaction) : "";
        if (!tx) {
          last = "Jupiter did not return a transaction.";
          continue;
        }
        return { ok: true, tx, outAmount: quote.outAmount ?? null, impact: Number.isFinite(impact) ? impact : null, error: null };
      } catch {
        last = "Jupiter did not build the swap.";
      }
    }
    return { ok: false, tx: null, outAmount: null, impact: null, error: last };
  });

export const tokenHolding = createServerFn({ method: "POST" })
  .validator((input: { owner: string; mint: string }) => {
    const owner = input.owner.trim();
    const mint = input.mint.trim();
    if (!isSolanaAddress(owner) || !isSolanaAddress(mint)) throw new Error("Bad address.");
    return { owner, mint };
  })
  .handler(async ({ data }): Promise<HoldResult> => {
    try {
      const filters: Array<Record<string, string>> = [{ mint: data.mint }, ...TOKEN_PROGRAMS.map((programId) => ({ programId }))];
      for (const filter of filters) {
        const result = await rpc("getTokenAccountsByOwner", [data.owner, filter, { encoding: "jsonParsed" }]);
        const value =
          result && typeof result === "object" && "value" in result && Array.isArray(result.value) ? result.value : [];
        for (const row of value) {
          if (!row || typeof row !== "object" || !("account" in row)) continue;
          const account = row.account;
          if (!account || typeof account !== "object" || !("data" in account)) continue;
          const parsed =
            account.data && typeof account.data === "object" && "parsed" in account.data ? account.data.parsed : null;
          const info =
            parsed && typeof parsed === "object" && "info" in parsed && parsed.info && typeof parsed.info === "object"
              ? (parsed.info as { mint?: string; tokenAmount?: { amount?: string; uiAmount?: number | null } })
              : null;
          if (!info || info.mint !== data.mint || !info.tokenAmount) continue;
          const raw = String(info.tokenAmount.amount ?? "0");
          const ui = num(info.tokenAmount.uiAmount);
          if (raw !== "0") return { ok: true, raw, ui: Number.isFinite(ui) ? ui : 0, error: null };
        }
      }
      return { ok: true, raw: "0", ui: 0, error: null };
    } catch (error) {
      return { ok: false, raw: "0", ui: 0, error: error instanceof Error ? error.message : "Balance read failed." };
    }
  });

export const markPrices = createServerFn({ method: "POST" })
  .validator((input: { mints: string[] }) => {
    const mints = input.mints.map((mint) => mint.trim()).filter((mint) => isSolanaAddress(mint)).slice(0, 20);
    return { mints: [...new Set([SOL_MINT, ...mints])] };
  })
  .handler(async ({ data }): Promise<Marks> => {
    const prices: Record<string, number> = {};
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${data.mints.join(",")}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return { ok: false, solUsd: null, prices };
      const body: unknown = await res.json();
      const pairs =
        body && typeof body === "object" && "pairs" in body && Array.isArray(body.pairs) ? body.pairs : [];
      const liq = new Map<string, number>();
      for (const pair of pairs) {
        if (!pair || typeof pair !== "object") continue;
        const base = "baseToken" in pair && pair.baseToken && typeof pair.baseToken === "object" ? pair.baseToken : null;
        const mint = base && "address" in base ? String(base.address) : "";
        const price = "priceUsd" in pair ? num(pair.priceUsd) : NaN;
        const pool =
          "liquidity" in pair && pair.liquidity && typeof pair.liquidity === "object" && "usd" in pair.liquidity
            ? num(pair.liquidity.usd)
            : 0;
        if (!mint || !Number.isFinite(price)) continue;
        if ((liq.get(mint) ?? -1) > pool) continue;
        liq.set(mint, Number.isFinite(pool) ? pool : 0);
        prices[mint] = price;
      }
      return { ok: true, solUsd: prices[SOL_MINT] ?? null, prices };
    } catch {
      return { ok: false, solUsd: null, prices };
    }
  });

export const latestBlockhash = createServerFn({ method: "GET" }).handler(async (): Promise<HashResult> => {
  try {
    const result = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
    const blockhash =
      result && typeof result === "object" && "blockhash" in result ? String(result.blockhash) : "";
    if (!blockhash) return { ok: false, blockhash: null, error: "No blockhash." };
    return { ok: true, blockhash, error: null };
  } catch (error) {
    return { ok: false, blockhash: null, error: error instanceof Error ? error.message : "No blockhash." };
  }
});

async function statusOf(signature: string): Promise<"ok" | "err" | "pending"> {
  const status = await rpc("getSignatureStatuses", [[signature], { searchTransactionHistory: false }]);
  const value =
    status && typeof status === "object" && "value" in status && Array.isArray(status.value) ? status.value[0] : null;
  if (!value || typeof value !== "object") return "pending";
  if ("err" in value && value.err) return "err";
  const conf = "confirmationStatus" in value ? String(value.confirmationStatus) : "";
  if (conf === "confirmed" || conf === "finalized") return "ok";
  return "pending";
}

export const confirmSig = createServerFn({ method: "POST" })
  .validator((input: { signature: string }) => {
    const signature = input.signature.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{40,100}$/.test(signature)) throw new Error("Bad signature.");
    return { signature };
  })
  .handler(async ({ data }): Promise<SendResult> => {
    try {
      for (let i = 0; i < 6; i += 1) {
        const state = await statusOf(data.signature);
        if (state === "ok") return { ok: true, signature: data.signature, error: null };
        if (state === "err") return { ok: false, signature: data.signature, error: "The chain rejected the transaction." };
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      return { ok: true, signature: data.signature, error: null };
    } catch (error) {
      return { ok: false, signature: data.signature, error: error instanceof Error ? error.message : "Confirm failed." };
    }
  });

export const sendRaw = createServerFn({ method: "POST" })
  .validator((input: { raw: string }) => {
    const raw = input.raw.trim();
    if (raw.length < 32 || raw.length > 8000) throw new Error("Bad transaction.");
    return { raw };
  })
  .handler(async ({ data }): Promise<SendResult> => {
    try {
      const sig = await rpc("sendTransaction", [
        data.raw,
        { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 2 },
      ]);
      if (typeof sig !== "string" || !sig) return { ok: false, signature: null, error: "The chain did not take the transaction." };
      for (let i = 0; i < 6; i += 1) {
        const state = await statusOf(sig);
        if (state === "ok") return { ok: true, signature: sig, error: null };
        if (state === "err") return { ok: false, signature: sig, error: "The chain rejected the swap." };
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      return { ok: true, signature: sig, error: null };
    } catch (error) {
      return { ok: false, signature: null, error: error instanceof Error ? error.message.slice(0, 180) : "Send failed." };
    }
  });
