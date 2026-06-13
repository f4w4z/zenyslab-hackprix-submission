import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, BorderRadius, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

interface TechCardProps {
  name: string;
  description: string;
  iconName: { ios: string; android: string; web: string };
  url: string;
}

function TechCard({ name, description, iconName, url }: TechCardProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [
        styles.techCard,
        {
          borderBottomColor: theme.outline,
        },
        pressed && { backgroundColor: theme.backgroundElement, borderRadius: BorderRadius.md },
      ]}>
      <View style={[styles.techIconWrap, { backgroundColor: theme.primaryContainer }]}>
        <SymbolView name={iconName as any} tintColor={theme.primary} size={20} />
      </View>
      <View style={styles.techInfo}>
        <ThemedText type="smallBold" style={styles.techName}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.techDesc}>
          {description}
        </ThemedText>
      </View>
      <SymbolView
        name={{ ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' }}
        tintColor={theme.textSecondary}
        size={14}
      />
    </Pressable>
  );
}

export default function AboutScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={[styles.brandIcon, { backgroundColor: theme.primaryContainer }]}>
              <SymbolView
                name={{ ios: 'waveform.and.mic', android: 'record_voice_over', web: 'record_voice_over' }}
                tintColor={theme.primary}
                size={22}
              />
            </View>
            <View>
              <ThemedText type="smallBold" style={styles.appName}>
                Echo
              </ThemedText>
              <ThemedText type="code" themeColor="textSecondary" style={styles.appTagline}>
                DECISION BLIND SPOT DETECTOR
              </ThemedText>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.contentWrapper}>

            {/* Hero */}
            <View style={[styles.heroCard, { backgroundColor: theme.primaryContainer }]}>
              <ThemedText type="subtitle" style={[styles.heroTitle, { color: theme.primary }]}>
                Before making a decision, hear from the people nobody thought to ask.
              </ThemedText>
              <ThemedText type="small" style={[styles.heroBody, { color: theme.primary }]}>
                Echo is an AI-powered tool that identifies overlooked stakeholders, maps structural
                conflicts, and surfaces perspectives that decision-makers routinely miss.
              </ThemedText>
            </View>

            {/* What Echo Does */}
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              What Echo Does
            </ThemedText>

            {[
              {
                icon: { ios: 'person.3.fill', android: 'groups', web: 'groups' },
                title: 'Stakeholder Discovery',
                body: 'Automatically identifies direct and indirect stakeholders affected by a proposed decision.',
              },
              {
                icon: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
                title: 'Blind Spot Detection',
                body: 'Surfaces groups that decision-makers overlooked — disabled users, commuters, scholarship holders, and more.',
              },
              {
                icon: { ios: 'arrow.triangle.swap', android: 'swap_horiz', web: 'swap_horiz' },
                title: 'Conflict Mapping',
                body: 'Highlights when one stakeholder group benefits at the direct expense of another.',
              },
              {
                icon: { ios: 'mic.circle.fill', android: 'mic', web: 'mic' },
                title: 'Stakeholder Voices',
                body: 'Generates first-person audio perspectives in English, Hindi, and Telugu using ElevenLabs and Sarvam AI.',
              },
            ].map((item) => (
              <View
                key={item.title}
                style={[styles.featureRow, { borderBottomColor: theme.outline }]}>
                <View style={[styles.featureIcon, { backgroundColor: theme.primaryContainer }]}>
                  <SymbolView name={item.icon as any} tintColor={theme.primary} size={18} />
                </View>
                <View style={styles.featureText}>
                  <ThemedText type="smallBold" style={styles.featureName}>
                    {item.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.featureBody}>
                    {item.body}
                  </ThemedText>
                </View>
              </View>
            ))}

            {/* Tech Stack */}
            <ThemedText type="smallBold" style={[styles.sectionTitle, { marginTop: Spacing.three }]}>
              Powered By
            </ThemedText>

            <TechCard
              name="Gemini 2.0 Flash"
              description="Stakeholder discovery, conflict analysis & blind spot detection"
              iconName={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              url="https://ai.google.dev"
            />
            <TechCard
              name="ElevenLabs"
              description="High-fidelity voice cloning & narration for each stakeholder archetype"
              iconName={{ ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' }}
              url="https://elevenlabs.io"
            />
            <TechCard
              name="Sarvam AI"
              description="Indian-language translation & TTS for Hindi and Telugu perspectives"
              iconName={{ ios: 'globe', android: 'language', web: 'language' }}
              url="https://sarvam.ai"
            />
            <TechCard
              name="MongoDB Atlas"
              description="Persistent storage for simulation history and stakeholder records"
              iconName={{ ios: 'cylinder.fill', android: 'storage', web: 'storage' }}
              url="https://mongodb.com/atlas"
            />
            <TechCard
              name="Expo / React Native"
              description="Cross-platform mobile & web app framework"
              iconName={{ ios: 'apps.iphone', android: 'smartphone', web: 'smartphone' }}
              url="https://expo.dev"
            />

            {/* Philosophy */}
            <View style={[styles.philosophyCard, { borderLeftColor: theme.primary }]}>
              <ThemedText type="code" themeColor="textSecondary" style={styles.philosophyLabel}>
                OUR VISION
              </ThemedText>
              <ThemedText type="small" style={styles.philosophyText}>
                Most AI systems help people make decisions <ThemedText type="smallBold">faster</ThemedText>.
              </ThemedText>
              <ThemedText type="small" style={styles.philosophyText}>
                Echo helps people make decisions <ThemedText type="smallBold">more responsibly</ThemedText>.
              </ThemedText>
            </View>

            <View style={{ height: BottomTabInset + Spacing.five }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontFamily: Fonts.serif.regular,
    fontSize: 24,
    lineHeight: 26,
  },
  appTagline: {
    fontFamily: Fonts.sans.bold,
    fontSize: 8,
    letterSpacing: 1,
    fontWeight: '700',
  },
  scroll: { flex: 1 },
  scrollContent: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: Spacing.five,
  },
  contentWrapper: {
    maxWidth: MaxContentWidth,
    width: '100%',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  heroCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.four,
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  heroTitle: {
    fontFamily: Fonts.serif.regular,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '400',
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },
  sectionTitle: {
    fontFamily: Fonts.serif.regular,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '400',
    marginBottom: Spacing.two,
    marginTop: Spacing.one,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  featureText: { flex: 1, gap: 2 },
  featureName: { fontSize: 14 },
  featureBody: { fontSize: 13, lineHeight: 18 },
  techCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  techIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  techInfo: { flex: 1, gap: 2 },
  techName: { fontSize: 14 },
  techDesc: { fontSize: 12, lineHeight: 16 },
  philosophyCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.four,
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  philosophyLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
  },
  philosophyText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
