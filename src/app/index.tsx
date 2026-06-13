import React, { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Audio } from 'expo-av';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StakeholderCard } from '@/components/StakeholderCard';
import { BlindSpotAlert } from '@/components/BlindSpotAlert';
import { VoicePlayer } from '@/components/VoicePlayer';
import { ConflictMap } from '@/components/ConflictMap';
import { DebateArena } from '@/components/DebateArena';
import { AccountabilityLedger } from '@/components/AccountabilityLedger';
import { EquityIndex } from '@/components/EquityIndex';
import { MOCK_SIMULATIONS, SimulationRecord, Stakeholder, ConflictPair } from '@/constants/mockData';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { AnalysisLoader } from '@/components/AnalysisLoader';
import { analyzeDecision, refineTranscript } from '@/services/gemini';
import { saveSimulation } from '@/services/mongodb';
import { speechToText, translateAndSpeak } from '@/services/sarvam';
import { generateVoice } from '@/services/elevenlabs';

const detectLanguageFromText = (text: string): 'en-IN' | 'hi-IN' | 'te-IN' => {
  // Check Devanagari range (Hindi)
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi-IN';
  }
  // Check Telugu range (Telugu)
  if (/[\u0C00-\u0C7F]/.test(text)) {
    return 'te-IN';
  }
  return 'en-IN';
};

