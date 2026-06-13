import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Linking as RNLinking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, FadeIn } from 'react-native-reanimated';

import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Spacing } from '@/constants/theme';
import { connectPhantom, publishToLedger, getSolanaExplorerUrl } from '@/services/solana';

type LedgerState = 'idle' | 'connecting' | 'publishing' | 'published' | 'error' | 'no_sol';

export interface AccountabilityLedgerProps {
  decision: string;
  blindSpots: string[];
}

export function AccountabilityLedger({ decision, blindSpots }: AccountabilityLedgerProps) {
  const theme = useTheme();
  const [state, setState] = useState<LedgerState>('idle');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const progress = useSharedValue(0);

  useEffect(() => {
    if (state === 'publishing') {
      progress.value = 0;
      progress.value = withTiming(90, { duration: 4000, easing: Easing.out(Easing.quad) });
    } else if (state === 'published') {
      progress.value = withTiming(100, { duration: 300 });
    }
  }, [state, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  const handleConnectAndPublish = async () => {
    setState('connecting');
    setErrorMessage(null);
    try {
      // 1. Connect Phantom and get real wallet address
      const address = await connectPhantom();
      setWalletAddress(address);

      // 2. Publish real transaction to Solana devnet
      setState('publishing');
      const sig = await publishToLedger(decision, blindSpots, address);
      setSignature(sig);
      setState('published');

    } catch (err: any) {
      console.error('Ledger publish error:', err);
      // Show specific faucet message if wallet has no SOL
      if (err.message?.includes('faucet.solana.com')) {
        setErrorMessage(err.message);
        setState('no_sol');
      } else {
        setErrorMessage(err.message || 'Transaction failed');
        setState('error');
      }
    }
  };

  const handleViewExplorer = () => {
    if (signature) {
      RNLinking.openURL(getSolanaExplorerUrl(signature));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.outline }]}>
      {/* State 1: Idle */}
      {state === 'idle' && (
        <Animated.View entering={FadeIn} style={styles.stateContainer}>
          <View style={styles.headerRow}>
            <SymbolView name={{ ios: 'book.closed.fill', android: 'menu_book', web: 'menu_book' }} tintColor={theme.primary} size={20} />
            <ThemedText type="defaultSemiBold">Publish to Accountability Ledger</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
            Create a permanent on-chain record that these blind spots were seen.
          </ThemedText>
          <Pressable onPress={handleConnectAndPublish} style={styles.buttonWrapper}>
            <LinearGradient colors={['#4F6EF7', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientButton}>
              <ThemedText type="smallBold" style={styles.buttonText}>Connect Phantom Wallet</ThemedText>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}

      {/* State 2: Connecting */}
      {state === 'connecting' && (
        <Animated.View entering={FadeIn} style={styles.centeredState}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.loadingText}>Connecting to Phantom...</ThemedText>
        </Animated.View>
      )}

      {/* State 3: Publishing */}
      {state === 'publishing' && (
        <Animated.View entering={FadeIn} style={styles.centeredState}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.loadingText}>Publishing to Solana devnet...</ThemedText>
          <View style={[styles.barBackground, { backgroundColor: theme.outline }]}>
            <Animated.View style={[styles.barFill, progressStyle]}>
              <LinearGradient colors={['#4F6EF7', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient} />
            </Animated.View>
          </View>
        </Animated.View>
      )}

      {/* State 4: Published */}
      {state === 'published' && signature && (
        <Animated.View entering={FadeIn} style={styles.stateContainer}>
          <View style={styles.headerRow}>
            <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} tintColor="#10B981" size={20} />
            <ThemedText type="defaultSemiBold" style={{ color: '#10B981' }}>Published to Solana Devnet</ThemedText>
          </View>
          <View style={styles.detailsBox}>
            <ThemedText type="code" themeColor="textSecondary">Ledger ID: #{signature.substring(0, 8)}...</ThemedText>
            <ThemedText type="code" themeColor="textSecondary">{blindSpots.length} blind spots recorded</ThemedText>
            <ThemedText type="code" themeColor="textSecondary">Signed by: 7xKp...mQ</ThemedText>
          </View>
          <Pressable onPress={handleViewExplorer} style={[styles.outlineButton, { borderColor: theme.primary }]}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>View on Solana Explorer →</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* State 5: No SOL – faucet needed */}
      {state === 'no_sol' && (
        <Animated.View entering={FadeIn} style={styles.stateContainer}>
          <View style={styles.headerRow}>
            <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} tintColor="#F59E0B" size={20} />
            <ThemedText type="defaultSemiBold" style={{ color: '#F59E0B' }}>No Devnet SOL</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
            {errorMessage}
          </ThemedText>
          <Pressable onPress={() => setState('idle')} style={[styles.outlineButton, { borderColor: '#F59E0B' }]}>
            <ThemedText type="smallBold" style={{ color: '#F59E0B' }}>Try Again</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* State 6: Error */}
      {state === 'error' && (
        <Animated.View entering={FadeIn} style={styles.stateContainer}>
          <View style={styles.headerRow}>
            <SymbolView name={{ ios: 'xmark.octagon.fill', android: 'error', web: 'error' }} tintColor={theme.error} size={20} />
            <ThemedText type="defaultSemiBold" style={{ color: theme.error }}>Transaction failed</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.description}>{errorMessage}</ThemedText>
          <Pressable onPress={() => setState('idle')} style={[styles.outlineButton, { borderColor: theme.error }]}>
            <ThemedText type="smallBold" style={{ color: theme.error }}>Try Again</ThemedText>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.four,
    marginBottom: Spacing.six,
  },
  stateContainer: {
    gap: Spacing.three,
  },
  centeredState: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  description: {
    lineHeight: 20,
  },
  buttonWrapper: {
    marginTop: Spacing.one,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  gradientButton: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
  },
  outlineButton: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.one,
  },
  loadingText: {
    fontWeight: '500',
  },
  barBackground: {
    height: 4,
    alignSelf: 'stretch',
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
    marginTop: Spacing.two,
  },
  barFill: {
    height: '100%',
    shadowColor: '#4F6EF7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  gradient: {
    flex: 1,
    borderRadius: BorderRadius.pill,
  },
  detailsBox: {
    padding: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.md,
    gap: Spacing.two,
  }
});
