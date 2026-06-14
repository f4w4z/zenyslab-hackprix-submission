/**
 * Gemini 2.0 Flash service for stakeholder analysis.
 *
 * Makes a direct API call from the app using EXPO_PUBLIC_GEMINI_API_KEY.
 * Returns a fully structured SimulationRecord from a single prompt.
 *
 * Prompt engineering strategy:
 * - Single structured call → minimises latency and token usage
 * - Strict JSON schema in the prompt → reliable parsing
 * - System-level framing via the system instruction field
 */

import { SimulationRecord } from '@/constants/mockData';
import { getApiUrl } from './mongodb';

/**
 * Calls Gemini 2.0 Flash via the secure server proxy.
 */
export async function analyzeDecision(decisionText: string, targetLanguage?: string): Promise<SimulationRecord> {
  if (decisionText.trim().length < 10) {
    throw new Error('Decision text is too short. Please provide more detail.');
  }

  const response = await fetch(`${getApiUrl()}/api/proxy/gemini/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisionText, targetLanguage }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Analysis error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

/**
 * Translates an entire SimulationRecord to the target language via the secure server proxy.
 */
export async function translateSimulationRecord(simulation: SimulationRecord, targetLanguage: string): Promise<SimulationRecord> {
  const response = await fetch(`${getApiUrl()}/api/proxy/gemini/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulation, targetLanguage }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Translation error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

/**
 * Refines a raw speech-to-text transcript using Gemini 2.0 Flash via the secure server proxy.
 */
export async function refineTranscript(rawText: string, languageCode?: string): Promise<string> {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return rawText;
  }

  try {
    const response = await fetch(`${getApiUrl()}/api/proxy/gemini/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, languageCode }),
    });

    if (!response.ok) {
      console.warn(`Gemini transcript refinement failed (${response.status})`);
      return rawText;
    }

    const data = await response.json();
    return data.refinedText || rawText;
  } catch (error) {
    console.warn('Error refining transcript with Gemini:', error);
    return rawText;
  }
}

// ---------------------------------------------------------------------------
// Debate feature
// ---------------------------------------------------------------------------

export interface DebateTurnHistoryEntry {
  /** Display name of the speaker (group name) */
  speaker: string;
  /** What they said */
  text: string;
}

export interface GenerateDebateTurnParams {
  groupA: string;
  groupB: string;
  /** The decision title/proposal that is being debated */
  decisionContext: string;
  /** The Gemini-generated reason for this specific conflict pair */
  conflictReason: string;
  /** Which side speaks this turn */
  currentSpeaker: 'groupA' | 'groupB';
  /** Previous debate turns for context (last ~6 used by server) */
  history: DebateTurnHistoryEntry[];
}

/**
 * Generates one passionate debate turn for the current speaker.
 * Returns a 2-3 sentence spoken rebuttal, audio-ready.
 */
export async function generateDebateTurn(params: GenerateDebateTurnParams): Promise<string> {
  const response = await fetch(`${getApiUrl()}/api/proxy/gemini/debate-turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Debate turn error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.text as string;
}


