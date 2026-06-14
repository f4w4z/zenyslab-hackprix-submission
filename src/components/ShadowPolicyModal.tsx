import React, { useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';
import { generateShadowPolicy, ShadowPolicyResult } from '@/services/shadowPolicy';

interface ShadowPolicyModalProps {
  visible: boolean;
  decision: string;
  forgottenStakeholders: { name: string; reason: string }[];
  conflicts: { groupA: string; groupB: string; reason: string }[];
  onClose: () => void;
}

export function ShadowPolicyModal({
  visible,
  decision,
  forgottenStakeholders,
  conflicts,
  onClose,
}: ShadowPolicyModalProps) {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ShadowPolicyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await generateShadowPolicy(decision, forgottenStakeholders, conflicts);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate improved policy.');
    } finally {
      setIsLoading(false);
    }
  }, [decision, forgottenStakeholders, conflicts]);

  const handleCopy = async () => {
    if (!result?.improvedPolicy) return;
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(result.improvedPolicy);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    setIsLoading(false);
    setCopied(false);
    onClose();
  };

  // Auto-generate on first open
  React.useEffect(() => {
    if (visible && !result && !isLoading && !error) {
      const timer = setTimeout(() => {
        handleGenerate();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [visible, result, isLoading, error, handleGenerate]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.overlayBg} onPress={handleClose} />
      <Animated.View
        style={[
          styles.modal,
          {
            backgroundColor: theme.surface,
            borderColor: theme.outline,
          },
        ]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.headerTitle, { color: theme.primary }]}>
              ECHO-IMPROVED POLICY
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 4 }}>
              AI-generated policy revision addressing all blind spots
            </ThemedText>
          </View>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeBtn,
              { backgroundColor: theme.backgroundElement },
              pressed && { opacity: 0.7 },
            ]}>
            <ThemedText style={{ fontSize: 16, fontWeight: '700', color: theme.textSecondary }}>X</ThemedText>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}>

          {/* Loading state */}
          {isLoading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.three, textAlign: 'center' }}>
                Echo is rewriting this policy...
              </ThemedText>
              <ThemedText type="code" themeColor="textSecondary" style={{ marginTop: Spacing.two, textAlign: 'center', opacity: 0.6 }}>
                Addressing {forgottenStakeholders.length} blind spots and {conflicts.length} conflicts
              </ThemedText>
            </View>
          )}

          {/* Error state */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: theme.errorContainer }]}>
              <ThemedText style={{ color: theme.error, fontWeight: '600' }}>
                {error}
              </ThemedText>
              <Pressable
                onPress={handleGenerate}
                style={[styles.retryBtn, { borderColor: theme.error }]}>
                <ThemedText style={{ color: theme.error, fontWeight: '700', fontSize: 13 }}>
                  Try Again
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* Result */}
          {result && !isLoading && (
            <>
              {/* Original */}
              <View style={styles.section}>
                <ThemedText type="code" themeColor="textSecondary" style={styles.sectionLabel}>
                  ORIGINAL DECISION
                </ThemedText>
                <View style={[styles.policyBox, { backgroundColor: theme.backgroundElement, borderColor: theme.outline }]}>
                  <ThemedText type="small" style={{ lineHeight: 22, color: theme.textSecondary }}>
                    &ldquo;{decision}&rdquo;
                  </ThemedText>
                </View>
              </View>

              {/* Arrow */}
              <View style={styles.arrowContainer}>
                <ThemedText style={{ fontSize: 24, color: theme.primary }}>↓</ThemedText>
              </View>

              {/* Improved */}
              <View style={styles.section}>
                <ThemedText type="code" themeColor="primary" style={styles.sectionLabel}>
                  IMPROVED VERSION
                </ThemedText>
                <View style={[styles.policyBox, { backgroundColor: '#0D1B3E', borderColor: '#4F6EF7', borderWidth: 1 }]}>
                  <ThemedText type="small" style={{ lineHeight: 24, color: theme.text }}>
                    {result.improvedPolicy}
                  </ThemedText>
                </View>
              </View>

              {/* Changes */}
              {result.changes.length > 0 && (
                <View style={[styles.section, { marginTop: Spacing.four }]}>
                  <ThemedText type="code" themeColor="textSecondary" style={styles.sectionLabel}>
                    CHANGES MADE ({result.changes.length})
                  </ThemedText>
                  <View style={{ gap: Spacing.three, marginTop: Spacing.two }}>
                    {result.changes.map((change, idx) => (
                      <View
                        key={idx}
                        style={[styles.changeRow, { borderColor: theme.outline }]}>
                        <ThemedText style={{ fontSize: 16, fontWeight: '700', color: theme.success }}>+</ThemedText>
                        <View style={{ flex: 1 }}>
                          <ThemedText type="smallBold" style={{ color: theme.text }}>
                            {change.group}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2, lineHeight: 20 }}>
                            {change.clause}
                          </ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.five }}>
                <Pressable
                  onPress={handleCopy}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { flex: 1, backgroundColor: theme.primary },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                    {copied ? 'Copied!' : 'Copy Improved Policy'}
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  overlayBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modal: {
    width: '92%',
    maxWidth: 600,
    maxHeight: '90%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollBody: {
    paddingHorizontal: Spacing.four,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    padding: Spacing.four,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    gap: Spacing.three,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  section: {
    marginTop: Spacing.three,
  },
  sectionLabel: {
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: Spacing.two,
    fontSize: 12,
  },
  policyBox: {
    padding: Spacing.four,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  arrowContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  changeRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
