/* eslint-disable react-hooks/immutability */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';

export type StakeholderImpact = 'positive' | 'negative' | 'mixed';

export interface StakeholderCardProps {
  name: string;
  role: string;
  impact: StakeholderImpact;
  isOverlooked?: boolean;
  description: string;
  language?: 'en-IN' | 'hi-IN' | 'te-IN';
  onPress: () => void;
}

const IMPACT_CONFIG = {
  positive: {
    iosIcon: 'checkmark.circle.fill',
    androidIcon: 'check_circle',
  },
  negative: {
    iosIcon: 'xmark.circle.fill',
    androidIcon: 'cancel',
  },
  mixed: {
    iosIcon: 'questionmark.circle.fill',
    androidIcon: 'help',
  },
} as const;

const CARD_TRANSLATIONS = {
  'en-IN': {
    overlooked: 'OVERLOOKED',
    hearPerspective: 'Hear perspective',
    positive: 'Positive',
    negative: 'Negative',
    mixed: 'Mixed',
  },
  'hi-IN': {
    overlooked: 'अनदेखा',
    hearPerspective: 'दृष्टिकोण सुनें',
    positive: 'सकारात्मक',
    negative: 'नकारात्मक',
    mixed: 'मिश्रित',
  },
  'te-IN': {
    overlooked: 'నిర్లక్ష్యం చేయబడింది',
    hearPerspective: 'దృక్పథాన్ని వినండి',
    positive: 'సానుకూల',
    negative: 'ప్రతికూల',
    mixed: 'మిశ్రమ',
  },
};

export function StakeholderCard({
  name,
  role,
  impact,
  isOverlooked = false,
  description,
  language,
  onPress,
}: StakeholderCardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  };

  // Impact color resolution from theme
  const impactColors = {
    positive: {
      bg: theme.success + '1A',
      text: theme.success,
    },
    negative: {
      bg: theme.error + '1A',
      text: theme.error,
    },
    mixed: {
      bg: theme.warning + '1A',
      text: theme.warning,
    },
  };

  const safeImpact = impactColors[impact] ? impact : 'mixed';
  const { bg: impactBg, text: impactText } = impactColors[safeImpact];
  const iconConfig = IMPACT_CONFIG[safeImpact];

  const currentLang = language || 'en-IN';
  const t = CARD_TRANSLATIONS[currentLang] || CARD_TRANSLATIONS['en-IN'];

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.card,
          {
            borderBottomColor: theme.outline,
          },
          pressed && { backgroundColor: theme.backgroundElement, borderRadius: BorderRadius.md },
        ]}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <View style={styles.nameRow}>
              <View style={[styles.statusDot, { backgroundColor: impactText }]} />
              <ThemedText type="smallBold" style={styles.nameText}>
                {name}
              </ThemedText>
              {isOverlooked && (
                <View style={[styles.badge, { backgroundColor: theme.warningContainer }]}>
                  <SymbolView
                    name={{ ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' }}
                    tintColor={theme.warning}
                    size={10}
                  />
                  <ThemedText
                    type="code"
                    style={[styles.badgeText, { color: theme.warning, fontSize: 9 }]}>
                    {t.overlooked}
                  </ThemedText>
                </View>
              )}
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.roleText}>
              {role}
            </ThemedText>
          </View>

          {/* Impact badge */}
          <View style={[styles.impactBadge, { backgroundColor: impactBg }]}>
            <SymbolView
              name={{
                ios: iconConfig.iosIcon,
                android: iconConfig.androidIcon,
                web: iconConfig.androidIcon,
              } as any}
              tintColor={impactText}
              size={13}
            />
            <ThemedText type="code" style={[styles.impactText, { color: impactText }]}>
              {t[safeImpact]}
            </ThemedText>
          </View>
        </View>

        <ThemedText
          type="small"
          themeColor="textSecondary"
          numberOfLines={2}
          style={styles.description}>
          {description}
        </ThemedText>

        <View style={styles.cardFooter}>
          <ThemedText type="linkPrimary" style={styles.listenText}>
            {t.hearPerspective}
          </ThemedText>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            tintColor={theme.primary}
            size={14}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    alignSelf: 'stretch',
    gap: Spacing.one,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  titleContainer: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  nameText: {
    fontSize: 16,
  },
  roleText: {
    fontSize: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 3,
  },
  badgeText: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  impactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one / 2,
    borderRadius: BorderRadius.full,
    gap: 4,
    flexShrink: 0,
  },
  impactText: {
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.three,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  listenText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
