import React, { useState, useEffect, useRef } from 'react';
import {

  Animated,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StakeholderCard } from '@/components/StakeholderCard';
import { BlindSpotAlert } from '@/components/BlindSpotAlert';
import { VoicePlayer } from '@/components/VoicePlayer';
import { ConflictMap } from '@/components/ConflictMap';
import { AccountabilityLedger } from '@/components/AccountabilityLedger';
import { MOCK_SIMULATIONS, SimulationRecord, Stakeholder } from '@/constants/mockData';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { AnalysisLoader } from '@/components/AnalysisLoader';
import { analyzeDecision } from '@/services/gemini';
import { saveSimulation } from '@/services/mongodb';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const MAX_PROPOSAL_CHARS = 1000;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const theme = useTheme();

  // Core state
  const [proposalText, setProposalText] = useState('');
  const [currentSimulation, setCurrentSimulation] = useState<SimulationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);

  // Error state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bottom sheet animation
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;

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
    Keyboard.dismiss();
    setErrorMessage(null);
    setCurrentSimulation(null);
    setIsLoading(true);

    try {
      const hasApiKey = !!process.env.EXPO_PUBLIC_GEMINI_API_KEY;

      let simulation: SimulationRecord;

      if (hasApiKey) {
        // Real Gemini analysis
        simulation = await analyzeDecision(text);
      } else {
        // Demo mode — keyword-match to mock data
        await new Promise((resolve) => setTimeout(resolve, 8000));
        const lowerText = text.toLowerCase();
        if (lowerText.includes('cash') || lowerText.includes('card') || lowerText.includes('digital')) {
          simulation = MOCK_SIMULATIONS[1];
        } else if (lowerText.includes('office') || lowerText.includes('remote') || lowerText.includes('hybrid')) {
          simulation = MOCK_SIMULATIONS[2];
        } else {
          simulation = MOCK_SIMULATIONS[0];
        }
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

  const loadTemplate = (text: string) => {
    setProposalText(text);
    runAnalysis(text);
  };

  const handleReset = () => {
    setCurrentSimulation(null);
    setProposalText('');
    setErrorMessage(null);
  };

  const handleRetry = () => {
    if (proposalText.trim().length > 0) {
      runAnalysis(proposalText.trim());
    }
  };

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const overlookedStakeholders = currentSimulation
    ? currentSimulation.stakeholders
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

  const charCount = proposalText.length;
  const isOverLimit = charCount > MAX_PROPOSAL_CHARS;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={[styles.brandIcon, { backgroundColor: theme.primaryContainer }]}>
              <SymbolView
                name={{ ios: 'waveform.and.mic', android: 'record_voice_over', web: 'record_voice_over' }}
                tintColor={theme.primary}
                size={22}
              />
            </View>
            <View>
              <ThemedText type="smallBold" style={styles.appName}>
                Echo
              </ThemedText>
              <ThemedText type="code" themeColor="textSecondary" style={styles.appTagline}>
                DECISION BLIND SPOT DETECTOR
              </ThemedText>
            </View>
          </View>

          {currentSimulation && (
            <Pressable
              onPress={handleReset}
              style={({ pressed }) => [
                styles.headerResetButton,
                { backgroundColor: theme.backgroundElement },
                pressed && { opacity: 0.8 },
              ]}>
              <SymbolView
                name={{ ios: 'arrow.counterclockwise', android: 'refresh', web: 'refresh' }}
                tintColor={theme.text}
                size={14}
              />
              <ThemedText type="code" style={styles.resetText}>New Analysis</ThemedText>
            </Pressable>
          )}
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {/* ── INPUT PANEL ── */}
            {!currentSimulation && !isLoading && !errorMessage && (
              <View style={styles.dashboardCard}>
                <ThemedText type="subtitle" style={styles.welcomeTitle}>
                  Examine Proposed Decisions
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.welcomeDesc}>
                  Enter a proposed policy, regulation, or organisational decision. Echo surfaces
                  every affected stakeholder — including the ones nobody thought to ask.
                </ThemedText>

                {/* Text input */}
                <View
                  style={[
                    styles.inputContainer,
                    {
                      borderColor: isOverLimit ? theme.error : theme.outline,
                      backgroundColor: theme.inputBackground,
                    },
                  ]}>
                  <TextInput
                    style={[styles.textInput, { color: theme.text }]}
                    placeholder="e.g. Mandatory 85% attendance requirement for all courses, excluding internships..."
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={4}
                    value={proposalText}
                    onChangeText={setProposalText}
                    maxLength={MAX_PROPOSAL_CHARS + 50} // allow slightly over for visual feedback
                  />
                  {/* Character counter */}
                  <View style={styles.charCountRow}>
                    <ThemedText
                      type="code"
                      style={[
                        styles.charCount,
                        { color: isOverLimit ? theme.error : theme.textSecondary },
                      ]}>
                      {charCount} / {MAX_PROPOSAL_CHARS}
                    </ThemedText>
                  </View>
                </View>

                {/* Analyze button */}
                <Pressable
                  onPress={handleAnalyze}
                  disabled={proposalText.trim().length === 0 || isOverLimit}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      backgroundColor:
                        proposalText.trim().length === 0 || isOverLimit
                          ? theme.outline
                          : theme.primary,
                    },
                    pressed && { opacity: 0.9 },
                  ]}>
                  <SymbolView
                    name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                    tintColor={
                      proposalText.trim().length === 0 || isOverLimit
                        ? theme.textSecondary
                        : theme.surface
                    }
                    size={16}
                  />
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.primaryButtonText,
                      {
                        color:
                          proposalText.trim().length === 0 || isOverLimit
                            ? theme.textSecondary
                            : theme.surface,
                      },
                    ]}>
                    Analyze Decision
                  </ThemedText>
                </Pressable>

                {/* Quick start templates */}
                <ThemedText type="code" themeColor="textSecondary" style={styles.templateSectionTitle}>
                  OR TRY AN EXAMPLE:
                </ThemedText>

                <View style={styles.templateContainer}>
                  {[
                    {
                      label: 'Mandatory 85% Attendance',
                      text: 'Mandatory 85% attendance policy for all courses',
                      icon: { ios: 'graduationcap.fill', android: 'school', web: 'school' },
                    },
                    {
                      label: '100% Cashless Campus',
                      text: 'Transitioning to a 100% cashless campus',
                      icon: { ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' },
                    },
                    {
                      label: 'Mandatory Return-to-Office',
                      text: 'Mandatory return-to-office 5 days a week',
                      icon: { ios: 'briefcase.fill', android: 'work', web: 'work' },
                    },
                  ].map((template) => (
                    <Pressable
                      key={template.label}
                      onPress={() => loadTemplate(template.text)}
                      style={({ pressed }) => [
                        styles.templateButton,
                        { borderColor: theme.outline, backgroundColor: theme.surface },
                        pressed && { backgroundColor: theme.backgroundElement },
                      ]}>
                      <SymbolView
                        name={template.icon as any}
                        tintColor={theme.primary}
                        size={16}
                      />
                      <ThemedText type="small" style={styles.templateButtonText}>
                        {template.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
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
                {/* Proposal Banner */}
                <View style={[styles.proposalBanner, { backgroundColor: theme.surface, borderColor: theme.outline }]}>
                  <ThemedText type="code" themeColor="primary" style={styles.bannerLabel}>
                    PROPOSAL UNDER ANALYSIS
                  </ThemedText>
                  <ThemedText type="smallBold" style={styles.bannerTitle}>
                    {currentSimulation.decisionTitle}
                  </ThemedText>
                  {currentSimulation.summary && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.summaryText}>
                      {currentSimulation.summary}
                    </ThemedText>
                  )}
                </View>

                {/* Blind Spot Alert */}
                <BlindSpotAlert stakeholders={overlookedStakeholders} />

                {/* Conflict Map */}
                {currentSimulation.conflicts && currentSimulation.conflicts.length > 0 && (
                  <ConflictMap conflicts={currentSimulation.conflicts} />
                )}

                {/* Stakeholder Directory */}
                <View style={styles.directoryHeader}>
                  <ThemedText type="smallBold" style={styles.directoryTitle}>
                    Stakeholder Impact Directory
                  </ThemedText>
                  <ThemedText type="code" themeColor="textSecondary">
                    {currentSimulation.stakeholders.length} GROUPS
                  </ThemedText>
                </View>

                {currentSimulation.stakeholders.map((stakeholder) => (
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

                {/* Accountability Ledger */}
                <View style={{ marginTop: Spacing.four, borderTopWidth: 1, borderTopColor: theme.outline, paddingTop: Spacing.four, marginBottom: Spacing.two }}>
                  <ThemedText type="code" themeColor="textSecondary" style={{ fontWeight: '700', letterSpacing: 0.5 }}>
                    ACCOUNTABILITY
                  </ThemedText>
                </View>
                <AccountabilityLedger 
                  decision={currentSimulation.decisionTitle} 
                  blindSpots={overlookedStakeholders.map((s) => s.name)} 
                />
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
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
              <View style={[styles.quoteContainer, { backgroundColor: theme.background, borderColor: theme.outline }]}>
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
                  />
                </View>
              )}

            {/* Voice player */}
            <View style={styles.voiceSection}>
              <VoicePlayer
                speakerName={selectedStakeholder.name}
                voiceQuote={selectedStakeholder.voiceQuote}
                voiceArchetype={selectedStakeholder.voiceArchetype ?? 'default'}
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
  appName: { fontSize: 18, fontWeight: '700', lineHeight: 20 },
  appTagline: { fontSize: 8, letterSpacing: 1, fontWeight: '700' },
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
  welcomeTitle: { fontSize: 24, fontWeight: '700' },
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
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
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
  errorTitle: { fontSize: 18, fontWeight: '700' },
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
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.one,
  },
  bannerLabel: { fontSize: 10, fontWeight: '700' },
  bannerTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  summaryText: { fontSize: 13, lineHeight: 18, marginTop: Spacing.one },
  directoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  directoryTitle: { fontSize: 16, fontWeight: '700' },
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
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
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
  sheetName: { fontSize: 22, fontWeight: '700' },
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
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  quoteIcon: { marginTop: -2 },
  quoteText: { flex: 1, fontSize: 14, lineHeight: 20 },
  voiceSection: { marginBottom: Spacing.three },
  sarvamNote: { fontSize: 10, lineHeight: 14, textAlign: 'center' },
});
