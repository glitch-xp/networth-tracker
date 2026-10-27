import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';

const AnimatedBar = ({ delay, height }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        width: 4,
        height,
        borderRadius: 3,
        backgroundColor: Colors.accent,
        opacity: anim,
        marginHorizontal: 3,
      }}
    />
  );
};

export default function LoginScreen({ onAuthenticate }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Background glow */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <SafeAreaView style={styles.inner}>
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Logo Mark */}
          <View style={styles.logoContainer}>
            <View style={styles.logoRing}>
              <View style={styles.logo}>
                <Feather name="trending-up" size={28} color={Colors.accent} />
              </View>
            </View>
            {/* Animated bars beside logo */}
            <View style={styles.bars}>
              <AnimatedBar delay={0} height={16} />
              <AnimatedBar delay={150} height={26} />
              <AnimatedBar delay={300} height={20} />
              <AnimatedBar delay={450} height={32} />
              <AnimatedBar delay={200} height={22} />
            </View>
          </View>

          <Text style={styles.appName}>NetWorth</Text>
          <Text style={styles.tagline}>Your wealth, beautifully tracked</Text>

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>100%</Text>
              <Text style={styles.statLabel}>Private</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Live</Text>
              <Text style={styles.statLabel}>Prices</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>AI</Text>
              <Text style={styles.statLabel}>Insights</Text>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.unlockBtn}
            onPress={onAuthenticate}
            activeOpacity={0.85}
          >
            <View style={styles.unlockBtnInner}>
              <Feather name="lock" size={18} color={Colors.primary} />
              <Text style={styles.unlockBtnText}>Unlock with Biometrics</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.secureNote}>
            Your data never leaves this device
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    left: '50%',
    marginLeft: -200,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: Colors.accent,
    opacity: 0.1,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -120,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.textSecondary,
    opacity: 0.05,
  },
  inner: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: 'rgba(0,200,120,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginLeft: Spacing.md,
    height: 40,
  },
  appName: {
    fontSize: Typography.hero,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -1.5,
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
    letterSpacing: 0.2,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xxl,
    width: '100%',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.accent,
  },
  statLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  unlockBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.xl + 8,
    width: '100%',
    marginBottom: Spacing.md,
  },
  unlockBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  unlockBtnText: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.background,
    letterSpacing: 0.3,
  },
  secureNote: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
});
