import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { BorderRadius, Spacing } from '@/constants/theme';
import { Stakeholder, ConflictPair } from '@/constants/mockData';

export interface EquityIndexProps {
  stakeholders: Stakeholder[];
  conflicts: ConflictPair[];
  blindSpots: string[];
}

export function calculateEquityScore(
  stakeholders: Stakeholder[],
  conflicts: ConflictPair[],
  blindSpots: string[]
) {
  let score = 100;

  // -10 per forgotten stakeholder
  const forgottenCount = blindSpots?.length || 0;
  score -= forgottenCount * 10;

  // -8 per conflict
  const conflictCount = conflicts?.length || 0;
  score -= conflictCount * 8;

  // -5 per high severity negative stakeholder
  const highSeverityNegative = stakeholders?.filter(
    s => s.impact === 'negative' && (s as any).severity === 'high'
  ).length || 0;
  score -= highSeverityNegative * 5;

  const finalScore = Math.max(8, score);
  
  console.log('Score breakdown:', { forgottenCount, conflictCount, highSeverityNegative, finalScore });
  
  return finalScore;
}

export function getEquityLabel(val: number, blindSpotsCount: number) {
  if (val >= 80) return 'Low Risk — Inclusive Policy';
  if (val >= 50) return 'Medium Risk — Review Recommended';
  
  if (blindSpotsCount > 0) {
    return `High Risk — ${blindSpotsCount} group${blindSpotsCount > 1 ? 's' : ''} overlooked`;
  }
  return 'High Risk — Significant Impacts Detected';
}

export function EquityIndex({ stakeholders, conflicts, blindSpots }: EquityIndexProps) {
  const finalScore = calculateEquityScore(stakeholders, conflicts, blindSpots);
  const [displayScore, setDisplayScore] = useState(0);
  
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animatedValue.setValue(0);
    Animated.timing(animatedValue, {
      toValue: finalScore,
      duration: 1500,
      useNativeDriver: false, // native driver unsupported for bg colors / layout width interpolations
    }).start();

    const listenerId = animatedValue.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });

    return () => {
      animatedValue.removeListener(listenerId);
    };
  }, [finalScore, animatedValue]);

  // Determine colors and labels
  const getColor = (val: number) => {
    if (val >= 80) return '#4CD964'; // Green
    if (val >= 50) return '#FFCC00'; // Amber
    return '#FF3B30'; // Red
  };

  const currentColor = getColor(displayScore);

  const widthAnim = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>EQUITY INDEX</ThemedText>
      
      <View style={styles.scoreContainer}>
        <ThemedText style={[styles.scoreNumber, { color: currentColor }]}>
          {displayScore}
        </ThemedText>
        <ThemedText style={styles.scoreSubtext}>out of 100</ThemedText>
      </View>

      <View style={styles.barContainer}>
        <View style={styles.barBackground}>
          <Animated.View
            style={[
              styles.barFill,
              {
                width: widthAnim,
                backgroundColor: currentColor,
              },
            ]}
          />
        </View>
        <ThemedText style={styles.percentageText}>{displayScore}%</ThemedText>
      </View>

      <ThemedText style={[styles.label, { color: currentColor }]}>
        "{getEquityLabel(displayScore, blindSpots?.length || 0)}"
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#2A2A3A',
    backgroundColor: '#1A1A24',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#8B8B9E',
    marginBottom: Spacing.three,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  scoreNumber: {
    fontSize: 56,
    fontWeight: '900',
    lineHeight: 60,
  },
  scoreSubtext: {
    fontSize: 12,
    color: '#8B8B9E',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.three,
  },
  barBackground: {
    flex: 1,
    height: 12,
    backgroundColor: '#0D0D12',
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: Spacing.three,
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  percentageText: {
    width: 40,
    fontSize: 14,
    fontWeight: '700',
    color: '#E8E8F0',
    textAlign: 'right',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
