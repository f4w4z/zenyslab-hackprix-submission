/**
 * Sarvam AI multilingual service for Hindi and Telugu perspectives.
 *
 * Step 1: Translate English voice quote → Hindi or Telugu
 * Step 2: Generate TTS audio in that language
 *
 * API docs: https://docs.sarvam.ai
 */

export type SarvamLanguage = 'hi-IN' | 'te-IN';

export const SARVAM_LANGUAGE_LABELS: Record<SarvamLanguage, string> = {
  'hi-IN': 'Hindi (हिंदी)',
  'te-IN': 'Telugu (తెలుగు)',
};

const SARVAM_API_BASE = 'https://api.sarvam.ai';

/**
 * Translates text from English to the target Indian language using Sarvam AI.
 */
async function translateText(
  text: string,
  targetLang: SarvamLanguage,
  apiKey: string
): Promise<string> {
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
  const translated: string | undefined = data?.translated_text;
  if (!translated) {
    throw new Error('Sarvam translation returned empty result.');
  }
  return translated;
}

/**
 * Generates TTS audio from text in the specified Indian language using Sarvam AI.
 * Returns base64-encoded WAV audio.
 */
async function generateSarvamTTS(
  text: string,
  lang: SarvamLanguage,
  apiKey: string
): Promise<string> {
  const response = await fetch(`${SARVAM_API_BASE}/text-to-speech`, {
    method: 'POST',
    headers: {
      'API-Subscription-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: lang,
      speaker: lang === 'hi-IN' ? 'meera' : 'pavithra',
      pitch: 0,
      pace: 1.0,
      loudness: 1.5,
      speech_sample_rate: 22050,
      enable_preprocessing: true,
      model: 'bulbul:v1',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Sarvam TTS error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  // Sarvam returns base64-encoded audio in the audios array
  const base64Audio: string | undefined = data?.audios?.[0];
  if (!base64Audio) {
    throw new Error('Sarvam TTS returned empty audio.');
  }
  return base64Audio;
}

/**
 * Translates an English voice quote and generates TTS audio in the target language.
 *
 * @param englishText - The English voice quote to translate and speak
 * @param targetLang - 'hi-IN' for Hindi, 'te-IN' for Telugu
 * @returns Base64-encoded WAV audio string
 */
export async function translateAndSpeak(
  englishText: string,
  targetLang: SarvamLanguage
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_SARVAM_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SARVAM_API_KEY. Please add it to your .env file.'
    );
  }

  // Step 1: Translate the English text
  const translatedText = await translateText(englishText, targetLang, apiKey);

  // Step 2: Generate TTS from translated text
  const base64Audio = await generateSarvamTTS(translatedText, targetLang, apiKey);

  return base64Audio;
}
