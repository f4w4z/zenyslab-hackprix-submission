/**
 * Server-side API Proxy Router
 * Keeps secret API keys safe on the backend.
 */

const express = require('express');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const SARVAM_API_BASE = 'https://api.sarvam.ai';
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

const GEMINI_SYSTEM_INSTRUCTION = `You are Echo, an AI-powered Decision Blind Spot Detector.
Your task is to analyse a proposed organisational, institutional, or governmental decision and:
1. Identify ALL affected stakeholder groups — both direct and indirect.
2. Highlight groups that decision-makers commonly overlook (isOverlooked: true).
3. Analyse how each group is impacted (positive, negative, or mixed).
4. For each stakeholder, you MUST include severity as exactly one of: "high", "medium", or "low".
   - high: policy directly and significantly harms this group
   - medium: policy moderately affects this group  
   - low: policy has minor effects on this group
5. Detect conflicts where one group benefits at the direct expense of another.
6. Generate an authentic first-person voice quote from each group's perspective.

Be thorough, empathetic, and balanced. Prioritise overlooked groups such as:
disabled individuals, commuters, part-time workers, caregivers, scholarship holders,
contractual staff, international students, rural communities, and elderly individuals.

If the decision text is in Hindi, Telugu, or any other language, analyze it directly without commenting on the language. Never say 'I don't see a transcription' or describe the input — just analyze it.

For voiceArchetype, assign one of: student | worker | authority | parent | default`;

const GEMINI_PROMPT_TEMPLATE = (decision) => `
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
      "severity": "high" | "medium" | "low",
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
  "summary": "Two-sentence overall analysis of this decision's impact.",
  "conflictSummary": "A 3-4 sentence audio-ready spoken summary. Briefly state what the decision aims to do and who it benefits. Then name the key conflict or tension between stakeholder groups and explain what is at stake. Finally, call out the overlooked groups by name and describe the hardship this decision creates for them."
}

Include 5-9 stakeholder groups. Include 1-3 conflict pairs if they exist.
Ensure blindSpots lists only the names of stakeholders where isOverlooked is true.
`;

// ─── 1. GEMINI PROXIES ───────────────────────────────────────────────────────

/**
 * Batch-translates all visible text fields in a simulation result using Groq.
 * Falls back to the original English values on any error.
 */
async function translateSimulation(simulation, langName, apiKey) {
  const toTranslate = {
    decisionTitle: simulation.decisionTitle,
    description: simulation.description,
    summary: simulation.summary,
    conflictSummary: simulation.conflictSummary,
    stakeholders: simulation.stakeholders.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      description: s.description,
      voiceQuote: s.voiceQuote,
    })),
    conflicts: (simulation.conflicts || []).map((c) => ({
      groupA: c.groupA,
      groupB: c.groupB,
      reason: c.reason,
    })),
  };

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional translator. You will receive a JSON object with English text values. ' +
            `Translate every string value into ${langName}. ` +
            'Keep ALL JSON keys in English exactly as given. Return ONLY valid JSON with no extra explanation.',
        },
        {
          role: 'user',
          content: `Translate this JSON to ${langName}:\n${JSON.stringify(toTranslate)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Translation call failed: ${response.status}`);
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Translation returned empty content.');

  let t;
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    t = JSON.parse(cleaned);
  } catch {
    throw new Error('Translation response was not valid JSON.');
  }

  return {
    ...simulation,
    decisionTitle: t.decisionTitle || simulation.decisionTitle,
    description: t.description || simulation.description,
    summary: t.summary || simulation.summary,
    conflictSummary: t.conflictSummary || simulation.conflictSummary,
    stakeholders: simulation.stakeholders.map((s, i) => ({
      ...s,
      name: t.stakeholders?.[i]?.name || s.name,
      role: t.stakeholders?.[i]?.role || s.role,
      description: t.stakeholders?.[i]?.description || s.description,
      voiceQuote: t.stakeholders?.[i]?.voiceQuote || s.voiceQuote,
    })),
    conflicts: (simulation.conflicts || []).map((c, i) => ({
      ...c,
      groupA: t.conflicts?.[i]?.groupA || c.groupA,
      groupB: t.conflicts?.[i]?.groupB || c.groupB,
      reason: t.conflicts?.[i]?.reason || c.reason,
    })),
    blindSpots: (simulation.blindSpots || []).map(bs => {
      const idx = simulation.stakeholders.findIndex(s => s.name === bs);
      if (idx !== -1 && t.stakeholders?.[idx]?.name) {
        return t.stakeholders[idx].name;
      }
      return bs;
    }),
  };
}

