/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeOut,
  FadeIn
} from 'react-native-reanimated';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';

const LOADING_STEPS = [
  'Mapping stakeholders...',
  'Simulating downstream impact...',
  'Surfacing hidden conflicts...',
  'Identifying decision blind spots...',
  'Who did we forget?...'
];

interface AnalysisLoaderProps {
  isAnalyzing: boolean;
}

export function AnalysisLoader({ isAnalyzing }: AnalysisLoaderProps) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (isAnalyzing) {
      setStepIndex(0);
      progress.value = 0;
      
      // Animate from 0 to 90% over 8 seconds
      progress.value = withTiming(90, {
        duration: 8000,
        easing: Easing.out(Easing.quad),
      });

      // Cycle text every 2 seconds
      const interval = setInterval(() => {
        setStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 2000);

      return () => clearInterval(interval);
    } else {
      // When analysis finishes, jump to 100% quickly
      progress.value = withTiming(100, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
    }
  }, [isAnalyzing, progress]);

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value}%`,
    };
  });

  return (
    <Animated.View 
      entering={FadeIn.duration(300)} 
      exiting={FadeOut.duration(400).delay(300)}
      style={styles.container}
    >
      <View style={[styles.barBackground, { backgroundColor: theme.outline }]}>
        <Animated.View style={[styles.barFill, progressStyle, { backgroundColor: theme.primary }]} />
      </View>
      
      <View style={styles.textContainer}>
        <Animated.View 
          key={stepIndex} 
          entering={FadeIn.duration(400)} 
          exiting={FadeOut.duration(400)}
          style={styles.animWrapper}
        >
          <ThemedText type="small" themeColor="textSecondary" style={styles.statusText}>
            {LOADING_STEPS[stepIndex]}
          </ThemedText>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  barBackground: {
    height: 4,
    alignSelf: 'stretch',
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  gradient: {
    flex: 1,
    borderRadius: BorderRadius.pill,
  },
  textContainer: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  animWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontWeight: '500',
    letterSpacing: 0.2,
  }
});
