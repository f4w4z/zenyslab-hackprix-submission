/**
 * POST /api/solana/build-tx
 * Builds a Solana Memo transaction on devnet and returns:
 *   { transaction: "<base64>", blockhash: "<string>" }
 * The client passes this to Phantom to sign, then sends the signature back
 * to /api/solana/confirm for confirmation.
 *
 * Body: { walletAddress, decision, blindSpots }
 */

const express = require('express');
const {
  Connection,
  Transaction,
  TransactionInstruction,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');

const router = express.Router();
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// ─── POST /api/solana/build-tx ──────────────────────────────────────────────
router.post('/build-tx', async (req, res) => {
  const { walletAddress, decision, blindSpots } = req.body;

  if (!walletAddress || !decision || !Array.isArray(blindSpots)) {
    return res.status(400).json({ error: 'walletAddress, decision, and blindSpots are required.' });
  }

  try {
    const feePayer = new PublicKey(walletAddress);

    // Check devnet balance
    const lamports = await connection.getBalance(feePayer);
    const sol = lamports / LAMPORTS_PER_SOL;
    if (sol === 0) {
      return res.status(402).json({
        error: `You need devnet SOL. Visit faucet.solana.com and paste your wallet address: ${walletAddress}`,
        code: 'NO_SOL',
      });
    }

    // Build memo data
    const memoData = JSON.stringify({
      app: 'echo',
      decision,
      blindSpots,
      ts: Date.now(),
    });

    // Build memo instruction
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoData, 'utf-8'),
    });

    // Build transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer,
    }).add(memoInstruction);

    // Serialize for client-side signing (requireAllSignatures=false so Phantom can add the sig)
    const serializedTx = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
    const base64Tx = serializedTx.toString('base64');

    res.json({ transaction: base64Tx, blockhash, lastValidBlockHeight });
  } catch (err) {
    console.error('[Solana] build-tx error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/solana/confirm ───────────────────────────────────────────────
router.post('/confirm', async (req, res) => {
  const { signature, blockhash, lastValidBlockHeight } = req.body;
  if (!signature) {
    return res.status(400).json({ error: 'signature is required.' });
  }
  try {
    const result = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );
    if (result.value.err) {
      return res.status(400).json({ error: `Transaction failed: ${JSON.stringify(result.value.err)}` });
    }
    res.json({ confirmed: true, signature });
  } catch (err) {
    console.error('[Solana] confirm error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
