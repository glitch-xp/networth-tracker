import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../store';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius } from '../theme';
import ProjectionChart from '../components/ProjectionChart';
import { calculateHistoricalCAGR } from '../utils/projections';

const ASSET_ICONS = {
  Stocks: 'bar-chart-2',
  Crypto: 'cpu',
  'Mutual Funds': 'pie-chart',
  Gold: 'award',
  'Real Estate': 'home',
  ETFs: 'trending-up',
  'Bank Account': 'briefcase',
  Other: 'box',
};

const formatCurrency = (value) => {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function CategoryAssetsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { category } = route.params;

  const assets = useStore(state => state.assets);
  const livePrices = useStore(state => state.livePrices);
  const transactions = useStore(state => state.transactions);

  const filteredAssets = assets.filter(item => item.type === category);

  const categoryValue = React.useMemo(() => {
    return filteredAssets.reduce((sum, item) => {
      const price = livePrices[item.id] || item.manualPrice || 0;
      return sum + price * item.totalUnits;
    }, 0);
  }, [filteredAssets, livePrices]);

  const categoryCAGR = React.useMemo(() => {
    return calculateHistoricalCAGR(filteredAssets, transactions, livePrices);
  }, [filteredAssets, transactions, livePrices]);

  const renderItem = ({ item }) => {
    const price = livePrices[item.id] || item.manualPrice || 0;
    const value = price * item.totalUnits;
    const profitLoss = value - item.totalInvested;
    const isPL = profitLoss >= 0;
    const iconName = ASSET_ICONS[item.type] || 'box';

    return (
      <TouchableOpacity
        style={styles.assetCard}
        onPress={() => navigation.navigate('AssetDetail', { assetId: item.id })}
        activeOpacity={0.75}
      >
        <View style={styles.assetIconBox}>
          <Feather name={iconName} size={20} color={Colors.textPrimary} />
        </View>
        <View style={styles.assetInfo}>
          <Text style={styles.assetName}>{item.name}</Text>
          <Text style={styles.assetSub}>
            {item.totalUnits} Units{item.symbol ? ` · ${item.symbol}` : ''}
          </Text>
        </View>
        <View style={styles.assetRight}>
          <Text style={styles.assetValue}>{formatCurrency(value)}</Text>
          <View style={[styles.plBadge, { backgroundColor: isPL ? Colors.accentLight : 'rgba(255,77,109,0.1)' }]}>
            <Feather name={isPL ? 'chevron-up' : 'chevron-down'} size={11} color={isPL ? Colors.success : Colors.danger} />
            <Text style={[styles.plText, { color: isPL ? Colors.success : Colors.danger }]}>
              {formatCurrency(Math.abs(profitLoss))}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={16} color={Colors.textMuted} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
             <Text style={styles.headerSub}>Category</Text>
             <Text style={styles.headerTitle}>{category}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {filteredAssets.length > 0 ? (
          <FlatList
            data={filteredAssets}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={styles.sectionTitle}>Performance Forecast</Text>
                <ProjectionChart currentValue={categoryValue} cagr={categoryCAGR} />
                <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>Holdings</Text>
              </View>
            }
          />
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIconBox}>
              <Feather name={ASSET_ICONS[category] || 'box'} size={36} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No {category} yet</Text>
            <Text style={styles.emptyDesc}>Go to your assets tab to add some.</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 32, paddingTop: Spacing.sm },

  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  assetIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#222222',
    borderWidth: 1,
    borderColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  assetInfo: { flex: 1 },
  assetName: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  assetSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  assetRight: { alignItems: 'flex-end', marginRight: 4 },
  assetValue: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  plBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    gap: 2,
  },
  plText: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },

  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
});
