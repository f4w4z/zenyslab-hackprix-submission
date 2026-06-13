/**
 * VoicePlayer — plays stakeholder voice audio using expo-av.
 *
 * - English: ElevenLabs (direct TTS, unique voice per archetype)
 * - Hindi / Telugu: Sarvam AI (translate → TTS)
 *
 * Audio flow:
 *   1. User taps Play or selects a language
 *   2. API call fetches base64 audio
 *   3. Audio written to expo-file-system cache
 *   4. expo-av Audio object plays the cached file
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';
import { VoiceArchetype } from '@/constants/mockData';
import { generateVoice } from '@/services/elevenlabs';
import { translateAndSpeak, SarvamLanguage, SARVAM_LANGUAGE_LABELS } from '@/services/sarvam';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlayerLanguage = 'English' | SarvamLanguage;
type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface LanguageOption {
  key: PlayerLanguage;
  label: string;
  flag: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { key: 'English', label: 'English', flag: '🇬🇧' },
  { key: 'hi-IN', label: 'हिंदी', flag: '🇮🇳' },
  { key: 'te-IN', label: 'తెలుగు', flag: '🇮🇳' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VoicePlayerProps {
  speakerName: string;
  voiceQuote: string;
  voiceArchetype?: VoiceArchetype;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoicePlayer({
  speakerName,
  voiceQuote,
  voiceArchetype = 'default',
}: VoicePlayerProps) {
  const theme = useTheme();

  const [selectedLang, setSelectedLang] = useState<PlayerLanguage>('English');
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [position, setPosition] = useState(0);   // milliseconds
  const [duration, setDuration] = useState(0);   // milliseconds

  const soundRef = useRef<Audio.Sound | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // Unload when language changes
  const resetPlayer = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setPlayerState('idle');
    setPosition(0);
    setDuration(0);
    setErrorMessage(null);
  }, []);

  const handleLanguageSelect = async (lang: PlayerLanguage) => {
    if (lang === selectedLang) return;
    await resetPlayer();
    setSelectedLang(lang);
  };

  const fetchAudio = async (lang: PlayerLanguage): Promise<string> => {
    // ElevenLabs for English
    if (lang === 'English') {
      const base64 = await generateVoice(voiceQuote, voiceArchetype);
      return base64;
    }
    // Sarvam AI for Hindi / Telugu
    const base64 = await translateAndSpeak(voiceQuote, lang as SarvamLanguage);
    return base64;
  };

  const loadAndPlay = async () => {
    setPlayerState('loading');
    setErrorMessage(null);

    try {
      // Configure audio session (important for iOS)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Fetch base64 audio from API
      const base64Audio = await fetchAudio(selectedLang);

      // Determine file extension based on language
      // ElevenLabs returns MP3, Sarvam returns WAV
      const isEnglish = selectedLang === 'English';
      const ext = isEnglish ? 'mp3' : 'wav';
      const cacheUri = `${FileSystem.cacheDirectory}echo_voice_${Date.now()}.${ext}`;

      // Write to filesystem cache
      await FileSystem.writeAsStringAsync(cacheUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Load into expo-av
      const { sound } = await Audio.Sound.createAsync(
        { uri: cacheUri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPosition(status.positionMillis ?? 0);
          setDuration(status.durationMillis ?? 0);
          if (status.didJustFinish) {
            setPlayerState('idle');
            setPosition(0);
          }
        }
      );

      soundRef.current = sound;
      setPlayerState('playing');
    } catch (error: any) {
      console.error('VoicePlayer error:', error);
      setPlayerState('error');
      setErrorMessage(
        error?.message?.includes('Missing EXPO_PUBLIC')
          ? 'API key not configured. Add your .env keys to hear voices.'
          : 'Failed to load audio. Please try again.'
      );
    }
  };

  const handlePlayPause = async () => {
    if (playerState === 'loading') return;

    if (playerState === 'idle' || playerState === 'error') {
      await loadAndPlay();
      return;
    }

    if (!soundRef.current) return;

    if (playerState === 'playing') {
      await soundRef.current.pauseAsync();
      setPlayerState('paused');
    } else if (playerState === 'paused') {
      await soundRef.current.playAsync();
      setPlayerState('playing');
    }
  };

  // Progress percentage (0 to 100)
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const playIcon =
    playerState === 'loading'
      ? { ios: 'ellipsis.circle.fill', android: 'hourglass_empty', web: 'hourglass_empty' }
      : playerState === 'playing'
        ? { ios: 'pause.fill', android: 'pause', web: 'pause' }
        : { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.voiceInfo}>
          <SymbolView
            name={{ ios: 'waveform.circle.fill', android: 'graphic_eq', web: 'graphic_eq' }}
            tintColor={theme.primary}
            size={18}
          />
          <ThemedText type="smallBold" style={styles.speakerText}>
            {speakerName}&apos;s Voice
          </ThemedText>
        </View>
        <View style={[styles.brandBadge, { backgroundColor: theme.surface }]}>
          <ThemedText type="code" style={[styles.brandText, { color: theme.textSecondary }]}>
            {selectedLang === 'English' ? 'ElevenLabs' : 'Sarvam AI'}
          </ThemedText>
        </View>
      </View>

      {/* Language Selector */}
      <ThemedText type="code" themeColor="textSecondary" style={styles.sectionLabel}>
        SELECT LANGUAGE:
      </ThemedText>
      <View style={styles.langRow}>
        {LANGUAGE_OPTIONS.map((option) => {
          const isSelected = selectedLang === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => handleLanguageSelect(option.key)}
              style={[
                styles.langChip,
                {
                  backgroundColor: isSelected ? theme.primary : theme.surface,
                  borderColor: isSelected ? theme.primary : theme.outline,
                },
              ]}>
              <ThemedText style={styles.flag}>{option.flag}</ThemedText>
              <ThemedText
                type="code"
                style={[
                  styles.langChipText,
                  { color: isSelected ? theme.surface : theme.text },
                ]}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Player Controls */}
      <View style={styles.playerRow}>
        <Pressable
          onPress={handlePlayPause}
          disabled={playerState === 'loading'}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: playerState === 'error' ? theme.error : theme.primary },
            pressed && { opacity: 0.85 },
            playerState === 'loading' && { opacity: 0.6 },
          ]}>
          <SymbolView
            name={playIcon as any}
            tintColor={theme.surface}
            size={20}
          />
        </Pressable>

        <View style={styles.progressSection}>
          <View style={[styles.progressBarBg, { backgroundColor: theme.outline }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: playerState === 'error' ? theme.error : theme.primary,
                  width: `${progressPercent}%`,
                },
              ]}
            />
          </View>
          <View style={styles.timeRow}>
            <ThemedText type="code" themeColor="textSecondary" style={styles.timeText}>
              {formatTime(position)}
            </ThemedText>
            <ThemedText type="code" themeColor="textSecondary" style={styles.timeText}>
              {duration > 0 ? formatTime(duration) : '--:--'}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Error State */}
      {playerState === 'error' && errorMessage && (
        <View style={[styles.errorBox, { backgroundColor: theme.errorContainer }]}>
          <SymbolView
            name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
            tintColor={theme.error}
            size={14}
          />
          <ThemedText type="code" style={[styles.errorText, { color: theme.error }]}>
            {errorMessage}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voiceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  speakerText: {
    fontSize: 14,
  },
  brandBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  brandText: {
    fontSize: 9,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: Spacing.one,
    letterSpacing: 0.5,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: 4,
  },
  flag: {
    fontSize: 14,
  },
  langChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  progressSection: {
    flex: 1,
    gap: Spacing.one,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 10,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.one,
  },
  errorText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
});
