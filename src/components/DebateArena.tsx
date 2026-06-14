/**
 * DebateArena — Pipeline-first debate engine
 *
 * Flow per turn:
 *   1. Show text immediately in transcript (no wait)
 *   2. Play audio
 *   3. WHILE audio plays → prefetch NEXT turn's text + audio in background
 *   4. When audio ends → next turn is already ready → zero gap
 *
 * Arguments are 1 sentence max for punchy, real debate energy.
 * Multi-language: text always generated in English for quality,
 * TTS via ElevenLabs (English) or Sarvam (Hindi/Telugu).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { createAudioPlayer } from 'expo-audio';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { ConflictPair, Stakeholder, VoiceArchetype } from '@/constants/mockData';
import { generateVoice } from '@/services/elevenlabs';
import { translateAndSpeak } from '@/services/sarvam';
import { generateDebateTurn } from '@/services/gemini';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DebateArenaProps {
  conflict: ConflictPair;
  /** Always the English version of the decision title for best AI quality */
  decisionContext: string;
  stakeholders: Stakeholder[];
  /** The language the user spoke in — drives TTS language selection */
  language?: 'en-IN' | 'hi-IN' | 'te-IN' | 'unknown';
  onClose: () => void;
}

interface TranscriptEntry {
  id: string;
  speaker: 'groupA' | 'groupB';
  speakerName: string;
  text: string;
  isActive: boolean;
}

/** Everything needed to immediately play and show the next turn */
interface PrefetchedTurn {
  speakerSide: 'groupA' | 'groupB';
  speakerName: string;
  text: string;
  /** null = audio failed; debate continues without audio for this turn */
  audioBase64: string | null;
  mimeType: 'audio/mpeg' | 'audio/wav';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveArchetype(groupName: string, stakeholders: Stakeholder[]): VoiceArchetype {
  const match = stakeholders.find(
    (s) => s.name.toLowerCase().trim() === groupName.toLowerCase().trim()
  );
  return match?.voiceArchetype ?? 'default';
}

/** Plays base64 audio and resolves when it finishes. Stores ref for stop control. */
function playBase64Audio(
  base64: string,
  mimeType: string,
  activePlayerRef: React.MutableRefObject<any>
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const dataUri = `data:${mimeType};base64,${base64}`;
      const player = createAudioPlayer(dataUri);
      activePlayerRef.current = player;

      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          subscription.remove();
          player.release();
          if (activePlayerRef.current === player) {
            activePlayerRef.current = null;
          }
          resolve();
        }
      });

      player.play();
    } catch (e) {
      console.warn('[DebateArena] playBase64Audio failed:', e);
      resolve();
    }
  });
}



// ---------------------------------------------------------------------------
// Debate text via secure server proxy — 1 sentence, punchy
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Audio fetch helper — handles English (ElevenLabs) + Hindi/Telugu (Sarvam)
// ---------------------------------------------------------------------------

async function fetchDebateAudio(
  text: string,
  archetype: VoiceArchetype,
  language: 'en-IN' | 'hi-IN' | 'te-IN' | 'unknown'
): Promise<{ base64: string; mimeType: 'audio/mpeg' | 'audio/wav' }> {
  if (language === 'hi-IN' || language === 'te-IN') {
    const base64 = await translateAndSpeak(text, language);
    return { base64, mimeType: 'audio/wav' };
  }
  const base64 = await generateVoice(text, archetype, {
    stability: 0.38,      // lower = more emotive
    similarityBoost: 0.80,
    style: 0.40,          // style exaggeration for debate energy
  });
  return { base64, mimeType: 'audio/mpeg' };
}

// ---------------------------------------------------------------------------
// Prefetch one full turn (text + audio) in one shot
// ---------------------------------------------------------------------------

