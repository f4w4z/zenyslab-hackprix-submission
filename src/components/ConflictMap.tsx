import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';
import { ConflictPair } from '@/constants/mockData';

export interface ConflictMapProps {
  conflicts: ConflictPair[];
  language?: 'en-IN' | 'hi-IN' | 'te-IN';
  /** When provided, a "HEAR THEM DEBATE" button is rendered per conflict row */
  onDebate?: (conflict: ConflictPair) => void;
}

const CONFLICT_TRANSLATIONS = {
  'en-IN': {
    conflictMap: 'CONFLICT MAP',
    tensionsDetected: (count: number) => `(${count} TENSION${count > 1 ? 'S' : ''} DETECTED)`,
    hearThemDebate: 'HEAR THEM DEBATE',
  },
  'hi-IN': {
    conflictMap: 'संघर्ष मानचित्र',
    tensionsDetected: (count: number) => `(${count} तनाव पाए गए)`,
    hearThemDebate: 'बहस सुनें',
  },
  'te-IN': {
    conflictMap: 'వైరుధ్యాల పటం',
    tensionsDetected: (count: number) => `(${count} వైరుధ్యాలు కనుగొనబడ్డాయి)`,
    hearThemDebate: 'వారి చర్చ వినండి',
  },
};

/**
 * Renders a clean list of conflict pairs discovered by Gemini.
 * Each row shows Group A ↔ Group B with the reason for their conflict.
 * Color-coded with the conflict token from the design system.
 * When onDebate is provided, a Debate button is shown per row.
 */
export function ConflictMap({ conflicts, language, onDebate }: ConflictMapProps) {
  const theme = useTheme();

  if (!conflicts || conflicts.length === 0) return null;

  const currentLang = language || 'en-IN';
  const t = CONFLICT_TRANSLATIONS[currentLang] || CONFLICT_TRANSLATIONS['en-IN'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SymbolView
          name={{ ios: 'arrow.triangle.swap', android: 'swap_horiz', web: 'swap_horiz' }}
          tintColor={theme.conflict}
          size={16}
        />
        <CustomHeader t={t} conflicts={conflicts} theme={theme} />
      </View>

      {conflicts.map((conflict, index) => (
        <View
          key={index}
          style={[
            styles.conflictRow,
            {
              borderBottomColor: theme.outline,
            },
          ]}>
          {/* Connection flow row */}
          <View style={styles.flowRow}>
            {/* Group A */}
            <View style={[styles.groupChip, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" style={[styles.groupName, { color: theme.conflict }]}>
                {conflict.groupA}
              </ThemedText>
            </View>

            {/* Arrow */}
            <View style={styles.arrowWrap}>
              <SymbolView
                name={{ ios: 'arrow.left.and.right', android: 'compare_arrows', web: 'compare_arrows' }}
                tintColor={theme.conflict}
                size={14}
              />
            </View>

            {/* Group B */}
            <View style={[styles.groupChip, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" style={[styles.groupName, { color: theme.conflict }]}>
                {conflict.groupB}
              </ThemedText>
            </View>
          </View>

          {/* Reason */}
          <ThemedText
            type="small"
            style={[styles.reason, { color: theme.text }]}>
            {conflict.reason}
          </ThemedText>

          {/* Debate trigger button — only shown when handler is provided */}
          {onDebate && (
            <Pressable
              onPress={() => onDebate(conflict)}
              style={({ pressed }) => [
                styles.debateBtn,
                { backgroundColor: theme.conflictContainer, borderColor: theme.conflict + '66' },
                pressed && { opacity: 0.75 },
              ]}
            >
              <SymbolView
                name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }}
                tintColor={theme.conflict}
                size={12}
              />
              <ThemedText type="code" style={[styles.debateBtnText, { color: theme.conflict }]}>
                {t.hearThemDebate}
              </ThemedText>
              <SymbolView
                name={{ ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }}
                tintColor={theme.conflict}
                size={11}
              />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

// Simple helper component to render text safely without template inside jsx element
function CustomHeader({ t, conflicts, theme }: any) {
  return (
    <ThemedText type="code" style={[styles.headerText, { color: theme.conflict }]}>
      {t.conflictMap} {t.tensionsDetected(conflicts.length)}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  headerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  conflictRow: {
    borderBottomWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    gap: Spacing.two,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  groupChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one / 2,
    borderRadius: BorderRadius.sm,
    flexShrink: 1,
  },
  groupName: {
    fontSize: 12,
    fontWeight: '700',
  },
  arrowWrap: {
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reason: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.85,
    marginTop: Spacing.one / 2,
  },
  debateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
  },
  debateBtnText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
