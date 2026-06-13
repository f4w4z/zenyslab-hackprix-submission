/**
 * Solana service for the Expo/web app.
 *
 * Architecture: We deliberately avoid importing @solana/web3.js here because
 * Metro bundler cannot resolve its Node-only dependencies (@noble/hashes, borsh, etc.).
 *
 * Instead:
 *   1. The Express server (server/routes/solana.js) uses @solana/web3.js to build
 *      and serialize a Memo transaction, returning it as a base64 string.
 *   2. We decode the base64 → Uint8Array and pass it to Phantom's
 *      signAndSendTransaction(), which handles signing + broadcasting natively.
 *   3. The server /api/solana/confirm endpoint confirms the tx on-chain.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BuildTxResponse {
  transaction: string;        // base64-encoded serialized Transaction
  blockhash: string;
  lastValidBlockHeight: number;
}

interface SolanaProvider {
  isPhantom: boolean;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signAndSendTransaction(tx: unknown): Promise<{ signature: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPhantomProvider(): SolanaProvider {
  const provider =
    (window as any)?.phantom?.solana ?? (window as any)?.solana;

  if (!provider?.isPhantom) {
    throw new Error(
      'Phantom wallet not found. Please install the Phantom browser extension and refresh the page.'
    );
  }
  return provider as SolanaProvider;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Connects to the Phantom wallet and returns the public key string.
 */
export const connectPhantom = async (): Promise<string> => {
  console.log('window.solana:', (window as any)?.solana);
  console.log('window.phantom:', (window as any)?.phantom);

  const provider = getPhantomProvider();
  const response = await provider.connect();
  return response.publicKey.toString();
};

/**
 * Full flow:
 *   1. Ask our Express server to build + serialize a Memo transaction on devnet.
 *   2. Phantom signs + broadcasts the raw transaction bytes.
 *   3. Server confirms the transaction.
 *   4. Returns the confirmed signature string.
 */
export async function publishToLedger(
  decision: string,
  blindSpots: string[],
  walletAddress: string
): Promise<string> {
  const provider = getPhantomProvider();

  // 1. Build transaction on the server (uses @solana/web3.js safely in Node.js)
  const buildRes = await fetch(`${API_URL}/api/solana/build-tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, decision, blindSpots }),
  });

  const buildData = await buildRes.json();

  if (!buildRes.ok) {
    // Surface the faucet message or other server errors directly to the UI
    throw new Error(buildData.error ?? 'Failed to build transaction.');
  }

  const { transaction: base64Tx, blockhash, lastValidBlockHeight } =
    buildData as BuildTxResponse;

  console.log('Transaction built by server, blockhash:', blockhash);

  // 2. Decode base64 → Uint8Array and hand to Phantom for signing + broadcast
  const txBytes = base64ToUint8Array(base64Tx);

  // Phantom's signAndSendTransaction accepts a VersionedTransaction-like object
  // with a serialize() method OR raw bytes. We wrap it accordingly.
  const { signature } = await provider.signAndSendTransaction({
    serialize: () => txBytes,
  } as unknown as Parameters<SolanaProvider['signAndSendTransaction']>[0]);

  console.log('Raw signature from Phantom:', signature);

  // 3. Confirm on-chain via server
  const confirmRes = await fetch(`${API_URL}/api/solana/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature, blockhash, lastValidBlockHeight }),
  });

  const confirmData = await confirmRes.json();

  if (!confirmRes.ok) {
    throw new Error(confirmData.error ?? 'Transaction confirmation failed.');
  }

  console.log('Transaction confirmed on devnet:', signature);
  return signature;
}

/**
 * Returns the Solana Explorer URL for a confirmed devnet transaction.
 */
export const getSolanaExplorerUrl = (signature: string): string => {
  const cleanSig = signature.replace(/['"]/g, '').trim();
  const url = `https://explorer.solana.com/tx/${cleanSig}?cluster=devnet`;
  console.log('Raw signature:', signature);
  console.log('Explorer URL:', url);
  return url;
};
