import { confirmSig, latestBlockhash, sendRaw, type SendResult } from "@/lib/desk/live-chain";
import { activeAddress, useLive } from "@/lib/desk/live-store";

const SECRET_KEY = "keel-live-secret";

type SolProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString(): string } }>;
  signAndSendTransaction?: (tx: unknown) => Promise<{ signature: string } | string>;
  signTransaction?: (tx: unknown) => Promise<{ serialize(): Uint8Array }>;
};

function browserWindow(): (Window & { solana?: SolProvider; solflare?: SolProvider }) | null {
  if (typeof window === "undefined") return null;
  return window as Window & { solana?: SolProvider; solflare?: SolProvider };
}

export function getProvider(): SolProvider | null {
  const w = browserWindow();
  if (!w) return null;
  if (w.solana?.isPhantom) return w.solana;
  if (w.solflare?.connect) return w.solflare;
  if (w.solana?.connect) return w.solana;
  return null;
}

export function readSecret(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(SECRET_KEY);
  return value && value.length > 20 ? value : null;
}

export function writeSecret(value: string | null) {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(SECRET_KEY, value);
  else window.localStorage.removeItem(SECRET_KEY);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function sigOf(result: unknown): string {
  if (typeof result === "string" && result.length > 20) return result;
  if (result && typeof result === "object" && "signature" in result) return String(result.signature);
  throw new Error("The wallet did not return a signature.");
}

async function keypairFromSecret(secret: string) {
  const { Keypair } = await import("@solana/web3.js");
  const bs58 = (await import("bs58")).default;
  const bytes = bs58.decode(secret.trim());
  if (bytes.length === 64) return Keypair.fromSecretKey(Uint8Array.from(bytes));
  if (bytes.length === 32) return Keypair.fromSeed(Uint8Array.from(bytes));
  throw new Error("That is not a Solana secret key.");
}

export async function createDeskKey(): Promise<string> {
  const { Keypair } = await import("@solana/web3.js");
  const bs58 = (await import("bs58")).default;
  const kp = Keypair.generate();
  const secret = bs58.encode(Uint8Array.from(kp.secretKey));
  writeSecret(secret);
  const pub = kp.publicKey.toBase58();
  useLive.getState().patch({ deskPubkey: pub, signer: "desk" });
  return pub;
}

export async function importDeskKey(secret: string): Promise<string> {
  const kp = await keypairFromSecret(secret);
  const bs58 = (await import("bs58")).default;
  writeSecret(bs58.encode(Uint8Array.from(kp.secretKey)));
  const pub = kp.publicKey.toBase58();
  useLive.getState().patch({ deskPubkey: pub, signer: "desk" });
  return pub;
}

export function forgetDeskKey() {
  writeSecret(null);
  const state = useLive.getState();
  state.patch({
    deskPubkey: "",
    armed: state.signer === "desk" ? false : state.armed,
    status: state.signer === "desk" ? "Desk key removed. Live is off." : state.status,
  });
}

export async function bootLive() {
  if (useLive.persist.hasHydrated()) {
    /* already */
  } else {
    await useLive.persist.rehydrate();
  }
  const secret = readSecret();
  if (!secret) {
    const state = useLive.getState();
    state.patch({
      deskPubkey: "",
      armed: state.signer === "desk" ? false : state.armed,
    });
    return;
  }
  try {
    const kp = await keypairFromSecret(secret);
    useLive.getState().patch({ deskPubkey: kp.publicKey.toBase58() });
  } catch {
    forgetDeskKey();
  }
}

export async function connectPhantom(): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("No Solana wallet in this browser. Use a desk key, or open KEEL in Phantom's browser.");
  const res = await provider.connect();
  const pub = res.publicKey?.toString() || provider.publicKey?.toString() || "";
  if (!pub) throw new Error("The wallet did not share an address.");
  useLive.getState().patch({ phantom: pub });
  return pub;
}

export async function reconnectPhantom() {
  const provider = getProvider();
  if (!provider) return;
  try {
    const res = await provider.connect({ onlyIfTrusted: true });
    const pub = res.publicKey?.toString() || provider.publicKey?.toString() || "";
    if (pub) useLive.getState().patch({ phantom: pub });
  } catch {
    /* user has not approved this site */
  }
}

export async function signAndSend(txB64: string): Promise<SendResult> {
  const state = useLive.getState();
  if (state.signer === "phantom") {
    const provider = getProvider();
    if (!provider || !state.phantom) return { ok: false, signature: null, error: "Connect a wallet before live signs." };
    const { VersionedTransaction } = await import("@solana/web3.js");
    const tx = VersionedTransaction.deserialize(b64ToBytes(txB64));
    try {
      if (provider.signAndSendTransaction) {
        const signature = sigOf(await provider.signAndSendTransaction(tx));
        return confirmSig({ data: { signature } });
      }
      if (provider.signTransaction) {
        const signed = await provider.signTransaction(tx);
        return sendRaw({ data: { raw: bytesToBase64(signed.serialize()) } });
      }
      return { ok: false, signature: null, error: "This wallet cannot sign a swap." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The wallet refused the swap.";
      return { ok: false, signature: null, error: message.slice(0, 180) };
    }
  }

  const secret = readSecret();
  if (!secret) return { ok: false, signature: null, error: "Desk key is missing." };
  try {
    const kp = await keypairFromSecret(secret);
    if (kp.publicKey.toBase58() !== state.deskPubkey) {
      return { ok: false, signature: null, error: "Desk key does not match the address on screen." };
    }
    const { VersionedTransaction } = await import("@solana/web3.js");
    const tx = VersionedTransaction.deserialize(b64ToBytes(txB64));
    tx.sign([kp]);
    return sendRaw({ data: { raw: bytesToBase64(tx.serialize()) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sign with the desk key.";
    return { ok: false, signature: null, error: message.slice(0, 180) };
  }
}

export async function fundDesk(sol: number): Promise<SendResult> {
  const provider = getProvider();
  const state = useLive.getState();
  if (!provider || !state.phantom) return { ok: false, signature: null, error: "Connect a wallet to fund the desk key." };
  if (!state.deskPubkey) return { ok: false, signature: null, error: "Create a desk key first." };
  if (!(sol >= 0.02) || sol > 50) return { ok: false, signature: null, error: "Fund between 0.02 and 50 SOL." };
  const hash = await latestBlockhash();
  if (!hash.ok || !hash.blockhash) return { ok: false, signature: null, error: hash.error ?? "No blockhash." };
  try {
    const { Transaction, SystemProgram, PublicKey } = await import("@solana/web3.js");
    const from = new PublicKey(state.phantom);
    const to = new PublicKey(state.deskPubkey);
    const tx = new Transaction({ feePayer: from, recentBlockhash: hash.blockhash });
    tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: Math.round(sol * 1_000_000_000) }));
    if (provider.signAndSendTransaction) {
      const signature = sigOf(await provider.signAndSendTransaction(tx));
      return confirmSig({ data: { signature } });
    }
    if (!provider.signTransaction) return { ok: false, signature: null, error: "This wallet cannot send SOL." };
    const signed = await provider.signTransaction(tx);
    return sendRaw({ data: { raw: bytesToBase64(signed.serialize()) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Funding was refused.";
    return { ok: false, signature: null, error: message.slice(0, 180) };
  }
}

export function signerReady(): boolean {
  const state = useLive.getState();
  return activeAddress(state).length > 0;
}
