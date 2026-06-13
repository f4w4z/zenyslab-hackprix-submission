import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';
import { ConflictPair } from '@/constants/mockData';

export interface ConflictMapProps {
  conflicts: ConflictPair[];
}

/**
 * Renders a clean list of conflict pairs discovered by Gemini.
 * Each row shows Group A ↔ Group B with the reason for their conflict.
 * Color-coded with the conflict token from the design system.
 */
export function ConflictMap({ conflicts }: ConflictMapProps) {
  const theme = useTheme();

  if (!conflicts || conflicts.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SymbolView
          name={{ ios: 'arrow.triangle.swap', android: 'swap_horiz', web: 'swap_horiz' }}
          tintColor={theme.conflict}
          size={16}
        />
        <ThemedText type="code" style={[styles.headerText, { color: theme.conflict }]}>
          CONFLICT MAP ({conflicts.length} TENSION{conflicts.length > 1 ? 'S' : ''} DETECTED)
        </ThemedText>
      </View>

      {conflicts.map((conflict, index) => (
        <View
          key={index}
          style={[
            styles.conflictRow,
            {
              backgroundColor: theme.conflictContainer,
              borderColor: theme.conflict + '30',
            },
          ]}>
          {/* Connection flow row */}
          <View style={styles.flowRow}>
            {/* Group A */}
            <View style={[styles.groupChip, { backgroundColor: theme.surface, borderColor: theme.conflict + '20' }]}>
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
            <View style={[styles.groupChip, { backgroundColor: theme.surface, borderColor: theme.conflict + '20' }]}>
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
        </View>
      ))}
    </View>
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
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    flexDirection: 'column',
    alignItems: 'stretch',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  groupChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
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
});