async function prefetchTurn(params: {
  speakerSide: 'groupA' | 'groupB';
  conflict: ConflictPair;
  decisionContext: string;
  history: { speaker: string; text: string }[];
  stakeholders: Stakeholder[];
  language: 'en-IN' | 'hi-IN' | 'te-IN' | 'unknown';
}): Promise<PrefetchedTurn> {
  const { speakerSide, conflict, decisionContext, history, stakeholders, language } = params;
  const speakerName = speakerSide === 'groupA' ? conflict.groupA : conflict.groupB;
  const archetype = resolveArchetype(speakerName, stakeholders);

  // Step 1: generate text via secure server proxy
  const text = await generateDebateTurn({
    groupA: conflict.groupA,
    groupB: conflict.groupB,
    decisionContext,
    conflictReason: conflict.reason,
    currentSpeaker: speakerSide,
    history,
  });
  // Strip any quotes the model wraps the sentence in
  const cleanText = text.replace(/^["'"'"]|["'"'"]$/g, '').trim();

  // Step 2: generate audio (non-fatal)
  let audioBase64: string | null = null;
  let mimeType: 'audio/mpeg' | 'audio/wav' = 'audio/mpeg';
  try {
    const result = await fetchDebateAudio(cleanText, archetype, language);
    audioBase64 = result.base64;
    mimeType = result.mimeType;
  } catch (e) {
    console.warn('[DebateArena] Audio fetch failed for turn, continuing silently:', e);
  }

  return { speakerSide, speakerName, text: cleanText, audioBase64, mimeType };
}

// ---------------------------------------------------------------------------
interface DebateTranslation {
  liveDebate: string;
  turns: (count: number) => string;
  conflictLabel: string;
  emptyText: string;
  loadingArgument: string;
  startDebate: string;
  restartDebate: string;
  stopDebate: string;
  noteText: string;
}

const DEBATE_TRANSLATIONS: Record<string, DebateTranslation> = {
  'en-IN': {
    liveDebate: 'LIVE DEBATE',
    turns: (count) => `${count} TURNS`,
    conflictLabel: 'CONFLICT:',
    emptyText: "Tap Start Debate — they'll fight it out with real voices, no breaks.",
    loadingArgument: 'loading argument...',
    startDebate: 'Start Debate',
    restartDebate: 'Restart',
    stopDebate: 'Stop',
    noteText: 'AI voices · Arguments pre-loaded · Runs until stopped',
  },
  'hi-IN': {
    liveDebate: 'लाइव बहस',
    turns: (count) => `${count} बारी`,
    conflictLabel: 'संघर्ष:',
    emptyText: 'बहस शुरू करें पर टैप करें - वे बिना किसी रोक के वास्तविक आवाजों के साथ मुकाबला करेंगे।',
    loadingArgument: 'तर्क लोड हो रहा है...',
    startDebate: 'बहस शुरू करें',
    restartDebate: 'पुनः आरंभ करें',
    stopDebate: 'रोकें',
    noteText: 'एआई आवाजें · तर्क प्री-लोडेड · रुकने तक चलता है',
  },
  'te-IN': {
    liveDebate: 'లైవ్ చర్చ',
    turns: (count) => `${count} వంతులు`,
    conflictLabel: 'వైరుధ్యం:',
    emptyText: 'చర్చను ప్రారంభించండి నొక్కండి — వారు నిజమైన వాయిస్‌లతో నిరంతరంగా చర్చించుకుంటారు.',
    loadingArgument: 'వాదన లోడ్ అవుతోంది...',
    startDebate: 'చర్చను ప్రారంభించండి',
    restartDebate: 'మళ్లీ ప్రారంభించండి',
    stopDebate: 'ఆపివేయి',
    noteText: 'AI వాయిస్‌లు · వాదనలు ప్రీ-లోడ్ చేయబడ్డాయి · ఆపే వరకు నడుస్తుంది',
  },
};

interface FighterCardProps {
  name: string;
  side: 'A' | 'B';
  isActive: boolean;
  pulseAnim: any;
}

function FighterCard({ name, side, isActive, pulseAnim }: FighterCardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.fighterCard,
        {
          borderColor: isActive
            ? side === 'A' ? theme.conflict : theme.primary
            : theme.outline,
          backgroundColor: isActive
            ? side === 'A' ? theme.conflictContainer : theme.primaryContainer
            : 'transparent',
        },
      ]}
    >
      <View style={[styles.sideBadge, { backgroundColor: side === 'A' ? theme.conflict : theme.primary }]}>
        <ThemedText type="code" style={[styles.sideLetter, { color: theme.surface }]}>{side}</ThemedText>
      </View>
      <ThemedText
        type="smallBold"
        numberOfLines={2}
        style={[styles.fighterName, { color: isActive ? (side === 'A' ? theme.conflict : theme.primary) : theme.text }]}
      >
        {name}
      </ThemedText>
      {isActive && (
        <Animated.View style={[styles.dot, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.dotInner, { backgroundColor: side === 'A' ? theme.conflict : theme.primary }]} />
        </Animated.View>
      )}
    </View>
  );
}

