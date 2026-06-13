import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';

export interface BlindSpotAlertProps {
  stakeholderNames: string[];
}

/**
 * Animated alert banner that surfaces overlooked stakeholder groups.
 * Slides down + fades in when first rendered, drawing immediate attention
 * to the blind spots detected by Gemini.
 */
export function BlindSpotAlert({ stakeholderNames }: BlindSpotAlertProps) {
  const theme = useTheme();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-16);

  useEffect(() => {
    if (stakeholderNames.length > 0) {
      opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    }
  }, [stakeholderNames.length]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (stakeholderNames.length === 0) return null;

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
            {stakeholderNames.length} Blind Spot{stakeholderNames.length > 1 ? 's' : ''} Detected
          </ThemedText>
          <ThemedText type="small" style={[styles.subtitle, { color: theme.warning + 'CC' }]}>
            Groups not considered in the original proposal
          </ThemedText>
        </View>
      </View>

      <View style={styles.chipContainer}>
        {stakeholderNames.map((name, index) => (
          <View
            key={index}
            style={[
              styles.chip,
              {
                backgroundColor: theme.surface,
                borderColor: theme.warning + '40',
              },
            ]}>
            <SymbolView
              name={{ ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' }}
              tintColor={theme.warning}
              size={11}
            />
            <ThemedText type="code" style={[styles.chipText, { color: theme.text }]}>
              {name}
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
    gap: Spacing.two,
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
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.one,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