export default function HomeScreen() {
  const theme = useTheme();

  // Core state
  const [proposalText, setProposalText] = useState('');
  const [rawTranscriptText, setRawTranscriptText] = useState('');
  const [spokenLanguage, setSpokenLanguage] = useState<'unknown' | 'en-IN' | 'hi-IN' | 'te-IN'>('unknown');
  // Ref mirrors spokenLanguage so runAnalysis always reads the current value
  // even if called before React has flushed the setState.
  const spokenLanguageRef = useRef<'unknown' | 'en-IN' | 'hi-IN' | 'te-IN'>('unknown');
  const [currentSimulation, setCurrentSimulation] = useState<SimulationRecord | null>(null);
  const [englishSimulation, setEnglishSimulation] = useState<SimulationRecord | null>(null);
  const [showEnglish, setShowEnglish] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [summaryAudioState, setSummaryAudioState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  const [selectedDebateConflict, setSelectedDebateConflict] = useState<ConflictPair | null>(null);

  // Summary inline audio refs (web: HTMLAudioElement)
  const summaryAudioRef = useRef<HTMLAudioElement | null>(null);

  const destroySummaryAudio = () => {
    if (summaryAudioRef.current) {
      summaryAudioRef.current.pause();
      summaryAudioRef.current.src = '';
      summaryAudioRef.current = null;
    }
  };

  const handleSummaryPlayPause = async () => {
    if (summaryAudioState === 'loading') return;
    // Always use English text for the audio pipeline — Sarvam translates it
    const englishSim = currentSimulation?._englishVersion ?? currentSimulation;
    const text = englishSim?.conflictSummary || englishSim?.summary || '';
    if (!text) return;

    // Pause if playing
    if (summaryAudioState === 'playing' && summaryAudioRef.current) {
      summaryAudioRef.current.pause();
      setSummaryAudioState('paused');
      return;
    }

    // Resume if paused
    if (summaryAudioState === 'paused' && summaryAudioRef.current) {
      await summaryAudioRef.current.play();
      setSummaryAudioState('playing');
      return;
    }

    // Fresh load & play
    setSummaryAudioState('loading');
    destroySummaryAudio();

    try {
      const lang = spokenLanguage === 'hi-IN' ? 'hi-IN' : (spokenLanguage === 'te-IN' ? 'te-IN' : 'English');
      let base64: string;
      let mimeType: string;

      if (lang === 'English') {
        base64 = await generateVoice(text, 'default');
        mimeType = 'audio/mpeg';
      } else {
        base64 = await translateAndSpeak(text, lang);
        mimeType = 'audio/wav';
      }

      const dataUri = `data:${mimeType};base64,${base64}`;
      // Cast to HTMLAudioElement constructor explicitly — `typeof Audio` would resolve
      // to expo-av's Audio (which has no construct signature), causing a TS error.
      const AudioCtor = (typeof window !== 'undefined' ? window.Audio : null) as
        | (new (src?: string) => HTMLAudioElement)
        | null;
      if (!AudioCtor) throw new Error('Audio not available on this platform');
      const audio = new AudioCtor(dataUri);
      summaryAudioRef.current = audio;

      audio.addEventListener('ended', () => {
        setSummaryAudioState('idle');
      });

      await audio.play();
      setSummaryAudioState('playing');
    } catch (err: any) {
      console.error('Summary audio error:', err);
      setSummaryAudioState('error');
    }
  };

  // Cleanup summary audio on unmount
  useEffect(() => {
    return () => { destroySummaryAudio(); };
  }, []);

  // Autoplay summary audio when a new simulation result arrives
  useEffect(() => {
    if (currentSimulation) {
      // Small delay so the results section has rendered
      const t = setTimeout(() => { handleSummaryPlayPause(); }, 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSimulation?.id]);

  // Recording & Transcription State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingObj, setRecordingObj] = useState<Audio.Recording | null>(null);

  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, []);

  // Audio permission request helper
  const requestRecordingPermissions = async () => {
    if (Platform.OS === 'web') return true;
    const response = await Audio.requestPermissionsAsync();
    return response.granted;
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setProposalText('');
    setRawTranscriptText('');
    try {
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach((track) => track.stop());
          
          setIsTranscribing(true);
          try {
            const rawText = await speechToText(audioBlob, spokenLanguage);
            setRawTranscriptText(rawText);
            
            // Auto detect language from raw text if user selected Auto Detect
            if (spokenLanguage === 'unknown') {
              const detected = detectLanguageFromText(rawText);
              // Update ref immediately so runAnalysis sees the correct language
              // even before React flushes the setState below.
              spokenLanguageRef.current = detected;
              setSpokenLanguage(detected);
            }

            const refinedText = await refineTranscript(rawText);
            setProposalText(refinedText);
          } catch (err: any) {
            setErrorMessage(err.message || 'Speech-to-text failed. Check your API key.');
          } finally {
            setIsTranscribing(false);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingDuration(0);
        durationTimerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      } else {
        const hasPermission = await requestRecordingPermissions();
        if (!hasPermission) {
          setErrorMessage('Microphone permission denied.');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

        setRecordingObj(recording);
        setIsRecording(true);
        setRecordingDuration(0);
        durationTimerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    setIsRecording(false);

    try {
      if (Platform.OS === 'web') {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
        }
      } else {
        if (recordingObj) {
          await recordingObj.stopAndUnloadAsync();
          const uri = recordingObj.getURI();
          setRecordingObj(null);

          if (uri) {
            setIsTranscribing(true);
            try {
              const rawText = await speechToText(uri, spokenLanguage);
              setRawTranscriptText(rawText);
              
              // Auto detect language from raw text if user selected Auto Detect
              if (spokenLanguage === 'unknown') {
                const detected = detectLanguageFromText(rawText);
                // Update ref immediately so runAnalysis sees the correct language
                // even before React flushes the setState below.
                spokenLanguageRef.current = detected;
                setSpokenLanguage(detected);
              }

              const refinedText = await refineTranscript(rawText);
              setProposalText(refinedText);
            } catch (err: any) {
              setErrorMessage(err.message || 'Speech-to-text failed.');
            } finally {
              setIsTranscribing(false);
            }
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to stop recording');
    }
  };

  // Error state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bottom sheet animation
  const [bottomSheetAnim] = useState(() => new Animated.Value(0));

  // ---------------------------------------------------------------------------
  // Bottom sheet helpers
  // ---------------------------------------------------------------------------
  const openStakeholderDetail = (stakeholder: Stakeholder) => {
    setSelectedStakeholder(stakeholder);
    Animated.timing(bottomSheetAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeStakeholderDetail = () => {
    Animated.timing(bottomSheetAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setSelectedStakeholder(null);
    });
  };

  // ---------------------------------------------------------------------------
  // Analysis — calls Gemini, saves to MongoDB
  // ---------------------------------------------------------------------------
  const runAnalysis = async (text: string) => {
    setErrorMessage(null);
    setCurrentSimulation(null);
    setEnglishSimulation(null);
    setShowEnglish(false);
    setIsLoading(true);

    try {
      // Read from the ref — not the state — to get the language that was
      // detected/selected during the recording phase. The state may not have
      // been flushed yet when this function executes.
      const effectiveLang = spokenLanguageRef.current;
      const targetLang = (effectiveLang === 'hi-IN' || effectiveLang === 'te-IN')
        ? effectiveLang
        : undefined;

      const simulation = await analyzeDecision(text, targetLang);

      // If a translation was done, store the English original separately
      if (simulation._englishVersion) {
        setEnglishSimulation(simulation._englishVersion as SimulationRecord);
      }
      setCurrentSimulation(simulation);

      // Persist to MongoDB (fire-and-forget, non-blocking)
      saveSimulation(simulation).catch((err) => {
        console.warn('Failed to save simulation to MongoDB:', err);
      });
    } catch (error: any) {
      setErrorMessage(
        error?.message ?? 'Analysis failed. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = () => {
    if (proposalText.trim().length === 0) return;
    runAnalysis(proposalText.trim());
  };

  const handleReset = () => {
    destroySummaryAudio();
    setCurrentSimulation(null);
    setEnglishSimulation(null);
    setShowEnglish(false);
    setProposalText('');
    setRawTranscriptText('');
    setErrorMessage(null);
    setSummaryAudioState('idle');
    setSelectedDebateConflict(null);
  };

  const handleOpenDebate = (conflict: ConflictPair) => {
    setSelectedDebateConflict(conflict);
  };

  const handleCloseDebate = () => {
    setSelectedDebateConflict(null);
  };

  const handleRetry = () => {
    if (proposalText.trim().length > 0) {
      runAnalysis(proposalText.trim());
    }
  };

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  // When a translation is available, toggle between translated and English views
  const displayedSimulation = (showEnglish && englishSimulation) ? englishSimulation : currentSimulation;

  const overlookedStakeholders = displayedSimulation
    ? displayedSimulation.stakeholders
        .filter((s) => s.isOverlooked)
        .map((s) => ({ name: s.name, reason: s.description }))
    : [];

  const translateY = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [700, 0],
  });

  const overlayOpacity = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });


  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* ── INPUT PANEL ── */}
          {!currentSimulation && !isLoading && !errorMessage && (
            <View style={styles.dashboardCard}>
              <ThemedText type="subtitle" style={styles.welcomeTitle}>
                Examine Proposed Decisions
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.welcomeDesc}>
                Tap the microphone to record your proposed decision. Echo will transcribe your voice using Sarvam AI and surface structural blind spots.
              </ThemedText>

              {/* Language Selector */}
              <View style={styles.langSelectorRow}>
                {[
                  { code: 'unknown', label: 'Auto Detect' },
                  { code: 'en-IN', label: 'English' },
                  { code: 'hi-IN', label: 'Hindi' },
                  { code: 'te-IN', label: 'Telugu' },
                ].map((lang) => {
                  const isActive = spokenLanguage === lang.code;
                  return (
                    <Pressable
                      key={lang.code}
                      onPress={() => {
                        // Update both state (for UI) and ref (for runAnalysis) synchronously
                        const code = lang.code as 'unknown' | 'en-IN' | 'hi-IN' | 'te-IN';
                        spokenLanguageRef.current = code;
                        setSpokenLanguage(code);
                      }}
                      style={[
                        styles.langPill,
                        isActive && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                        { borderColor: theme.outline }
                      ]}>
                      <ThemedText
                        type="code"
                        style={[
                          styles.langPillText,
                          isActive ? { color: theme.primary, fontWeight: '700' } : { color: theme.textSecondary }
                        ]}>
                        {lang.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {/* Recording interface — big centered mic */}
              <View style={styles.micArea}>
                {isTranscribing ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator color={theme.primary} size="large" />
                    <ThemedText type="code" themeColor="textSecondary" style={styles.statusLabel}>
                      TRANSCRIBING VOICE VIA SARVAM AI...
                    </ThemedText>
                  </View>
                ) : isRecording ? (
                  <Pressable onPress={stopRecording} style={styles.micCircleActive}>
                    <SymbolView
                      name={{ ios: 'stop.fill', android: 'stop', web: 'stop' }}
                      tintColor={theme.error}
                      size={48}
                    />
                    <ThemedText type="code" style={[styles.micCircleLabel, { color: theme.error }]}>
                      {recordingDuration}s
                    </ThemedText>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={startRecording}
                    style={({ pressed }) => [
                      styles.micCircle,
                      { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                      pressed && { transform: [{ scale: 0.93 }] },
                    ]}>
                    <SymbolView
                      name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
                      tintColor={theme.primary}
                      size={64}
                    />
                  </Pressable>
                )}
              </View>

              {/* Display transcribed proposal */}
              {proposalText.trim().length > 0 && !isRecording && !isTranscribing && (
                <View style={[styles.transcriptionBox, { borderLeftColor: theme.primary }]}>
                  {rawTranscriptText.trim().length > 0 && (
                    <>
                      <ThemedText type="code" themeColor="textSecondary" style={styles.transcriptionHeader}>
                        RAW SPEECH TRANSCRIPT (SARVAM AI STT):
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={[styles.transcriptionText, { marginBottom: Spacing.two, opacity: 0.8 }]}>
                        &ldquo;{rawTranscriptText}&rdquo;
                      </ThemedText>
                    </>
                  )}
                  <ThemedText type="code" themeColor="primary" style={styles.transcriptionHeader}>
                    REFINED DECISION PROPOSAL (GEMINI 2.5 FLASH):
                  </ThemedText>
                  <ThemedText type="small" style={styles.transcriptionText}>
                    &ldquo;{proposalText}&rdquo;
                  </ThemedText>
                </View>
              )}

              {/* Analyze button */}
              {proposalText.trim().length > 0 && !isRecording && !isTranscribing && (
                <Pressable
                  onPress={handleAnalyze}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      backgroundColor: theme.primary,
                    },
                    pressed && { opacity: 0.9 },
                  ]}>
                  <SymbolView
                    name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                    tintColor={theme.surface}
                    size={16}
                  />
                  <ThemedText type="smallBold" style={[styles.primaryButtonText, { color: theme.surface }]}>
                    Analyze Decision
                  </ThemedText>
                </Pressable>
              )}
            </View>
          )}

          {/* ── ERROR STATE ── */}
          {errorMessage && !isLoading && (
            <View style={styles.dashboardCard}>
              <View style={[styles.errorCard, { backgroundColor: theme.errorContainer, borderColor: theme.error + '40' }]}>
                <SymbolView
                  name={{ ios: 'exclamationmark.triangle.fill', android: 'error', web: 'error' }}
                  tintColor={theme.error}
                  size={24}
                />
                <ThemedText type="smallBold" style={[styles.errorTitle, { color: theme.error }]}>
                  Analysis Failed
                </ThemedText>
                <ThemedText type="small" style={[styles.errorDesc, { color: theme.error + 'CC' }]}>
                  {errorMessage}
                </ThemedText>
                <Pressable
                  onPress={handleRetry}
                  style={({ pressed }) => [
                    styles.retryButton,
                    { backgroundColor: theme.error },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.surface }}>
                    Try Again
                  </ThemedText>
                </Pressable>
                <Pressable onPress={handleReset}>
                  <ThemedText type="linkPrimary" style={styles.backLink}>
                    ← Back to input
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── LOADING STATE ── */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <AnalysisLoader isAnalyzing={isLoading} />
            </View>
          )}

          {/* ── RESULTS ── */}
          {currentSimulation && !isLoading && (
            <View style={styles.resultsContainer}>
              <EquityIndex
                stakeholders={displayedSimulation?.stakeholders || []}
                conflicts={displayedSimulation?.conflicts || []}
                blindSpots={displayedSimulation?.blindSpots || []}
              />
              
              {/* Language toggle — only shown when a translation is available */}
              {englishSimulation && (
                <Pressable
                  onPress={() => setShowEnglish((v) => !v)}
                  style={({ pressed }) => [
                    styles.langToggleBtn,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.outline },
                    pressed && { opacity: 0.75 },
                  ]}>
                  <SymbolView
                    name={{
                      ios: showEnglish ? 'globe' : 'character.bubble',
                      android: showEnglish ? 'language' : 'translate',
                      web: showEnglish ? 'language' : 'translate',
                    }}
                    tintColor={theme.textSecondary}
                    size={12}
                  />
                  <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 11 }}>
                    {showEnglish
                      ? (spokenLanguage === 'hi-IN' ? 'हिंदी में देखें' : 'తెలుగులో చూడండి')
                      : 'View in English'}
                  </ThemedText>
                </Pressable>
              )}

              {/* Proposal Banner */}
              <View style={[styles.proposalBanner, { borderLeftColor: theme.primary }]}>
                <View style={styles.bannerHeaderRow}>
                  <ThemedText type="code" themeColor="primary" style={styles.bannerLabel}>
                    PROPOSAL UNDER ANALYSIS
                  </ThemedText>

                </View>
                <ThemedText type="smallBold" style={styles.bannerTitle}>
                  {rawTranscriptText || proposalText}
                </ThemedText>
              </View>

              {/* Minimal Summary Audio Bar — single source of summary + one pause button */}
              {(displayedSimulation?.conflictSummary || displayedSimulation?.summary) && (
                <View style={[styles.summaryBar, { borderColor: theme.outline, backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.summaryBarInner}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.summaryBarText}>
                      {displayedSimulation.conflictSummary || displayedSimulation.summary}
                    </ThemedText>
                    <Pressable
                      id="summary-play-btn"
                      onPress={handleSummaryPlayPause}
                      disabled={summaryAudioState === 'loading'}
                      style={({ pressed }) => [
                        styles.summaryBarPlayBtn,
                        { backgroundColor: summaryAudioState === 'error' ? theme.error : theme.primary },
                        pressed && { opacity: 0.85 },
                        summaryAudioState === 'loading' && { opacity: 0.6 },
                      ]}>
                      {summaryAudioState === 'loading' ? (
                        <ActivityIndicator size="small" color={theme.surface} />
                      ) : (
                        <SymbolView
                          name={{
                            ios: summaryAudioState === 'playing' ? 'pause.fill' : 'play.fill',
                            android: summaryAudioState === 'playing' ? 'pause' : 'play_arrow',
                            web: summaryAudioState === 'playing' ? 'pause' : 'play_arrow',
                          }}
                          tintColor={theme.surface}
                          size={14}
                        />
                      )}
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Stakeholder Directory */}
              <View style={styles.directoryHeader}>
                <ThemedText type="smallBold" style={styles.directoryTitle}>
                  Stakeholder Impact Directory
                </ThemedText>
                <ThemedText type="code" themeColor="textSecondary">
                  {displayedSimulation?.stakeholders.length} GROUPS
                </ThemedText>
              </View>

              {displayedSimulation?.stakeholders.map((stakeholder) => (
                <StakeholderCard
                  key={stakeholder.id}
                  name={stakeholder.name}
                  role={stakeholder.role}
                  impact={stakeholder.impact}
                  isOverlooked={stakeholder.isOverlooked}
                  description={stakeholder.description}
                  onPress={() => openStakeholderDetail(stakeholder)}
                />
              ))}

              {/* Blind Spot Alert */}
              <BlindSpotAlert stakeholders={overlookedStakeholders} />

              {/* Conflict Map */}
              {displayedSimulation?.conflicts && displayedSimulation.conflicts.length > 0 && (
                <ConflictMap
                  conflicts={displayedSimulation.conflicts}
                  onDebate={handleOpenDebate}
                />
              )}

              {/* Accountability Ledger */}
              <View style={{ marginTop: Spacing.four, borderTopWidth: 1, borderTopColor: theme.outline, paddingTop: Spacing.four, marginBottom: Spacing.two }}>
                <ThemedText type="code" themeColor="textSecondary" style={{ fontWeight: '700', letterSpacing: 0.5 }}>
                  ACCOUNTABILITY
                </ThemedText>
              </View>
              <AccountabilityLedger
                decision={displayedSimulation?.decisionTitle ?? ''}
                blindSpots={overlookedStakeholders.map((s) => s.name)}
              />

              {/* Reset button at the bottom */}
              <Pressable
                onPress={handleReset}
                style={({ pressed }) => [
                  styles.resetButtonBottom,
                  { borderColor: theme.outline },
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}>
                <SymbolView
                  name={{ ios: 'arrow.counterclockwise', android: 'refresh', web: 'refresh' }}
                  tintColor={theme.text}
                  size={14}
                />
                <ThemedText type="code" style={{ fontWeight: '700' }}>New Analysis</ThemedText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── BOTTOM SHEET OVERLAY ── */}
      {selectedStakeholder && (
        <Animated.View
          style={[
            styles.overlay,
            { backgroundColor: '#000000', opacity: overlayOpacity },
          ]}>
          <Pressable style={styles.overlayPressable} onPress={closeStakeholderDetail} />
        </Animated.View>
      )}

      {/* ── BOTTOM SHEET ── */}
      {selectedStakeholder && (
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.outline,
              transform: [{ translateY }],
            },
          ]}>
          {/* Handle */}
          <View style={styles.sheetHandleContainer}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.outline }]} />
          </View>

          <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <View style={styles.sheetNameRow}>
                  <ThemedText type="subtitle" style={styles.sheetName}>
                    {selectedStakeholder.name}
                  </ThemedText>
                  {selectedStakeholder.isOverlooked && (
                    <View style={[styles.sheetBadge, { backgroundColor: theme.warningContainer }]}>
                      <ThemedText
                        type="code"
                        style={{ color: theme.warning, fontSize: 10, fontWeight: '700' }}>
                        OVERLOOKED BLIND SPOT
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.sheetRole}>
                  {selectedStakeholder.role}
                </ThemedText>
              </View>

              <Pressable
                onPress={closeStakeholderDetail}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: theme.backgroundElement },
                  pressed && { opacity: 0.8 },
                ]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  tintColor={theme.text}
                  size={16}
                />
              </Pressable>
            </View>

            {/* Impact analysis */}
            <View style={styles.section}>
              <ThemedText type="code" themeColor="textSecondary" style={styles.sectionTitle}>
                POTENTIAL STRUCTURAL IMPACT:
              </ThemedText>
              <ThemedText type="small" style={styles.sheetDesc}>
                {selectedStakeholder.description}
              </ThemedText>
            </View>

            {/* Voice quote */}
            <View style={styles.section}>
              <ThemedText type="code" themeColor="textSecondary" style={styles.sectionTitle}>
                GENERATED PERSPECTIVE NARRATIVE:
              </ThemedText>
              <View style={[styles.quoteContainer, { borderLeftColor: theme.primary + '66' }]}>
                <SymbolView
                  name={{ ios: 'quote.bubble.fill', android: 'format_quote', web: 'format_quote' }}
                  tintColor={theme.primary + '33'}
                  size={24}
                  style={styles.quoteIcon}
                />
                <ThemedText type="small" style={[styles.quoteText, { fontStyle: 'italic' }]}>
                  &ldquo;{selectedStakeholder.voiceQuote}&rdquo;
                </ThemedText>
              </View>
            </View>

            {/* Conflict map for this stakeholder */}
            {currentSimulation?.conflicts &&
              currentSimulation.conflicts.filter(
                (c) =>
                  c.groupA === selectedStakeholder.name ||
                  c.groupB === selectedStakeholder.name
              ).length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="code" themeColor="textSecondary" style={styles.sectionTitle}>
                    CONFLICT INVOLVEMENT:
                  </ThemedText>
                  <ConflictMap
                    conflicts={currentSimulation.conflicts.filter(
                      (c) =>
                        c.groupA === selectedStakeholder.name ||
                        c.groupB === selectedStakeholder.name
                    )}
                    onDebate={handleOpenDebate}
                  />
                </View>
              )}

            {/* Voice player */}
            <View style={styles.voiceSection}>
              <VoicePlayer
                key={`stakeholder-${selectedStakeholder.id}-${spokenLanguage}`}
                speakerName={selectedStakeholder.name}
                voiceQuote={selectedStakeholder.voiceQuote}
                voiceArchetype={selectedStakeholder.voiceArchetype ?? 'default'}
                defaultLanguage={spokenLanguage === 'hi-IN' ? 'hi-IN' : (spokenLanguage === 'te-IN' ? 'te-IN' : 'English')}
              />
            </View>

            <ThemedText type="code" themeColor="textSecondary" style={styles.sarvamNote}>
              * English voices via ElevenLabs high-fidelity cloning. Hindi &amp; Telugu translation
              and speech synthesis powered by Sarvam AI.
            </ThemedText>

            <View style={{ height: BottomTabInset + Spacing.five }} />
          </ScrollView>
        </Animated.View>
      )}

      {/* ── DEBATE ARENA OVERLAY ── */}
      {selectedDebateConflict && currentSimulation && (
        <>
          {/* Dark scrim behind arena */}
          <Animated.View
            style={[
              styles.overlay,
              { backgroundColor: '#000000', opacity: 0.55 },
            ]}
          >
            <Pressable style={styles.overlayPressable} onPress={handleCloseDebate} />
          </Animated.View>

          {/* Arena panel */}
          <View style={styles.debateArenaContainer}>
            <DebateArena
              conflict={selectedDebateConflict}
              decisionContext={
                currentSimulation._englishVersion?.decisionTitle ??
                currentSimulation.decisionTitle
              }
              stakeholders={
                currentSimulation._englishVersion?.stakeholders ??
                currentSimulation.stakeholders
              }
              language={spokenLanguage === 'hi-IN' ? 'hi-IN' : spokenLanguage === 'te-IN' ? 'te-IN' : 'en-IN'}
              onClose={handleCloseDebate}
            />
          </View>
        </>
      )}

    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: { fontFamily: Fonts.serif.regular, fontSize: 24, lineHeight: 26 },
  appTagline: { fontFamily: Fonts.sans.bold, fontSize: 8, letterSpacing: 1, fontWeight: '700' },
  headerResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.sm,
    gap: Spacing.one,
  },
  resetText: { fontSize: 11, fontWeight: '700' },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingBottom: BottomTabInset + Spacing.five,
    alignItems: 'center',
    width: '100%',
  },
  dashboardCard: {
    maxWidth: MaxContentWidth,
    width: '100%',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    alignItems: 'stretch',
    gap: Spacing.three,
  },
  welcomeTitle: { fontFamily: Fonts.serif.regular, fontSize: 28, lineHeight: 34, fontWeight: '400' },
  welcomeDesc: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.two },
  inputContainer: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  textInput: {
    height: 100,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  charCountRow: {
    alignItems: 'flex-end',
    paddingTop: Spacing.one,
  },
  charCount: { fontSize: 10, fontWeight: '600' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.pill,
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700' },
  templateSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: Spacing.two,
    letterSpacing: 0.5,
  },
  templateContainer: { gap: Spacing.two },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1,
    gap: Spacing.three,
  },
  templateButtonText: { fontSize: 14, fontWeight: '600' },
  // Error state
  errorCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  errorTitle: { fontFamily: Fonts.serif.regular, fontSize: 22, lineHeight: 26, fontWeight: '400' },
  errorDesc: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: BorderRadius.pill,
    marginTop: Spacing.two,
  },
  backLink: { fontSize: 14, marginTop: Spacing.one },
  // Loading state
  loadingContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    alignItems: 'center',
    gap: Spacing.four,
  },
  loadingTitle: { fontSize: 18, fontWeight: '700' },
  loadingProgressBox: {
    alignSelf: 'stretch',
    padding: Spacing.four,
    borderRadius: BorderRadius.lg,
    gap: Spacing.three,
  },
  loadingStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  loadingStepText: { fontSize: 13, flex: 1 },
  // Results
  resultsContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    alignItems: 'stretch',
  },
  proposalBanner: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
    gap: Spacing.one,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  bannerLabel: { fontSize: 10, fontWeight: '700' },
  audioPlayingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  audioPlayingText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bannerTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  summaryText: { fontSize: 13, lineHeight: 18, marginTop: Spacing.one },
  summaryBar: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  summaryBarInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  summaryBarText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  summaryBarPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  directoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  directoryTitle: { fontFamily: Fonts.serif.regular, fontSize: 22, lineHeight: 26, fontWeight: '400' },
  // Bottom sheet
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  overlayPressable: { flex: 1 },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    borderLeftWidth: Platform.select({ web: 1, default: 0 }),
    borderRightWidth: Platform.select({ web: 1, default: 0 }),
    paddingTop: Spacing.two,
    zIndex: 100,
    maxHeight: '90%',
  },
  sheetHandleContainer: {
    alignItems: 'center',
    paddingBottom: Spacing.two,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2 },
  sheetContent: { paddingHorizontal: Spacing.four },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  sheetTitleGroup: { flex: 1, gap: 2 },
  sheetNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  sheetName: { fontFamily: Fonts.serif.regular, fontSize: 28, lineHeight: 34, fontWeight: '400' },
  sheetBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  sheetRole: { fontSize: 13 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: { marginBottom: Spacing.three, gap: Spacing.one },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  sheetDesc: { fontSize: 14, lineHeight: 20 },
  quoteContainer: {
    paddingVertical: Spacing.two,
    paddingLeft: Spacing.three,
    borderLeftWidth: 2,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  quoteIcon: { marginTop: -2 },
  quoteText: { flex: 1, fontSize: 14, lineHeight: 20 },
  voiceSection: { marginBottom: Spacing.three },
  sarvamNote: { fontSize: 10, lineHeight: 14, textAlign: 'center' },
  micArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.five,
    marginTop: Spacing.two,
  },
  micCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micCircleActive: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  micCircleLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loaderContainer: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: Spacing.two,
  },
  transcriptionBox: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
    marginVertical: Spacing.two,
  },
  transcriptionHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
  },
  transcriptionText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  resetButtonBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    marginTop: Spacing.four,
    marginBottom: Spacing.six,
    alignSelf: 'center',
  },
  debateArenaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '90%',
    zIndex: 200,
  },
  langSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
    flexWrap: 'wrap',
  },
  langPill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  langPillText: {
    fontSize: 10,
  },
  langToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    marginBottom: Spacing.two,
  },
});
