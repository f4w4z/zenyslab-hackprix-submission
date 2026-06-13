/**
 * ElevenLabs Text-to-Speech service.
 *
 * Each stakeholder archetype maps to a distinct voice persona configured
 * in your ElevenLabs account. Audio is returned as a base64-encoded string
 * which can be written to the filesystem via expo-file-system and played
 * with expo-av.
 *
 * API docs: https://elevenlabs.io/docs/api-reference/text-to-speech
 */

import { VoiceArchetype } from '@/constants/mockData';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

/**
 * Maps stakeholder archetypes to ElevenLabs voice IDs.
 * Set these environment variables in your .env file.
 */
function getVoiceId(archetype: VoiceArchetype): string {
  const voiceMap: Record<VoiceArchetype, string | undefined> = {
    student: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_STUDENT,
    worker: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_WORKER,
    authority: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_AUTHORITY,
    parent: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_PARENT,
    default: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_DEFAULT,
  };

  const id = voiceMap[archetype] ?? voiceMap.default;
  if (!id) {
    throw new Error(
      `Missing ElevenLabs voice ID for archetype "${archetype}". ` +
        'Please set EXPO_PUBLIC_ELEVENLABS_VOICE_* variables in your .env file.'
    );
  }
  return id;
}

export interface ElevenLabsVoiceOptions {
  stability?: number;        // 0-1, default 0.5
  similarityBoost?: number;  // 0-1, default 0.75
  style?: number;            // 0-1, default 0.0
  useSpeakerBoost?: boolean; // default true
}

/**
 * Generates speech audio for a given text using ElevenLabs.
 *
 * @param text - The voice quote to narrate (max ~500 chars recommended)
 * @param archetype - Stakeholder archetype used to select the voice persona
 * @param options - Optional voice tuning parameters
 * @returns Base64-encoded MP3 audio string
 */
export async function generateVoice(
  text: string,
  archetype: VoiceArchetype = 'default',
  options: ElevenLabsVoiceOptions = {}
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_ELEVENLABS_API_KEY. Please add it to your .env file.'
    );
  }

  const voiceId = getVoiceId(archetype);

  const requestBody = {
    text: text.substring(0, 1000), // ElevenLabs character limit safety
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: options.stability ?? 0.5,
      similarity_boost: options.similarityBoost ?? 0.75,
      style: options.style ?? 0.0,
      use_speaker_boost: options.useSpeakerBoost ?? true,
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
    throw new Error(`ElevenLabs API error (${response.status}): ${errorBody}`);
  }

  // Convert arraybuffer to base64
  const audioBuffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(audioBuffer);
  return base64;
}

/** Converts an ArrayBuffer to a base64 string (browser + React Native compatible) */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