export function DebateArena({
  conflict,
  decisionContext,
  stakeholders,
  language = 'unknown',
  onClose,
}: DebateArenaProps) {
  const theme = useTheme();

  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // true only for very first turn
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<'groupA' | 'groupB'>('groupA');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);

  // Refs
  const isRunningRef = useRef(false);
  const historyRef = useRef<{ speaker: string; text: string }[]>([]);
  const activePlayerRef = useRef<any>(null);
  const scrollRef = useRef<ScrollView>(null);
  const runPipelineRef = useRef<((promise: Promise<PrefetchedTurn>) => Promise<void>) | null>(null);

  // Pulsing animation
  const pulseAnim = React.useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    if (isRunning || isLoading) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 550, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isRunning, isLoading, pulseAnim]);

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      if (activePlayerRef.current) {
        activePlayerRef.current.pause();
        activePlayerRef.current.release();
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Pipeline loop
  // ---------------------------------------------------------------------------

  /**
   * runPipeline starts with a Promise for the current turn (already in-flight),
   * plays it, then recursively prefetches + plays the next turn.
   */
  const runPipeline = useCallback(
    async (currentTurnPromise: Promise<PrefetchedTurn>) => {
      if (!isRunningRef.current) return;

      let turn: PrefetchedTurn;
      try {
        turn = await currentTurnPromise;
      } catch (err: any) {
        console.error('[DebateArena] Turn fetch error:', err);
        if (isRunningRef.current) {
          setErrorMessage(err.message || 'Failed to generate argument.');
          setIsRunning(false);
          setIsLoading(false);
          isRunningRef.current = false;
        }
        return;
      }

      if (!isRunningRef.current) return;

      // ── Show text immediately ──────────────────────────────────────────────
      const entryId = `turn-${Date.now()}-${Math.random()}`;
      setTranscript((prev) => [
        ...prev.map((e) => ({ ...e, isActive: false })),
        { id: entryId, speaker: turn.speakerSide, speakerName: turn.speakerName, text: turn.text, isActive: true },
      ]);
      historyRef.current = [...historyRef.current, { speaker: turn.speakerName, text: turn.text }].slice(-10);
      setCurrentSpeaker(turn.speakerSide);
      setTurnCount((c) => c + 1);
      setIsLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

      // ── Start prefetching NEXT turn immediately (runs in background) ───────
      const nextSide: 'groupA' | 'groupB' = turn.speakerSide === 'groupA' ? 'groupB' : 'groupA';
      const nextTurnPromise = prefetchTurn({
        speakerSide: nextSide,
        conflict,
        decisionContext,
        history: historyRef.current, // snapshot of history with this turn included
        stakeholders,
        language,
      });

      // ── Play current audio ─────────────────────────────────────────────────
      if (turn.audioBase64 && isRunningRef.current) {
        await playBase64Audio(turn.audioBase64, turn.mimeType, activePlayerRef);
      }

      if (!isRunningRef.current) return;

      // Deactivate this entry
      setTranscript((prev) => prev.map((e) => (e.id === entryId ? { ...e, isActive: false } : e)));

      // ── Next turn is likely already prefetched — minimal or zero gap ───────
      runPipelineRef.current?.(nextTurnPromise);
    },
    [conflict, decisionContext, stakeholders, language]
  );

  useEffect(() => {
    runPipelineRef.current = runPipeline;
  }, [runPipeline]);

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------

  const handleStart = useCallback(() => {
    setErrorMessage(null);
    setTranscript([]);
    historyRef.current = [];
    setCurrentSpeaker('groupA');
    setTurnCount(0);
    isRunningRef.current = true;
    setIsRunning(true);
    setIsLoading(true);

    // Kick off the first turn prefetch immediately
    const firstTurnPromise = prefetchTurn({
      speakerSide: 'groupA',
      conflict,
      decisionContext,
      history: [],
      stakeholders,
      language,
    });

    runPipeline(firstTurnPromise);
  }, [conflict, decisionContext, stakeholders, language, runPipeline]);

  const handleStop = useCallback(() => {
    isRunningRef.current = false;
    setIsRunning(false);
    setIsLoading(false);
    if (activePlayerRef.current) {
      activePlayerRef.current.pause();
      activePlayerRef.current.release();
      activePlayerRef.current = null;
    }
    setTranscript((prev) => prev.map((e) => ({ ...e, isActive: false })));
  }, []);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const activeIsA = (isRunning || isLoading) && currentSpeaker === 'groupA';
  const activeIsB = (isRunning || isLoading) && currentSpeaker === 'groupB';

  const currentLang = language === 'unknown' ? 'en-IN' : language;
  const t = DEBATE_TRANSLATIONS[currentLang] || DEBATE_TRANSLATIONS['en-IN'];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.outline }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.outline }]}>
        <View style={styles.headerLeft}>
          <SymbolView
            name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }}
            tintColor={theme.conflict}
            size={14}
          />
          <ThemedText type="code" style={[styles.headerTitle, { color: theme.conflict }]}>
            {t.liveDebate}
          </ThemedText>
          {turnCount > 0 && (
            <View style={[styles.turnBadge, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="code" style={[styles.turnBadgeText, { color: theme.textSecondary }]}>
                {t.turns(turnCount)}
              </ThemedText>
            </View>
          )}
          {(language === 'hi-IN' || language === 'te-IN') && (
            <View style={[styles.langBadge, { backgroundColor: theme.primaryContainer }]}>
              <ThemedText type="code" style={[styles.langBadgeText, { color: theme.primary }]}>
                {language === 'hi-IN' ? 'हिंदी' : 'తెలుగు'}
              </ThemedText>
            </View>
          )}
        </View>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.7 }]}
        >
          <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.text} size={14} />
        </Pressable>
      </View>

      {/* Conflict reason */}
      <View style={[styles.conflictBanner, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="code" style={[styles.conflictLabel, { color: theme.textSecondary }]}>
          {t.conflictLabel}
        </ThemedText>
        <ThemedText type="small" style={[styles.conflictReason, { color: theme.text }]} numberOfLines={2}>
          {conflict.reason}
        </ThemedText>
      </View>

      {/* Fighter cards */}
      <View style={styles.fightersRow}>
        <FighterCard name={conflict.groupA} side="A" isActive={activeIsA} pulseAnim={pulseAnim} />
        <View style={styles.vsContainer}>
          <View style={[styles.vsDivider, { backgroundColor: theme.outline }]} />
          <View style={[styles.vsCircle, { backgroundColor: theme.conflict, borderColor: theme.surface }]}>
            <ThemedText type="code" style={[styles.vsText, { color: theme.surface }]}>VS</ThemedText>
          </View>
          <View style={[styles.vsDivider, { backgroundColor: theme.outline }]} />
        </View>
        <FighterCard name={conflict.groupB} side="B" isActive={activeIsB} pulseAnim={pulseAnim} />
      </View>

      {/* Transcript */}
      <ScrollView
        ref={scrollRef}
        style={[styles.transcriptScroll, { borderColor: theme.outline }]}
        contentContainerStyle={styles.transcriptContent}
        showsVerticalScrollIndicator={false}
      >
        {transcript.length === 0 && !isLoading && (
          <View style={styles.empty}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              {t.emptyText}
            </ThemedText>
          </View>
        )}

        {transcript.map((entry) => {
          const isA = entry.speaker === 'groupA';
          return (
            <View key={entry.id} style={[styles.bubbleRow, isA ? styles.rowLeft : styles.rowRight]}>
              <View
                style={[
                  styles.bubble,
                  {
                    backgroundColor: isA ? theme.conflictContainer : theme.primaryContainer,
                    borderColor: isA ? theme.conflict + '44' : theme.primary + '44',
                  },
                  entry.isActive && styles.bubbleActive,
                ]}
              >
                <ThemedText type="code" style={[styles.bubbleName, { color: isA ? theme.conflict : theme.primary }]}>
                  {entry.speakerName}
                </ThemedText>
                <ThemedText type="small" style={[styles.bubbleText, { color: theme.text }]}>
                  {entry.text}
                </ThemedText>
              </View>
            </View>
          );
        })}

        {/* Loading indicator for first turn */}
        {isLoading && (
          <View style={[styles.bubbleRow, styles.rowLeft]}>
            <View style={[styles.bubble, { backgroundColor: theme.conflictContainer, borderColor: theme.conflict + '44' }]}>
              <ThemedText type="code" style={[styles.bubbleName, { color: theme.conflict }]}>
                {conflict.groupA}
              </ThemedText>
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={theme.conflict} />
                <ThemedText type="code" style={[styles.typingText, { color: theme.textSecondary }]}>
                  {t.loadingArgument}
                </ThemedText>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Error */}
      {errorMessage && (
        <View style={[styles.errorBanner, { backgroundColor: theme.errorContainer }]}>
          <ThemedText type="code" style={[styles.errorText, { color: theme.error }]} numberOfLines={2}>
            {errorMessage}
          </ThemedText>
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { borderTopColor: theme.outline }]}>
        {!isRunning && !isLoading ? (
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [styles.startBtn, { backgroundColor: theme.conflict }, pressed && { opacity: 0.85 }]}
          >
            <SymbolView
              name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }}
              tintColor={theme.surface}
              size={15}
            />
            <ThemedText type="smallBold" style={[styles.btnText, { color: theme.surface }]}>
              {transcript.length > 0 ? t.restartDebate : t.startDebate}
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleStop}
            style={({ pressed }) => [
              styles.stopBtn,
              { backgroundColor: theme.backgroundElement, borderColor: theme.outline },
              pressed && { opacity: 0.8 },
            ]}
          >
            <SymbolView name={{ ios: 'stop.fill', android: 'stop', web: 'stop' }} tintColor={theme.error} size={15} />
            <ThemedText type="smallBold" style={[styles.btnText, { color: theme.error }]}>{t.stopDebate}</ThemedText>
          </Pressable>
        )}
      </View>

      <ThemedText type="code" themeColor="textSecondary" style={styles.note}>
        {t.noteText}
      </ThemedText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  turnBadge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 999 },
  turnBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  langBadge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 999 },
  langBadgeText: { fontSize: 9, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  conflictBanner: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, gap: 2 },
  conflictLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  conflictReason: { fontSize: 12, lineHeight: 17, opacity: 0.85 },
  fightersRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  fighterCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.two,
    gap: Spacing.one,
    minHeight: 76,
    justifyContent: 'space-between',
  },
  sideBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideLetter: { fontSize: 9, fontWeight: '900' },
  fighterName: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  dot: { width: 10, height: 10, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
  dotInner: { width: 8, height: 8, borderRadius: 4 },
  vsContainer: { alignItems: 'center', justifyContent: 'center', width: 32, flexShrink: 0 },
  vsDivider: { flex: 1, width: 1.5 },
  vsCircle: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', marginVertical: 4,
  },
  vsText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  transcriptScroll: {
    flex: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginHorizontal: Spacing.three,
    borderRadius: 12,
    marginBottom: Spacing.two,
    maxHeight: 260,
  },
  transcriptContent: { padding: Spacing.two, gap: Spacing.two },
  empty: { padding: Spacing.four, alignItems: 'center' },
  emptyText: { textAlign: 'center', fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  bubbleRow: { flexDirection: 'row' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.two,
    gap: 3,
    maxWidth: '80%',
    flexShrink: 1,
  },
  bubbleActive: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.12)',
      },
    }),
  },
  bubbleName: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  bubbleText: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  typingText: { fontSize: 11, fontStyle: 'italic' },
  errorBanner: { marginHorizontal: Spacing.three, marginBottom: Spacing.two, padding: Spacing.two, borderRadius: 8 },
  errorText: { fontSize: 11 },
  controls: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderTopWidth: 1 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.three, borderRadius: 999, gap: Spacing.two,
  },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.three, borderRadius: 999, gap: Spacing.two, borderWidth: 1.5,
  },
  btnText: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 9, textAlign: 'center', paddingBottom: Spacing.three, letterSpacing: 0.3 },
});
