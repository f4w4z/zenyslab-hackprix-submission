/**
 * End-to-end connectivity test for all Echo services.
 * Tests: Gemini API, ElevenLabs TTS, Sarvam AI, MongoDB (via Express server)
 *
 * Usage: node test-e2e.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_DEFAULT = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_DEFAULT;
const SARVAM_API_KEY = process.env.EXPO_PUBLIC_SARVAM_API_KEY;
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const results = [];

function log(label, status, detail) {
  const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[WARN]';
  console.log(`  ${icon}  ${label}: ${detail}`);
  results.push({ label, status, detail });
}

// ---------------------------------------------------------------------------
// Test 1: Express Server Health
// ---------------------------------------------------------------------------
async function testServerHealth() {
  console.log('\n─── 1. Express API Server ───');
  try {
    const res = await fetch(`${API_URL}/health`);
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      log('Health check', 'PASS', `Server OK, database="${data.database}"`);
    } else {
      log('Health check', 'FAIL', `Unexpected response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    log('Health check', 'FAIL', `Server unreachable at ${API_URL}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Test 2: MongoDB CRUD via Express
// ---------------------------------------------------------------------------
async function testMongoDB() {
  console.log('\n─── 2. MongoDB (via Express API) ───');
  let insertedId = null;

  // POST — insert
  try {
    const res = await fetch(`${API_URL}/api/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test-e2e-' + Date.now(),
        decisionTitle: 'E2E Test — safe to delete',
        description: 'Automated end-to-end test record',
        timestamp: new Date().toISOString(),
        stakeholders: [],
      }),
    });
    const data = await res.json();
    if (res.ok && data.mongoId) {
      insertedId = data.mongoId;
      log('POST /api/simulations', 'PASS', `Inserted document _id=${insertedId}`);
    } else {
      log('POST /api/simulations', 'FAIL', JSON.stringify(data));
    }
  } catch (err) {
    log('POST /api/simulations', 'FAIL', err.message);
  }

  // GET — list
  try {
    const res = await fetch(`${API_URL}/api/simulations`);
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      const found = insertedId ? data.some(d => d.mongoId === insertedId) : false;
      log('GET /api/simulations', 'PASS', `${data.length} documents returned, test doc found=${found}`);
    } else {
      log('GET /api/simulations', 'FAIL', JSON.stringify(data));
    }
  } catch (err) {
    log('GET /api/simulations', 'FAIL', err.message);
  }

  // DELETE — cleanup
  if (insertedId) {
    try {
      const res = await fetch(`${API_URL}/api/simulations/${insertedId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.deleted) {
        log('DELETE /api/simulations/:id', 'PASS', `Deleted test document ${insertedId}`);
      } else {
        log('DELETE /api/simulations/:id', 'FAIL', JSON.stringify(data));
      }
    } catch (err) {
      log('DELETE /api/simulations/:id', 'FAIL', err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Test 3: Gemini API
// ---------------------------------------------------------------------------
async function testGemini() {
  console.log('\n─── 3. Gemini 2.0 Flash API ───');
  if (!GEMINI_API_KEY) {
    log('Gemini API', 'FAIL', 'EXPO_PUBLIC_GEMINI_API_KEY not set in .env');
    return;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with exactly: ECHO_TEST_OK' }] }],
          generationConfig: { maxOutputTokens: 20 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      log('Gemini API', 'FAIL', `HTTP ${res.status}: ${err.substring(0, 200)}`);
      return;
    }

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (reply.includes('ECHO_TEST_OK')) {
      log('Gemini API', 'PASS', `Response: "${reply.trim()}"`);
    } else {
      log('Gemini API', 'WARN', `Got response but unexpected content: "${reply.trim().substring(0, 100)}"`);
    }
  } catch (err) {
    log('Gemini API', 'FAIL', err.message);
  }
}

// ---------------------------------------------------------------------------
// Test 4: ElevenLabs TTS
// ---------------------------------------------------------------------------
async function testElevenLabs() {
  console.log('\n─── 4. ElevenLabs TTS API ───');
  if (!ELEVENLABS_API_KEY) {
    log('ElevenLabs API', 'FAIL', 'EXPO_PUBLIC_ELEVENLABS_API_KEY not set');
    return;
  }
  if (!ELEVENLABS_VOICE_DEFAULT) {
    log('ElevenLabs Voice ID', 'FAIL', 'EXPO_PUBLIC_ELEVENLABS_VOICE_DEFAULT not set');
    return;
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_DEFAULT}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: 'Echo test.',
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      log('ElevenLabs TTS', 'FAIL', `HTTP ${res.status}: ${err.substring(0, 200)}`);
      return;
    }

    const buffer = await res.arrayBuffer();
    const sizeKB = (buffer.byteLength / 1024).toFixed(1);
    if (buffer.byteLength > 1000) {
      log('ElevenLabs TTS', 'PASS', `Generated ${sizeKB} KB MP3 audio`);
    } else {
      log('ElevenLabs TTS', 'WARN', `Response only ${sizeKB} KB — may be too small`);
    }
  } catch (err) {
    log('ElevenLabs TTS', 'FAIL', err.message);
  }
}

// ---------------------------------------------------------------------------
// Test 5: Sarvam AI (Translation + TTS)
// ---------------------------------------------------------------------------
async function testSarvam() {
  console.log('\n─── 5. Sarvam AI (Translate + TTS) ───');
  if (!SARVAM_API_KEY) {
    log('Sarvam API', 'FAIL', 'EXPO_PUBLIC_SARVAM_API_KEY not set');
    return;
  }

  // 5a: Translation
  let translatedText = null;
  try {
    const res = await fetch('https://api.sarvam.ai/translate', {
      method: 'POST',
      headers: {
        'API-Subscription-Key': SARVAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: 'This is an automated test.',
        source_language_code: 'en-IN',
        target_language_code: 'hi-IN',
        speaker_gender: 'Female',
        mode: 'formal',
        enable_preprocessing: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      log('Sarvam Translate', 'FAIL', `HTTP ${res.status}: ${err.substring(0, 200)}`);
    } else {
      const data = await res.json();
      translatedText = data?.translated_text;
      if (translatedText) {
        log('Sarvam Translate', 'PASS', `"This is an automated test." → "${translatedText}"`);
      } else {
        log('Sarvam Translate', 'FAIL', 'Empty translated_text in response');
      }
    }
  } catch (err) {
    log('Sarvam Translate', 'FAIL', err.message);
  }

  // 5b: TTS
  if (translatedText) {
    try {
      const res = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'API-Subscription-Key': SARVAM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: [translatedText],
          target_language_code: 'hi-IN',
          speaker: 'anushka',
          pitch: 0,
          pace: 1.0,
          loudness: 1.5,
          speech_sample_rate: 22050,
          enable_preprocessing: true,
          model: 'bulbul:v2',
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        log('Sarvam TTS', 'FAIL', `HTTP ${res.status}: ${err.substring(0, 200)}`);
      } else {
        const data = await res.json();
        const audio = data?.audios?.[0];
        if (audio && audio.length > 100) {
          const sizeKB = (audio.length * 0.75 / 1024).toFixed(1);
          log('Sarvam TTS', 'PASS', `Generated ~${sizeKB} KB WAV audio (base64)`);
        } else {
          log('Sarvam TTS', 'FAIL', 'Empty or too-small audio in response');
        }
      }
    } catch (err) {
      log('Sarvam TTS', 'FAIL', err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║       Echo — End-to-End Service Connectivity Test    ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  await testServerHealth();
  await testMongoDB();
  await testGemini();
  await testElevenLabs();
  await testSarvam();

  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  RESULTS:  ${passed} passed  |  ${failed} failed  |  ${warned} warnings`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

main();