router.post('/gemini/analyze', async (req, res) => {
  const { decisionText, targetLanguage } = req.body;
  if (!decisionText || decisionText.trim().length < 10) {
    return res.status(400).json({ error: 'Decision text is too short. Please provide more detail.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing API key on server.' });
  }

  try {
    const requestBody = {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: GEMINI_SYSTEM_INSTRUCTION },
        { role: 'user', content: GEMINI_PROMPT_TEMPLATE(decisionText.trim()) },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    };

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({ error: `Analysis error: ${errorBody}` });
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content;

    if (!rawText) {
      return res.status(500).json({ error: 'Analysis returned an empty response.' });
    }

    let parsed;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse analysis response as JSON.' });
    }

    if (!Array.isArray(parsed.stakeholders) || parsed.stakeholders.length === 0) {
      return res.status(500).json({ error: 'Analysis returned an invalid stakeholder list.' });
    }

    const normalised = parsed.stakeholders.map((s, i) => ({
      ...s,
      id: `sh-live-${Date.now()}-${i}`,
      voiceArchetype: s.voiceArchetype ?? 'default',
    }));

    const simulationId = `sim-live-${Date.now()}`;

    const englishSimulation = {
      id: simulationId,
      decisionTitle: decisionText.length > 80 ? decisionText.substring(0, 80) + '…' : decisionText,
      decisionText,
      description: parsed.summary ?? '',
      timestamp: new Date().toISOString(),
      stakeholders: normalised,
      conflicts: parsed.conflicts ?? [],
      blindSpots: parsed.blindSpots ?? [],
      summary: parsed.summary ?? '',
      conflictSummary: parsed.conflictSummary ?? '',
    };

    // If the user spoke in Hindi or Telugu, translate all text fields
    const langMap = { 'hi-IN': 'Hindi', 'te-IN': 'Telugu' };
    const langName = langMap[targetLanguage];

    if (langName) {
      try {
        const translated = await translateSimulation(englishSimulation, langName, apiKey);
        return res.json({ ...translated, _englishVersion: englishSimulation });
      } catch (translationErr) {
        console.warn('[Proxy analyze] Translation failed, falling back to English:', translationErr.message);
        // Fall through and return English
      }
    }

    res.json(englishSimulation);
  } catch (err) {
    console.error('[Proxy analyze] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/gemini/translate', async (req, res) => {
  const { simulation, targetLanguage } = req.body;
  if (!simulation || !targetLanguage) {
    return res.status(400).json({ error: 'Missing simulation or targetLanguage.' });
  }

  const langMap = { 'hi-IN': 'Hindi', 'te-IN': 'Telugu', 'en-IN': 'English' };
  const langName = langMap[targetLanguage];

  if (!langName) {
    return res.status(400).json({ error: 'Invalid target language.' });
  }

  if (langName === 'English') {
    return res.json(simulation);
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing API key on server.' });
  }

  try {
    const translated = await translateSimulation(simulation, langName, apiKey);
    res.json(translated);
  } catch (err) {
    console.error('[Proxy translate] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/gemini/shadow-policy', async (req, res) => {
  const { decision, forgottenStakeholders, conflicts } = req.body;
  if (!decision) {
    return res.status(400).json({ error: 'Missing decision text.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing API key on server.' });
  }

  // Truncate decision to avoid exceeding context window
  const truncatedDecision = decision.length > 500 ? decision.slice(0, 500) + '...' : decision;

  const forgottenList = (forgottenStakeholders || [])
    .map((s) => `- ${s.name}: ${s.reason}`)
    .join('\n');

  const conflictList = (conflicts || [])
    .map((c) => `- ${c.groupA} vs ${c.groupB}: ${c.reason}`)
    .join('\n');

  const systemPrompt = 'You are a policy improvement expert. You will receive a decision and its blind spots. Generate an improved policy as valid JSON only. Each "clause" in the changes array must be a single short sentence, maximum 15 words.';

  const userPrompt = [
    'Analyze this decision and generate an improved version.',
    '',
    'DECISION:',
    truncatedDecision,
    '',
    'OVERLOOKED GROUPS:',
    forgottenList || 'None identified.',
    '',
    'CONFLICTS:',
    conflictList || 'None identified.',
    '',
    'Generate an improved version that keeps the original intent, adds clauses for each forgotten group, and resolves conflicts. Write it as an actual policy document.',
    '',
    'Return JSON in this exact format:',
    '{"improvedPolicy": "Full improved policy text...", "changes": [{"group": "Group Name", "clause": "Short summary max 15 words"}]}',
  ].join('\n');

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Proxy shadow-policy] Groq error body:', errBody);
      throw new Error(`Shadow policy call failed: ${response.status}`);
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Shadow policy returned empty content.');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Shadow policy response was not valid JSON.');
    }

    res.json(parsed);
  } catch (err) {
    console.error('[Proxy shadow-policy] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/gemini/refine', async (req, res) => {
  const { rawText, languageCode } = req.body;
  const trimmed = rawText ? rawText.trim() : '';
  if (!trimmed) {
    return res.json({ refinedText: '' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing API key on server.' });
  }

  const langMap = { 'hi-IN': 'Hindi', 'te-IN': 'Telugu', 'en-IN': 'English' };
  const targetLang = langMap[languageCode] || 'English';

  try {
    const requestBody = {
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content:
            'You are a speech transcription refinement assistant.\n' +
            'The user spoke a decision proposal, which was transcribed using an automated tool. The transcription may contain phonetic errors, spelling mistakes, or missing punctuation.\n' +
            'Your task is to:\n' +
            '1. Correct all spelling, grammar, phonetic mistakes, and punctuation.\n' +
            `2. Output the refined transcript in the target language: ${targetLang}. Do NOT translate it to any other language.\n` +
            '3. Deduce what decision proposal the user was trying to say based on context.\n' +
            '4. Keep the user\'s original intent intact.\n' +
            `5. Output ONLY the refined, clean transcript in ${targetLang}. Do not add any conversational text, explanations, or metadata.\n` +
            `Never say 'I don't see a transcription' or describe the input — just output the refined text in ${targetLang}.`,
        },
        {
          role: 'user',
          content: `Refine this raw transcription of a decision proposal:\n"${trimmed}"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    };

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({ error: `Refinement error: ${errorBody}` });
    }

    const data = await response.json();
    let refined = data?.choices?.[0]?.message?.content;

    if (refined) {
      // Strip common LLM preamble phrases that models sometimes prepend
      refined = refined
        .replace(/^(the )?refined (transcript|version|text|proposal) is:?\s*/i, '')
        .replace(/^here is the refined.*?:\s*/i, '')
        .replace(/^refined:?\s*/i, '')
        .replace(/^sure[,!.]?\s*/i, '')
        .replace(/^(here'?s?|this is) (the )?(refined|cleaned|corrected).*?:\s*/i, '')
        .trim();
      // Strip surrounding quotes if the entire text is wrapped in them
      if (refined.startsWith('"') && refined.endsWith('"')) {
        refined = refined.slice(1, -1).trim();
      }
    }

    res.json({ refinedText: refined ? refined.trim() : trimmed });
  } catch (err) {
    console.error('[Proxy refine] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 2. SARVAM PROXIES ───────────────────────────────────────────────────────

async function translateText(text, targetLang, apiKey) {
  const response = await fetch(`${SARVAM_API_BASE}/translate`, {
    method: 'POST',
    headers: {
      'API-Subscription-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      source_language_code: 'en-IN',
      target_language_code: targetLang,
      speaker_gender: 'Female',
      mode: 'formal',
      enable_preprocessing: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Sarvam translate error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data?.translated_text;
}


/**
 * Splits text into chunks of at most maxLen characters, breaking at word boundaries.
 */
function splitIntoChunks(text, maxLen = 490) {
  const words = text.split(' ');
  const chunks = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLen) {
      if (current) chunks.push(current);
      // If a single word exceeds maxLen, hard-slice it
      current = word.length > maxLen ? word.substring(0, maxLen) : word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Concatenates multiple base64-encoded WAV audio strings into one.
 * Each WAV has a 44-byte header; we keep the first header and append
 * only the raw PCM data from subsequent chunks, then fix the size fields.
 */
function concatWavBase64(base64Array) {
  if (base64Array.length === 0) return '';
  if (base64Array.length === 1) return base64Array[0];

  const WAV_HEADER_SIZE = 44;
  const buffers = base64Array.map((b) => Buffer.from(b, 'base64'));
  const pcmChunks = buffers.map((buf) => buf.slice(WAV_HEADER_SIZE));
  const totalPcmSize = pcmChunks.reduce((sum, c) => sum + c.length, 0);

  const output = Buffer.concat([buffers[0].slice(0, WAV_HEADER_SIZE), ...pcmChunks]);
  // Fix RIFF chunk size (bytes 4-7)
  output.writeUInt32LE(output.length - 8, 4);
  // Fix data sub-chunk size (bytes 40-43)
  output.writeUInt32LE(totalPcmSize, 40);

  return output.toString('base64');
}

async function generateSarvamTTS(chunks, lang, apiKey) {
  const response = await fetch(`${SARVAM_API_BASE}/text-to-speech`, {
    method: 'POST',
    headers: {
      'API-Subscription-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: chunks,
      target_language_code: lang,
      speaker: lang === 'hi-IN' ? 'anushka' : 'arya',
      pitch: 0,
      pace: 1.0,
      loudness: 1.5,
      speech_sample_rate: 22050,
      enable_preprocessing: true,
      model: 'bulbul:v2',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Sarvam TTS error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const audios = data?.audios;
  if (!audios || audios.length === 0) return null;
  return concatWavBase64(audios);
}

router.post('/sarvam/translate-and-speak', async (req, res) => {
  const { englishText, targetLang } = req.body;
  if (!englishText || !targetLang) {
    return res.status(400).json({ error: 'englishText and targetLang are required.' });
  }

  const apiKey = process.env.EXPO_PUBLIC_SARVAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing Sarvam API key on server.' });
  }

  try {
    const translatedText = await translateText(englishText, targetLang, apiKey);
    if (!translatedText) {
      return res.status(500).json({ error: 'Translation returned empty result.' });
    }

    // Sarvam TTS allows max 500 chars per input item — chunk accordingly
    const chunks = splitIntoChunks(translatedText, 490);

    const base64Audio = await generateSarvamTTS(chunks, targetLang, apiKey);
    if (!base64Audio) {
      return res.status(500).json({ error: 'TTS returned empty audio.' });
    }

    res.json({ base64Audio });
  } catch (err) {
    console.error('[Proxy Sarvam translate-and-speak] Error:', err);
    res.status(500).json({ error: err.message });
  }
});


router.post('/sarvam/speech-to-text', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file upload is required.' });
  }

  const apiKey = process.env.EXPO_PUBLIC_SARVAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing Sarvam API key on server.' });
  }

  try {
    const languageCode = req.body.language_code || 'unknown';

    // Build native FormData using Node.js global Blob/FormData
    const formData = new FormData();
    const fileBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', fileBlob, req.file.originalname || 'audio.webm');
    formData.append('model', 'saaras:v3');
    formData.append('language_code', languageCode);

    const response = await fetch(`${SARVAM_API_BASE}/speech-to-text`, {
      method: 'POST',
      headers: {
        'API-Subscription-Key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({ error: `Sarvam STT error (${response.status}): ${errorBody}` });
    }

    const data = await response.json();
    res.json({ transcript: data?.transcript || '' });
  } catch (err) {
    console.error('[Proxy Sarvam speech-to-text] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 3. ELEVENLABS PROXY ─────────────────────────────────────────────────────

function getElevenLabsVoiceId(archetype) {
  const voiceMap = {
    student: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_STUDENT,
    worker: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_WORKER,
    authority: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_AUTHORITY,
    parent: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_PARENT,
    default: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_DEFAULT,
  };

  return voiceMap[archetype] ?? voiceMap.default;
}

router.post('/elevenlabs/generate-voice', async (req, res) => {
  const { text, archetype, options } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'text is required.' });
  }

  const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing ElevenLabs API key on server.' });
  }

  const voiceId = getElevenLabsVoiceId(archetype || 'default');
  if (!voiceId) {
    return res.status(500).json({ error: `Missing ElevenLabs voice ID configuration for archetype "${archetype || 'default'}"` });
  }

  try {
    const opts = options || {};
    const requestBody = {
      text: text.substring(0, 2500),
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: opts.stability ?? 0.5,
        similarity_boost: opts.similarityBoost ?? 0.75,
        style: opts.style ?? 0.0,
        use_speaker_boost: opts.useSpeakerBoost ?? true,
      },
    };

    const response = await fetch(
      `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({ error: `ElevenLabs error (${response.status}): ${errorBody}` });
    }

    const audioBuffer = await response.arrayBuffer();
    
    // Convert arraybuffer to base64
    const bytes = new Uint8Array(audioBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Audio = btoa(binary);

    res.json({ base64Audio });
  } catch (err) {
    console.error('[Proxy ElevenLabs generate-voice] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 4. DEBATE TURN PROXY ────────────────────────────────────────────────────

/**
 * Generates one debate turn for a given speaker in a stakeholder conflict.
 *
 * Body:
 *   groupA         - Name of stakeholder group A
 *   groupB         - Name of stakeholder group B
 *   decisionContext - The decision title / proposal text
 *   conflictReason  - The Gemini-generated reason for this conflict pair
 *   currentSpeaker  - Which group speaks this turn ("groupA" | "groupB")
 *   history         - Array of { speaker: string, text: string } (last ~6 turns)
 *
 * Returns: { text: string } — a single passionate spoken rebuttal (2-3 sentences)
 */
router.post('/gemini/debate-turn', async (req, res) => {
  const { groupA, groupB, decisionContext, conflictReason, currentSpeaker, history } = req.body;

  if (!groupA || !groupB || !decisionContext || !currentSpeaker) {
    return res.status(400).json({ error: 'groupA, groupB, decisionContext, and currentSpeaker are required.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing API key on server.' });
  }

  const speakerName = currentSpeaker === 'groupA' ? groupA : groupB;
  const opponentName = currentSpeaker === 'groupA' ? groupB : groupA;

  // Build the conversation history for context
  const historyText = (history || [])
    .slice(-6) // Last 6 turns for context window efficiency
    .map((turn) => `${turn.speaker}: "${turn.text}"`)
    .join('\n');

  const systemPrompt = `You are ${speakerName} in a heated public debate about a real policy decision.

Your core conflict: ${conflictReason}

Rules for your response:
- Speak ONLY as ${speakerName}. Never break character.
- Be passionate, urgent, and specific to this EXACT decision.
- Directly rebut what ${opponentName} just said if there is history.
- Use "I", "we", or "our community" — first-person perspective only.
- Keep it to 2-3 sentences MAXIMUM. This is spoken audio, not an essay.
- No filler phrases like "I understand your point" — jump straight into your argument.
- Reference concrete, real consequences for your group.
- End on a strong, punchy note. Leave no room for easy counter.`;

  const userPrompt = `Decision being debated: "${decisionContext}"

${historyText ? `Debate so far:\n${historyText}\n\n` : ''}Now speak as ${speakerName} (2-3 sentences, spoken audio style, passionate and direct):`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.85, // Higher temperature for more passionate, varied responses
        max_tokens: 200,   // Keep turns short and punchy
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({ error: `Debate generation error: ${errorBody}` });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return res.status(500).json({ error: 'Debate turn returned an empty response.' });
    }

    res.json({ text });
  } catch (err) {
    console.error('[Proxy debate-turn] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

