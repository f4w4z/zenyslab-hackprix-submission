/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Animated,
  BackHandler,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StakeholderCard } from '@/components/StakeholderCard';
import { BlindSpotAlert } from '@/components/BlindSpotAlert';
import { ConflictMap } from '@/components/ConflictMap';
import { VoicePlayer } from '@/components/VoicePlayer';
import { MOCK_SIMULATIONS, SimulationRecord, Stakeholder } from '@/constants/mockData';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { listSimulations, deleteSimulation } from '@/services/mongodb';

export default function HistoryScreen() {
  const theme = useTheme();

  const [simulations, setSimulations] = useState<SimulationRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedSimId, setExpandedSimId] = useState<string | null>(null);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [selectedSimulation, setSelectedSimulation] = useState<SimulationRecord | null>(null);

  const [bottomSheetAnim] = useState(() => new Animated.Value(0));

  // Load simulations from MongoDB on mount (fall back to mock data)
  const loadHistory = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const remote = await listSimulations();
      if (remote.length > 0) {
        setSimulations(remote);
      } else {
        // Fall back to mock data if MongoDB not configured
        setSimulations(MOCK_SIMULATIONS);
      }
    } catch {
      setSimulations(MOCK_SIMULATIONS);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Bottom sheet controls
  const openStakeholderDetail = (sim: SimulationRecord, stakeholder: Stakeholder) => {
    setSelectedStakeholder(stakeholder);
    setSelectedSimulation(sim);
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
      setSelectedSimulation(null);
    });
  };

  // Hardware back button handling for Android
  useEffect(() => {
    const onBackPress = () => {
      if (selectedStakeholder) {
        closeStakeholderDetail();
        return true;
      }
      // If no overlays open, navigate back to Home (Analyze tab)
      router.replace('/');
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStakeholder]);

  const toggleExpand = (id: string) => {
    setExpandedSimId((prev) => (prev === id ? null : id));
  };

  const handleDelete = async (sim: SimulationRecord) => {
    if (!sim.mongoId) return;
    try {
      await deleteSimulation(sim.mongoId);
      setSimulations((prev) => prev.filter((s) => s.id !== sim.id));
    } catch (err) {
      console.warn('Delete failed:', err);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const translateY = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [700, 0],
  });

  const overlayOpacity = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Top Navigation Bar */}
        <View style={[styles.screenHeader, { borderBottomColor: theme.outline }]}>
          <Pressable
            onPress={() => router.replace('/')}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.backgroundElement },
              pressed && { opacity: 0.7 },
            ]}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              tintColor={theme.text}
              size={18}
            />
            <ThemedText type="smallBold" style={{ marginLeft: Spacing.one }}>Back</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/')}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.backgroundElement },
              pressed && { opacity: 0.7 },
            ]}>
            <SymbolView
              name={{ ios: 'house.fill', android: 'home', web: 'home' }}
              tintColor={theme.text}
              size={18}
            />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={loadHistory}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }>
          <View style={styles.contentWrapper}>
            <ThemedText type="subtitle" style={styles.title}>
              History Log
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
              Pull down to refresh. Tap a record to expand and explore its stakeholder evaluations. Persisted securely via MongoDB Atlas.
            </ThemedText>

            {simulations.length === 0 && !isRefreshing && (
              <View style={styles.emptyCard}>
                <SymbolView
                  name={{ ios: 'tray', android: 'inbox', web: 'inbox' }}
                  tintColor={theme.textSecondary}
                  size={40}
                />
                <ThemedText type="smallBold" themeColor="textSecondary">
                  No history yet
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                  Analyse a decision from the Analyze tab to see it here.
                </ThemedText>
              </View>
            )}

            {simulations.map((sim, index) => {
              const isExpanded = expandedSimId === sim.id;
              const blindSpotCount = sim.stakeholders.filter((s) => s.isOverlooked).length;
              const overlookedStakeholders = sim.stakeholders
                .filter((s) => s.isOverlooked)
                .map((s) => ({ name: s.name, reason: s.description }));

              return (
                <View
                  key={`${sim.id}-${index}`}
                  style={[
                    styles.simCard,
                    {
                      borderBottomColor: theme.outline,
                    },
                  ]}>
                  {/* Collapsible header */}
                  <Pressable
                    onPress={() => toggleExpand(sim.id)}
                    style={styles.simCardHeader}>
                    <View style={styles.simMeta}>
                      <ThemedText type="code" themeColor="textSecondary" style={styles.simDate}>
                        {formatDate(sim.timestamp)}
                      </ThemedText>
                      <ThemedText type="smallBold" style={styles.simTitle}>
                        {sim.decisionTitle}
                      </ThemedText>

                      <View style={styles.metaBadgeRow}>
                        <View style={[styles.metaBadge, { backgroundColor: theme.backgroundElement }]}>
                          <SymbolView
                            name={{ ios: 'person.3.fill', android: 'groups', web: 'groups' }}
                            tintColor={theme.textSecondary}
                            size={12}
                          />
                          <ThemedText type="code" themeColor="textSecondary" style={styles.badgeText}>
                            {sim.stakeholders.length} Stakeholders
                          </ThemedText>
                        </View>

                        {blindSpotCount > 0 && (
                          <View style={[styles.metaBadge, { backgroundColor: theme.warningContainer }]}>
                            <SymbolView
                              name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                              tintColor={theme.warning}
                              size={12}
                            />
                            <ThemedText
                              type="code"
                              style={[styles.badgeText, { color: theme.warning }]}>
                              {blindSpotCount} Blind Spots
                            </ThemedText>
                          </View>
                        )}

                        {sim.conflicts && sim.conflicts.length > 0 && (
                          <View style={[styles.metaBadge, { backgroundColor: theme.conflictContainer }]}>
                            <SymbolView
                              name={{ ios: 'arrow.triangle.swap', android: 'swap_horiz', web: 'swap_horiz' }}
                              tintColor={theme.conflict}
                              size={12}
                            />
                            <ThemedText
                              type="code"
                              style={[styles.badgeText, { color: theme.conflict }]}>
                              {sim.conflicts.length} Conflicts
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    </View>

                    <SymbolView
                      name={{
                        ios: isExpanded ? 'chevron.up' : 'chevron.down',
                        android: isExpanded ? 'expand_less' : 'expand_more',
                        web: isExpanded ? 'expand_less' : 'expand_more',
                      }}
                      tintColor={theme.text}
                      size={20}
                    />
                  </Pressable>

                  {/* Expanded content */}
                  {isExpanded && (
                    <View style={[styles.expandedContent, { backgroundColor: theme.backgroundElement }]}>
                      {sim.description && (
                        <>
                          <ThemedText type="code" themeColor="textSecondary" style={styles.sectionLabel}>
                            DECISION DESCRIPTION:
                          </ThemedText>
                          <ThemedText type="small" style={styles.simDescription}>
                            {sim.description}
                          </ThemedText>
                        </>
                      )}

                      <ThemedText
                        type="code"
                        themeColor="textSecondary"
                        style={[styles.sectionLabel, { marginBottom: Spacing.two }]}>
                        STAKEHOLDER EVALUATIONS:
                      </ThemedText>

                      {sim.stakeholders.map((sh) => (
                        <StakeholderCard
                          key={sh.id}
                          name={sh.name}
                          role={sh.role}
                          impact={sh.impact}
                          isOverlooked={sh.isOverlooked}
                          description={sh.description}
                          onPress={() => openStakeholderDetail(sim, sh)}
                        />
                      ))}

                      <BlindSpotAlert stakeholders={overlookedStakeholders} />

                      {sim.conflicts && sim.conflicts.length > 0 && (
                        <ConflictMap conflicts={sim.conflicts} />
                      )}

                      {/* Delete button — only for MongoDB-persisted records */}
                      {sim.mongoId && (
                        <Pressable
                          onPress={() => handleDelete(sim)}
                          style={({ pressed }) => [
                            styles.deleteButton,
                            { borderColor: theme.error + '40', backgroundColor: theme.errorContainer },
                            pressed && { opacity: 0.8 },
                          ]}>
                          <SymbolView
                            name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }}
                            tintColor={theme.error}
                            size={14}
                          />
                          <ThemedText type="code" style={[styles.deleteText, { color: theme.error }]}>
                            Delete Record
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Bottom Sheet Overlay */}
      {selectedStakeholder && (
        <Animated.View
          style={[
            styles.overlay,
            { backgroundColor: '#000000', opacity: overlayOpacity },
          ]}>
          <Pressable style={styles.overlayPressable} onPress={closeStakeholderDetail} />
        </Animated.View>
      )}

      {/* Bottom Sheet */}
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
          <View style={styles.sheetHandleContainer}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.outline }]} />
          </View>

          <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
            {/* Header */}
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

            {/* Impact */}
            <View style={styles.section}>
              <ThemedText type="code" themeColor="textSecondary" style={styles.sectionTitle}>
                POTENTIAL STRUCTURAL IMPACT:
              </ThemedText>
              <ThemedText type="small" style={styles.sheetDesc}>
                {selectedStakeholder.description}
              </ThemedText>
            </View>

            {/* Quote */}
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
                <ThemedText type="small" style={styles.quoteText}>
                  &ldquo;{selectedStakeholder.voiceQuote}&rdquo;
                </ThemedText>
              </View>
            </View>

            {/* Conflicts for this stakeholder */}
            {selectedSimulation?.conflicts &&
              selectedSimulation.conflicts.filter(
                (c) =>
                  c.groupA === selectedStakeholder.name ||
                  c.groupB === selectedStakeholder.name
              ).length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="code" themeColor="textSecondary" style={styles.sectionTitle}>
                    CONFLICT INVOLVEMENT:
                  </ThemedText>
                  <ConflictMap
                    conflicts={selectedSimulation.conflicts.filter(
                      (c) =>
                        c.groupA === selectedStakeholder.name ||
                        c.groupB === selectedStakeholder.name
                    )}
                  />
                </View>
              )}

            {/* Voice Player */}
            <View style={styles.voiceSection}>
              <VoicePlayer
                speakerName={selectedStakeholder.name}
                voiceQuote={selectedStakeholder.voiceQuote}
                voiceArchetype={selectedStakeholder.voiceArchetype ?? 'default'}
              />
            </View>

            <ThemedText type="code" themeColor="textSecondary" style={styles.sarvamNote}>
              * English voices via ElevenLabs high-fidelity cloning. Hindi &amp; Telugu translation and speech synthesis powered by Sarvam AI.
            </ThemedText>

            <View style={{ height: BottomTabInset + Spacing.five }} />
          </ScrollView>
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
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
  scrollView: { flex: 1 },
  scrollContent: {
    paddingBottom: BottomTabInset + Spacing.five,
    alignItems: 'center',
    width: '100%',
  },
  contentWrapper: {
    maxWidth: MaxContentWidth,
    width: '100%',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    alignItems: 'stretch',
    gap: Spacing.three,
  },
  title: { fontFamily: Fonts.serif.regular, fontSize: 28, lineHeight: 34, fontWeight: '400' },
  description: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.two },
  emptyCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  simCard: {
    borderBottomWidth: 1,
    alignSelf: 'stretch',
    paddingVertical: Spacing.three,
  },
  simCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  simMeta: { flex: 1, gap: 2 },
  simDate: { fontSize: 10, fontWeight: '700' },
  simTitle: { fontFamily: Fonts.serif.regular, fontSize: 18, lineHeight: 24, fontWeight: '400', marginBottom: Spacing.one },
  metaBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '600' },
  expandedContent: {
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.two,
  },
  sectionLabel: { fontSize: 10, fontWeight: '700', marginBottom: Spacing.one },
  simDescription: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.three },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.two,
  },
  deleteText: { fontSize: 12, fontWeight: '700' },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
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
  quoteText: {
    fontFamily: Fonts.serif.italic,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  voiceSection: { marginBottom: Spacing.three },
  sarvamNote: { fontSize: 10, lineHeight: 14, textAlign: 'center' },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
  },
});
