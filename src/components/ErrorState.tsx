/**
 * Reusable error state component for full-screen or card-level error displays.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onBack?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  onBack,
}: ErrorStateProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.errorContainer, borderColor: theme.error + '40' },
      ]}>
      <SymbolView
        name={{ ios: 'exclamationmark.triangle.fill', android: 'error', web: 'error' }}
        tintColor={theme.error}
        size={32}
      />
      <ThemedText type="smallBold" style={[styles.title, { color: theme.error }]}>
        {title}
      </ThemedText>
      <ThemedText type="small" style={[styles.message, { color: theme.error + 'CC' }]}>
        {message}
      </ThemedText>

      <View style={styles.actions}>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: theme.error },
              pressed && { opacity: 0.85 },
            ]}>
            <SymbolView
              name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
              tintColor={theme.surface}
              size={14}
            />
            <ThemedText type="smallBold" style={{ color: theme.surface, fontSize: 14 }}>
              Try Again
            </ThemedText>
          </Pressable>
        )}

        {onBack && (
          <Pressable onPress={onBack}>
            <ThemedText type="linkPrimary" style={styles.backLink}>
              ← Go back
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    marginTop: Spacing.two,
    alignItems: 'center',
    gap: Spacing.two,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: BorderRadius.pill,
  },
  backLink: {
    fontSize: 14,
  },
});
