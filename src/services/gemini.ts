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
 * Refines a raw speech-to-text transcript using Gemini 2.0 Flash via the secure server proxy.
 */
export async function refineTranscript(rawText: string): Promise<string> {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return rawText;
  }

  try {
    const response = await fetch(`${getApiUrl()}/api/proxy/gemini/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText }),
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

