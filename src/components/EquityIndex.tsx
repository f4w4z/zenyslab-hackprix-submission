import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { BorderRadius, Spacing, Fonts } from '@/constants/theme';
import { Stakeholder, ConflictPair } from '@/constants/mockData';

export interface EquityIndexProps {
  stakeholders: Stakeholder[];
  conflicts: ConflictPair[];
  blindSpots: string[];
  language?: 'en-IN' | 'hi-IN' | 'te-IN';
}

export function calculateEquityScore(
  stakeholders: Stakeholder[],
  conflicts: ConflictPair[],
  blindSpots: string[]
) {
  let score = 100;

  // -12 per forgotten stakeholder
  const forgottenCount = blindSpots?.length || 0;
  score -= forgottenCount * 12;

  // -10 per conflict
  const conflictCount = conflicts?.length || 0;
  score -= conflictCount * 10;

  // Count stakeholders by impact — ignore severity field entirely
  const negativeCount = stakeholders?.filter(
    s => s.impact === 'negative'
  ).length || 0;
  score -= negativeCount * 10;

  const mixedCount = stakeholders?.filter(
    s => s.impact === 'mixed'
  ).length || 0;
  score -= mixedCount * 4;

  const finalScore = Math.max(8, score);
  
  console.log('Score breakdown:', { forgottenCount, conflictCount, negativeCount, mixedCount, finalScore });
  
  return finalScore;
}

const EQUITY_TRANSLATIONS = {
  'en-IN': {
    title: 'EQUITY INDEX',
    subtext: 'out of 100',
    inclusivePolicy: 'Low Risk — Inclusive Policy',
    reviewRecommended: 'Medium Risk — Review Recommended',
    groupsOverlooked: (count: number) => `High Risk — ${count} group${count > 1 ? 's' : ''} overlooked`,
    highRiskImpacts: 'High Risk — Significant Impacts Detected',
  },
  'hi-IN': {
    title: 'इक्विटी इंडेक्स',
    subtext: '100 में से',
    inclusivePolicy: 'कम जोखिम — समावेशी नीति',
    reviewRecommended: 'मध्यम जोखिम — समीक्षा की सिफारिश की गई',
    groupsOverlooked: (count: number) => `उच्च जोखिम — ${count} समूह अनदेखे किए गए`,
    highRiskImpacts: 'उच्च जोखिम — महत्वपूर्ण प्रभाव पाए गए',
  },
  'te-IN': {
    title: 'ఈక్విటీ ఇండెక్స్',
    subtext: '100 కి గాను',
    inclusivePolicy: 'తక్కువ ప్రమాదం — సమగ్ర విధానం',
    reviewRecommended: 'మధ్యస్థ ప్రమాదం — సమీక్ష సిఫార్సు చేయబడింది',
    groupsOverlooked: (count: number) => `అధిక ప్రమాదం — ${count} సమూహాలు నిర్లక్ష్యం చేయబడ్డాయి`,
    highRiskImpacts: 'అధిక ప్రమాదం — ముఖ్యమైన ప్రభావాలు కనుగొనబడ్డాయి',
  },
};

export function getEquityLabel(val: number, blindSpotsCount: number, language?: 'en-IN' | 'hi-IN' | 'te-IN') {
  const currentLang = language || 'en-IN';
  const t = EQUITY_TRANSLATIONS[currentLang] || EQUITY_TRANSLATIONS['en-IN'];
  if (val >= 80) return t.inclusivePolicy;
  if (val >= 50) return t.reviewRecommended;
  
  if (blindSpotsCount > 0) {
    return t.groupsOverlooked(blindSpotsCount);
  }
  return t.highRiskImpacts;
}

export function EquityIndex({ stakeholders, conflicts, blindSpots, language }: EquityIndexProps) {
  const finalScore = calculateEquityScore(stakeholders, conflicts, blindSpots);
  const [displayScore, setDisplayScore] = useState(0);
  
  const [animatedValue] = useState(() => new Animated.Value(0));

  const currentLang = language || 'en-IN';
  const t = EQUITY_TRANSLATIONS[currentLang] || EQUITY_TRANSLATIONS['en-IN'];

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
      <ThemedText style={styles.title}>{t.title}</ThemedText>
      
      <View style={styles.scoreContainer}>
        <ThemedText style={[styles.scoreNumber, { color: currentColor }]}>
          {displayScore}
        </ThemedText>
        <ThemedText style={styles.scoreSubtext}>{t.subtext}</ThemedText>
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
        &ldquo;{getEquityLabel(displayScore, blindSpots?.length || 0, language)}&rdquo;
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
    fontFamily: Fonts.serif.regular,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#8B8B9E',
    marginBottom: Spacing.three,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  scoreNumber: {
    fontFamily: Fonts.serif.regular,
    fontSize: 56,
    fontWeight: '400',
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
    fontFamily: Fonts.serif.italic,
    fontSize: 15,
    textAlign: 'center',
  },
});
