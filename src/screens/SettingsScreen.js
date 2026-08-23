import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../store';
import { generateInsights } from '../services/gemini';
import { Colors, Typography, Spacing, Radius } from '../theme';

import { Switch } from 'react-native';

const SectionCard = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export default function SettingsScreen() {
  const settings = useStore(state => state.settings);
  const setSetting = useStore(state => state.setSetting);
  const getPortfolioSummary = useStore(state => state.getPortfolioSummary);

  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);

  const handleGenerateInsights = async () => {
    if (!settings.geminiApiKey) {
      setInsight('Please enter a Gemini API Key first.');
      return;
    }
    setLoading(true);
    setInsight('');
    const summary = getPortfolioSummary();
    const result = await generateInsights(settings.geminiApiKey, settings.geminiModel, summary);
    setInsight(result);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageHeaderSub}>Configure</Text>
            <Text style={styles.pageHeaderTitle}>Settings</Text>
          </View>

          {/* API Key Section */}
          <SectionCard>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBox, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Feather name="key" size={16} color="#3B82F6" />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={styles.cardTitle}>Gemini API Key</Text>
                <Text style={styles.cardDesc}>Required for AI portfolio insights. Stored locally on device.</Text>
              </View>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="AIzaSy..."
                placeholderTextColor={Colors.textMuted}
                value={settings.geminiApiKey}
                onChangeText={t => setSetting('geminiApiKey', t)}
                secureTextEntry={!keyVisible}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setKeyVisible(v => !v)} style={styles.eyeBtn}>
                <Feather name={keyVisible ? 'eye-off' : 'eye'} size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.keyNote}>
              <Feather name="shield" size={12} color={Colors.textMuted} />
              <Text style={styles.keyNoteText}>Never sent to external servers</Text>
            </View>

            {/* Model Selection */}
            <View style={{ marginTop: Spacing.md }}>
              <Text style={styles.settingLabel}>AI Model</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="gemini-1.5-flash"
                  placeholderTextColor={Colors.textMuted}
                  value={settings.geminiModel}
                  onChangeText={t => setSetting('geminiModel', t)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={[styles.cardDesc, { marginTop: -Spacing.xs }]}>
                Enter the exact model name (e.g., gemini-1.5-flash)
              </Text>
            </View>

            {/* AI Executive Summary Toggle */}
            <View style={[styles.infoRow, { marginTop: Spacing.md, borderBottomWidth: 0, paddingVertical: 4 }]}>
              <View style={{ flex: 1, paddingRight: Spacing.md }}>
                <Text style={[styles.infoLabel, { color: Colors.textPrimary, fontSize: Typography.base }]}>Dashboard Executive Summary</Text>
                <Text style={[styles.cardDesc, { marginTop: 2 }]}>Show an AI-generated summary on the dashboard.</Text>
              </View>
              <Switch
                value={settings.aiExecutiveSummaryEnabled}
                onValueChange={(val) => setSetting('aiExecutiveSummaryEnabled', val)}
                trackColor={{ false: Colors.surfaceBorder, true: Colors.accentLight }}
                thumbColor={settings.aiExecutiveSummaryEnabled ? Colors.accent : Colors.textMuted}
              />
            </View>
          </SectionCard>

          {/* AI Insights Section */}
          <SectionCard>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBox, { backgroundColor: Colors.accentLight }]}>
                <Feather name="cpu" size={16} color={Colors.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={styles.cardTitle}>AI Portfolio Insights</Text>
                <Text style={styles.cardDesc}>Powered by Gemini — objective analysis, no advice.</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerateInsights}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Feather name="zap" size={16} color={Colors.primary} />
                  <Text style={styles.generateBtnText}>Generate Insights</Text>
                </>
              )}
            </TouchableOpacity>

            {loading && (
              <View style={styles.loadingRow}>
                <Text style={styles.loadingText}>Analyzing your portfolio...</Text>
              </View>
            )}

            {insight ? (
              <View style={styles.insightBox}>
                <View style={styles.insightHeader}>
                  <Feather name="bar-chart" size={14} color={Colors.accent} />
                  <Text style={styles.insightHeaderText}>AI Analysis</Text>
                </View>
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ) : null}
          </SectionCard>

          {/* App Info */}
          <SectionCard>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBox, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
                <Feather name="info" size={16} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={styles.cardTitle}>About NetWorth</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Data Storage</Text>
              <Text style={styles.infoValue}>On-device (SQLite)</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Price Source</Text>
              <Text style={styles.infoValue}>Yahoo Finance</Text>
            </View>
          </SectionCard>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.md },

  pageHeader: {
    paddingVertical: Spacing.md,
  },
  pageHeaderSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  pageHeaderTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    lineHeight: 18,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    color: Colors.textPrimary,
    fontSize: Typography.base,
  },
  eyeBtn: {
    paddingHorizontal: Spacing.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  keyNoteText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },

  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
  },
  generateBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.primary,
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  loadingText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  insightBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.accentLight,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  insightHeaderText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.accent,
  },
  insightText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  infoLabel: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  infoValue: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  settingLabel: {
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
    marginBottom: Spacing.xs,
  },
});
