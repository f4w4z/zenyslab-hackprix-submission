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

import React, { useState, useEffect, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';
import { VoiceArchetype } from '@/constants/mockData';
import { generateVoice } from '@/services/elevenlabs';
import { translateAndSpeak, SarvamLanguage } from '@/services/sarvam';

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
  defaultLanguage?: PlayerLanguage;
  autoPlay?: boolean;
  onStateChange?: (state: PlayerState) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoicePlayer({
  speakerName,
  voiceQuote,
  voiceArchetype = 'default',
  defaultLanguage = 'English',
  autoPlay = false,
  onStateChange,
}: VoicePlayerProps) {
  const theme = useTheme();

  const [selectedLang, setSelectedLang] = useState<PlayerLanguage>(defaultLanguage);
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const position = (status.currentTime ?? 0) * 1000;
  const duration = (status.duration ?? 0) * 1000;

  // Sync state when playback finishes or status changes
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (statusUpdate) => {
      if (statusUpdate.didJustFinish) {
        setPlayerState('idle');
      } else if (statusUpdate.playing) {
        setPlayerState('playing');
      } else {
        setPlayerState((prev) => (prev === 'playing' ? 'paused' : prev));
      }
    });
    return () => sub.remove();
  }, [player]);

  const resetPlayer = useCallback(async () => {
    player.pause();
    player.seekTo(0);
    setPlayerState('idle');
    setErrorMessage(null);
  }, [player]);

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
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
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

      // Load and Play
      player.replace(cacheUri);
      player.play();
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

  // Trigger onStateChange callback when playback state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange(playerState);
    }
  }, [playerState, onStateChange]);

  // Autoplay if requested on mount
  useEffect(() => {
    if (autoPlay) {
      const timer = setTimeout(() => {
        loadAndPlay();
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlayPause = async () => {
    if (playerState === 'loading') return;

    if (playerState === 'idle' || playerState === 'error') {
      await loadAndPlay();
      return;
    }

    if (playerState === 'playing') {
      player.pause();
      setPlayerState('paused');
    } else if (playerState === 'paused') {
      player.play();
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
    <View style={[styles.container, { borderBottomColor: theme.outline }]}>
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
      <View style={[styles.langRow, { backgroundColor: theme.background, borderColor: theme.outline }]}>
        {LANGUAGE_OPTIONS.map((option) => {
          const isSelected = selectedLang === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => handleLanguageSelect(option.key)}
              style={({ pressed }) => [
                styles.langChip,
                {
                  backgroundColor: isSelected ? theme.primary : 'transparent',
                },
                pressed && { opacity: 0.8 },
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
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.one,
    borderBottomWidth: 1,
    alignSelf: 'stretch',
    gap: Spacing.three,
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
    borderRadius: BorderRadius.md,
    padding: 2,
    borderWidth: 1,
    alignSelf: 'stretch',
  },
  langChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm - 2,
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
    width: 48,
    height: 48,
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
