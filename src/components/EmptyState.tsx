/**
 * Reusable empty state component for lists with no data.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';

export interface EmptyStateProps {
  title: string;
  description: string;
  iconName?: { ios: string; android: string; web: string };
}

export function EmptyState({
  title,
  description,
  iconName = { ios: 'tray', android: 'inbox', web: 'inbox' },
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      <SymbolView name={iconName as any} tintColor={theme.textSecondary} size={40} />
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
        {description}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
