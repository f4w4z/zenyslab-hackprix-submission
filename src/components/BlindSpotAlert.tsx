import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';

export interface BlindSpotAlertProps {
  stakeholders: { name: string; reason: string }[];
}

/**
 * Animated alert banner that surfaces overlooked stakeholder groups.
 * Features a pulsing animation and distinct cards for each stakeholder.
 */
export function BlindSpotAlert({ stakeholders }: BlindSpotAlertProps) {
  const theme = useTheme();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-16);
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (stakeholders.length > 0) {
      opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      
      // Subtle pulsing animation for the container
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Infinite repeat
        true // Reverse
      );
    }
  }, [stakeholders.length]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: pulseAnim.value }],
  }));

  if (stakeholders.length === 0) return null;

  return (
    <Animated.View
      style={[
        animatedStyle,
        styles.container,
        {
          backgroundColor: theme.warningContainer,
          borderColor: theme.warning + '40',
        },
      ]}>
      <View style={styles.header}>
        <SymbolView
          name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
          tintColor={theme.warning}
          size={20}
        />
        <View style={styles.headerText}>
          <ThemedText type="smallBold" style={[styles.title, { color: theme.warning }]}>
            Who Did We Forget?
          </ThemedText>
          <ThemedText type="small" style={[styles.subtitle, { color: theme.warning + 'CC' }]}>
            {stakeholders.length} Blind Spot{stakeholders.length > 1 ? 's' : ''} Detected
          </ThemedText>
        </View>
      </View>

      <View style={styles.cardsContainer}>
        {stakeholders.map((sh, index) => (
          <View
            key={index}
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.warning + '40',
              },
            ]}>
            <View style={styles.cardHeader}>
              <SymbolView
                name={{ ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' }}
                tintColor={theme.warning}
                size={14}
              />
              <ThemedText type="smallBold" style={{ color: theme.text }}>
                {sh.name}
              </ThemedText>
            </View>
            <ThemedText type="small" style={[styles.cardReason, { color: theme.textSecondary }]}>
              {sh.reason}
            </ThemedText>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignSelf: 'stretch',
    marginBottom: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
  cardsContainer: {
    flexDirection: 'column',
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: 2,
  },
  cardReason: {
    lineHeight: 18,
  },
});
