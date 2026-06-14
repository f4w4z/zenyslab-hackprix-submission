import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Linking as RNLinking, Platform } from 'react-native';
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
    <View style={[styles.container, { borderBottomColor: theme.outline }]}>
      {/* State 1: Idle */}
      {state === 'idle' && (
        <Animated.View entering={FadeIn} style={styles.stateContainer}>
          <View style={styles.headerRow}>
            <SymbolView name={{ ios: 'book.closed.fill', android: 'menu_book', web: 'menu_book' }} tintColor={theme.primary} size={20} />
            <ThemedText type="smallBold">Publish to Solana Accountability Ledger</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
            Create a permanent, verifiable on-chain record on the Solana Devnet blockchain using your Phantom Wallet.
          </ThemedText>
          <Pressable onPress={handleConnectAndPublish} style={[styles.buttonWrapper, { backgroundColor: theme.primary }]}>
            <View style={styles.gradientButton}>
              <ThemedText type="smallBold" style={[styles.buttonText, { color: theme.surface }]}>Connect Phantom Wallet</ThemedText>
            </View>
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
            <Animated.View style={[styles.barFill, progressStyle, { backgroundColor: theme.primary }]} />
          </View>
        </Animated.View>
      )}

      {/* State 4: Published */}
      {state === 'published' && signature && (
        <Animated.View entering={FadeIn} style={styles.stateContainer}>
          <View style={styles.headerRow}>
            <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} tintColor={theme.success} size={20} />
            <ThemedText type="smallBold" style={{ color: theme.success }}>Published to Solana Devnet</ThemedText>
          </View>
          <View style={[styles.detailsBox, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="code" themeColor="textSecondary">Ledger ID: #{signature.substring(0, 8)}...</ThemedText>
            <ThemedText type="code" themeColor="textSecondary">{blindSpots.length} blind spots recorded</ThemedText>
            <ThemedText type="code" themeColor="textSecondary">Signed by: {walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : '7xKp...mQ'}</ThemedText>
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
            <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} tintColor={theme.warning} size={20} />
            <ThemedText type="smallBold" style={{ color: theme.warning }}>No Devnet SOL</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
            {errorMessage}
          </ThemedText>
          <Pressable onPress={() => setState('idle')} style={[styles.outlineButton, { borderColor: theme.warning }]}>
            <ThemedText type="smallBold" style={{ color: theme.warning }}>Try Again</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* State 6: Error */}
      {state === 'error' && (
        <Animated.View entering={FadeIn} style={styles.stateContainer}>
          <View style={styles.headerRow}>
            <SymbolView name={{ ios: 'xmark.octagon.fill', android: 'error', web: 'error' }} tintColor={theme.error} size={20} />
            <ThemedText type="smallBold" style={{ color: theme.error }}>Transaction failed</ThemedText>
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
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    borderBottomWidth: 1,
    marginTop: 0,
    marginBottom: Spacing.two,
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
    ...Platform.select({
      ios: {
        shadowColor: '#4F6EF7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0px 0px 4px rgba(79, 110, 247, 0.8)',
      },
    }),
  },
  gradient: {
    flex: 1,
    borderRadius: BorderRadius.pill,
  },
  detailsBox: {
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    gap: Spacing.two,
  }
});
