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

import { ConflictPair, SimulationRecord, Stakeholder, VoiceArchetype } from '@/constants/mockData';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const GEMINI_SYSTEM_INSTRUCTION = `You are Echo, an AI-powered Decision Blind Spot Detector.
Your task is to analyse a proposed organisational, institutional, or governmental decision and:
1. Identify ALL affected stakeholder groups — both direct and indirect.
2. Highlight groups that decision-makers commonly overlook (isOverlooked: true).
3. Analyse how each group is impacted (positive, negative, or mixed).
4. Detect conflicts where one group benefits at the direct expense of another.
5. Generate an authentic first-person voice quote from each group's perspective.

Be thorough, empathetic, and balanced. Prioritise overlooked groups such as:
disabled individuals, commuters, part-time workers, caregivers, scholarship holders,
contractual staff, international students, rural communities, and elderly individuals.

For voiceArchetype, assign one of: student | worker | authority | parent | default`;

const GEMINI_PROMPT_TEMPLATE = (decision: string) => `
Analyse this proposed decision:
"${decision}"

Return ONLY a valid JSON object (no markdown, no explanation) with this exact shape:
{
  "stakeholders": [
    {
      "id": "sh-1",
      "name": "Group Name",
      "role": "Brief role description (max 10 words)",
      "impact": "positive" | "negative" | "mixed",
      "isOverlooked": true | false,
      "voiceArchetype": "student" | "worker" | "authority" | "parent" | "default",
      "description": "2-3 sentence structural impact analysis.",
      "voiceQuote": "First-person quote, 1-2 sentences, authentic and specific."
    }
  ],
  "conflicts": [
    {
      "groupA": "Group name",
      "groupB": "Group name",
      "reason": "1-2 sentence explanation of the conflict."
    }
  ],
  "blindSpots": ["Group name 1", "Group name 2"],
  "summary": "Two-sentence overall analysis of this decision's impact."
}

Include 5-9 stakeholder groups. Include 1-3 conflict pairs if they exist.
Ensure blindSpots lists only the names of stakeholders where isOverlooked is true.
`;

export interface GeminiAnalysisResult {
  stakeholders: Stakeholder[];
  conflicts: ConflictPair[];
  blindSpots: string[];
  summary: string;
}

/**
 * Calls Gemini 2.0 Flash and parses the response into a GeminiAnalysisResult.
 * Throws if the API key is missing or the response cannot be parsed.
 */
export async function analyzeDecision(decisionText: string): Promise<SimulationRecord> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_GEMINI_API_KEY. Please add it to your .env file.'
    );
  }

  if (decisionText.trim().length < 10) {
    throw new Error('Decision text is too short. Please provide more detail.');
  }

  const requestBody = {
    system_instruction: {
      parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: GEMINI_PROMPT_TEMPLATE(decisionText.trim()) }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  // Extract text content from Gemini response
  const rawText: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Gemini returned an empty response. Please try again.');
  }

  // Parse the JSON from the response text
  let parsed: GeminiAnalysisResult;
  try {
    // Strip markdown code fences if present (defensive fallback)
    const cleaned = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse Gemini response as JSON. Please try again.');
  }

  // Validate required fields
  if (!Array.isArray(parsed.stakeholders) || parsed.stakeholders.length === 0) {
    throw new Error('Gemini returned an invalid stakeholder list. Please try again.');
  }

  // Normalise stakeholder IDs to ensure uniqueness
  const normalised: Stakeholder[] = parsed.stakeholders.map((s, i) => ({
    ...s,
    id: `sh-live-${Date.now()}-${i}`,
    voiceArchetype: (s.voiceArchetype as VoiceArchetype) ?? 'default',
  }));

  const simulationId = `sim-live-${Date.now()}`;

  return {
    id: simulationId,
    decisionTitle:
      decisionText.length > 80 ? decisionText.substring(0, 80) + '…' : decisionText,
    decisionText,
    description: parsed.summary ?? '',
    timestamp: new Date().toISOString(),
    stakeholders: normalised,
    conflicts: parsed.conflicts ?? [],
    blindSpots: parsed.blindSpots ?? [],
    summary: parsed.summary ?? '',
  };
}
