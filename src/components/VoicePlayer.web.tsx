/**
 * VoicePlayer — Web implementation using HTML5 Audio API.
 *
 * On web, expo-av and expo-file-system are not reliable.
 * This component uses a plain HTMLAudioElement with base64 data URIs
 * so audio works natively in any browser.
 *
 * Metro automatically picks this file over VoicePlayer.tsx on web.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';
import { VoiceArchetype } from '@/constants/mockData';
import { generateVoice } from '@/services/elevenlabs';
import { translateAndSpeak, SarvamLanguage } from '@/services/sarvam';

// ---------------------------------------------------------------------------
// Types (must match VoicePlayer.tsx exactly)
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
  const [position, setPosition] = useState(0);   // seconds
  const [duration, setDuration] = useState(0);   // seconds

  // Native browser Audio element — no expo-av, no file system
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyAudio();
    };
  }, []);

  function destroyAudio() {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }

  const resetPlayer = useCallback(async () => {
    destroyAudio();
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

  const fetchAudio = async (lang: PlayerLanguage): Promise<{ base64: string; mimeType: string }> => {
    if (lang === 'English') {
      const base64 = await generateVoice(voiceQuote, voiceArchetype);
      return { base64, mimeType: 'audio/mpeg' };
    }
    const base64 = await translateAndSpeak(voiceQuote, lang as SarvamLanguage);
    return { base64, mimeType: 'audio/wav' };
  };

  const loadAndPlay = async () => {
    setPlayerState('loading');
    setErrorMessage(null);

    try {
      const { base64, mimeType } = await fetchAudio(selectedLang);

      // Build a data URI — works in all browsers with no file system needed
      const dataUri = `data:${mimeType};base64,${base64}`;

      const audio = new Audio(dataUri);
      audioRef.current = audio;

      // Track playback position with a polling interval
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
      });

      audio.addEventListener('ended', () => {
        setPlayerState('idle');
        setPosition(0);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      });

      audio.addEventListener('error', (e) => {
        console.warn('Audio metadata load warning:', e);
      });

      await audio.play();
      setPlayerState('playing');

      // Poll position every 250ms
      progressIntervalRef.current = setInterval(() => {
        if (audioRef.current && !audioRef.current.paused) {
          setPosition(audioRef.current.currentTime);
        }
      }, 250);
    } catch (error: any) {
      console.error('VoicePlayer (web) error:', error);
      setPlayerState('error');
      setErrorMessage(
        error?.message?.includes('Missing EXPO_PUBLIC')
          ? 'API key not configured. Add your .env keys to hear voices.'
          : error?.message ?? 'Failed to load audio. Please try again.'
      );
    }
  };

  const handlePlayPause = async () => {
    if (playerState === 'loading') return;

    if (playerState === 'idle' || playerState === 'error') {
      await loadAndPlay();
      return;
    }

    if (!audioRef.current) return;

    if (playerState === 'playing') {
      audioRef.current.pause();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setPlayerState('paused');
    } else if (playerState === 'paused') {
      await audioRef.current.play();
      setPlayerState('playing');
      progressIntervalRef.current = setInterval(() => {
        if (audioRef.current && !audioRef.current.paused) {
          setPosition(audioRef.current.currentTime);
        }
      }, 250);
    }
  };

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  const formatTime = (secs: number) => {
    const total = Math.floor(secs);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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
                  width: `${progressPercent}%` as any,
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
  speakerText: { fontSize: 14 },
  brandBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  brandText: { fontSize: 9, fontWeight: '700' },
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
  flag: { fontSize: 14 },
  langChipText: { fontSize: 11, fontWeight: '600' },
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
  progressSection: { flex: 1, gap: Spacing.one },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  progressBarFill: { height: 6, borderRadius: 3 },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: { fontSize: 10 },
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
