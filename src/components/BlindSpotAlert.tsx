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
import { Spacing, BorderRadius, Fonts } from '@/constants/theme';

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

  useEffect(() => {
    if (stakeholders.length > 0) {
      opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    }
  }, [stakeholders.length, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (stakeholders.length === 0) return null;

  return (
    <Animated.View
      style={[
        animatedStyle,
        styles.container,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.outline,
        },
      ]}>
      <View style={[styles.leftAccentBar, { backgroundColor: theme.error }]} />
      <View style={styles.header}>
        <SymbolView
          name={{ ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' }}
          tintColor={theme.error}
          size={20}
        />
        <View style={styles.headerText}>
          <ThemedText type="smallBold" style={[styles.title, { color: theme.error }]}>
            Who Did We Forget?
          </ThemedText>
          <ThemedText type="small" style={[styles.subtitle, { color: theme.textSecondary }]}>
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
                borderLeftColor: theme.error + '50',
              },
            ]}>
            <View style={styles.cardHeader}>
              <SymbolView
                name={{ ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' }}
                tintColor={theme.error}
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
    paddingVertical: Spacing.four,
    paddingRight: Spacing.three,
    paddingLeft: Spacing.four + 2,
    alignSelf: 'stretch',
    marginTop: Spacing.four,
    marginBottom: Spacing.three,
    gap: Spacing.three,
    overflow: 'hidden',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  leftAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontFamily: Fonts.serif.regular,
    fontSize: 19,
    fontWeight: '400',
  },
  subtitle: {
    fontSize: 12,
  },
  cardsContainer: {
    flexDirection: 'column',
    gap: Spacing.two,
  },
  card: {
    paddingVertical: Spacing.two,
    paddingLeft: Spacing.three,
    borderLeftWidth: 2,
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
