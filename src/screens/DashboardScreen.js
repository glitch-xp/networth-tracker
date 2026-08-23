import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { PieChart } from 'react-native-gifted-charts';
import { useStore } from '../store';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { generateExecutiveSummaryWithNews } from '../services/gemini';
import ProjectionChart from '../components/ProjectionChart';
import { getCacheItem, setCacheItem, clearCacheItem } from '../utils/cache';

const formatCurrency = (value) => {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

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

// Premium grayscale + accent palette
const PREMIUM_PALETTE = [
  Colors.accent,        // Emerald
  '#FFFFFF',            // White
  'rgba(255,255,255,0.7)', // Light gray
  'rgba(255,255,255,0.4)', // Mid gray
  'rgba(0,200,120,0.4)',   // Muted Emerald
  'rgba(255,255,255,0.15)', // Dark gray
  'rgba(255,255,255,0.05)', // Darker gray
];

const AssetRow = ({ name, value, totalValue, returnPct, type, onPress }) => {
  const allocation = totalValue > 0 ? ((value / totalValue) * 100) : 0;
  const isProfitable = returnPct >= 0;
  const plColor = isProfitable ? Colors.success : Colors.danger;
  const iconName = ASSET_ICONS[type] || 'box';

  return (
    <TouchableOpacity style={styles.assetRow} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.assetIconWrapper}>
        <View style={styles.assetIconBg} />
        <Feather name={iconName} size={20} color={Colors.textPrimary} />
      </View>

      <View style={styles.assetInfo}>
        <Text style={styles.assetName}>{name}</Text>
        <Text style={styles.assetAllocation}>{allocation.toFixed(1)}% allocation</Text>
      </View>

      <View style={styles.assetValues}>
        <Text style={styles.assetValue}>{formatCurrency(value)}</Text>
        <View style={styles.assetReturnWrap}>
          <Feather name={isProfitable ? 'triangle' : 'triangle'} style={{ transform: [{ rotate: isProfitable ? '0deg' : '180deg' }] }} size={10} color={plColor} />
          <Text style={[styles.assetReturnPct, { color: plColor }]}>{Math.abs(returnPct).toFixed(1)}%</Text>
        </View>
      </View>

      <Feather name="chevron-right" size={20} color={Colors.textSecondary} style={styles.chevron} />
    </TouchableOpacity>
  );
};

export default function DashboardScreen() {
  const assets = useStore(state => state.assets);
  const livePrices = useStore(state => state.livePrices);
  const settings = useStore(state => state.settings);
  const getPortfolioSummary = useStore(state => state.getPortfolioSummary);
  const executiveSummary = useStore(state => state.executiveSummary);
  const setExecutiveSummary = useStore(state => state.setExecutiveSummary);
  const portfolioCAGR = useStore(state => state.portfolioCAGR);
  const isFetchingSummary = useStore(state => state.isFetchingSummary);
  const setIsFetchingSummary = useStore(state => state.setIsFetchingSummary);

  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [isVisible, setIsVisible] = useState(true);
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('Investments');
  const [refreshing, setRefreshing] = useState(false);
  const transactions = useStore(state => state.transactions);
  const sips = useStore(state => state.sips);
  const cashFlows = useStore(state => state.cashFlows || []);
  const loadData = useStore(state => state.loadData);

  const totalMonthlySip = useMemo(() => {
    return sips.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + s.amount, 0);
  }, [sips]);

  const summary = useMemo(() => {
    let totalValue = 0;
    let totalInvestedAll = 0;
    let bestPerformer = null;
    let maxReturn = -Infinity;
    let worstPerformer = null;
    let minReturn = Infinity;
    let largestAsset = null;
    let maxAssetValue = -Infinity;
    let totalDebt = 0;

    // Group by category to match the layout (which groups assets by type)
    const categoryTotals = {};

    assets.forEach(asset => {
      const isLiability = asset.type === 'Liability / Loan';
      const currentPrice = livePrices[asset.id] || asset.manualPrice || 0;
      let currentValue = currentPrice * asset.totalUnits;
      
      if (isLiability) {
        totalValue -= currentValue;
        totalInvestedAll -= asset.totalInvested;
        totalDebt += currentValue;
      } else {
        totalValue += currentValue;
        totalInvestedAll += asset.totalInvested;
      }

      const returnPct = asset.totalInvested > 0
        ? ((currentValue - asset.totalInvested) / asset.totalInvested) * 100
        : 0;

      if (!categoryTotals[asset.type]) {
        categoryTotals[asset.type] = {
          name: asset.type,
          type: asset.type,
          value: 0,
          totalInvested: 0
        };
      }
      categoryTotals[asset.type].value += (isLiability ? -currentValue : currentValue);
      categoryTotals[asset.type].totalInvested += asset.totalInvested;

      if (!isLiability && returnPct > maxReturn && currentValue > 0) {
        maxReturn = returnPct;
        bestPerformer = { ...asset, returnPct };
      }
      
      if (returnPct < minReturn && currentValue > 0 && asset.totalInvested > 0) {
        minReturn = returnPct;
        worstPerformer = { ...asset, returnPct };
      }

      if (currentValue > maxAssetValue) {
        maxAssetValue = currentValue;
        largestAsset = { ...asset, value: currentValue };
      }
    });

    const categories = Object.values(categoryTotals).map(c => ({
      ...c,
      returnPct: c.totalInvested > 0 ? ((c.value - c.totalInvested) / c.totalInvested) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    const totalProfitLossPct = totalInvestedAll > 0 
      ? ((totalValue - totalInvestedAll) / totalInvestedAll) * 100 
      : 0;

    let bestCategory = null;
    if (categories.length > 0) {
      bestCategory = categories.reduce((prev, current) => (prev.returnPct > current.returnPct) ? prev : current);
    }

    return { 
      totalValue, 
      totalInvestedAll, 
      totalProfitLossPct, 
      bestPerformer, 
      worstPerformer, 
      largestAsset, 
      bestCategory, 
      categories,
      totalDebt
    };
  }, [assets, livePrices]);

  const { totalValue, totalInvestedAll, totalProfitLossPct, bestPerformer, worstPerformer, largestAsset, bestCategory, categories, totalDebt } = summary;

  const totalIncome = useMemo(() => cashFlows.filter(c => c.type === 'INCOME').reduce((s, c) => s + c.amount, 0), [cashFlows]);
  const totalExpense = useMemo(() => cashFlows.filter(c => c.type === 'EXPENSE').reduce((s, c) => s + c.amount, 0), [cashFlows]);
  const netSavings = totalIncome - totalExpense;

  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const animTranslateY = useRef(new Animated.Value(0)).current;
  const animOpacity = useRef(new Animated.Value(1)).current;

  const truncateName = (str) => {
    if (!str) return '---';
    return str.length > 18 ? str.substring(0, 18) + '...' : str;
  };

  const banners = useMemo(() => {
    const items = [];
    
    if (totalInvestedAll > 0) {
      items.push({
        label: 'Overall Return',
        value: totalProfitLossPct >= 0 ? `+${formatCurrency(totalValue - totalInvestedAll)}` : `-${formatCurrency(totalInvestedAll - totalValue)}`,
        color: totalProfitLossPct >= 0 ? Colors.success : Colors.danger,
        icon: totalProfitLossPct >= 0 ? 'triangle' : 'triangle',
        rotation: totalProfitLossPct >= 0 ? '0deg' : '180deg',
        pctText: `${Math.abs(totalProfitLossPct).toFixed(2)}%`,
        onPress: null
      });
    }

    if (bestPerformer && bestPerformer.returnPct > 0) {
      items.push({
        label: 'Top Gainer',
        value: truncateName(bestPerformer.name),
        color: Colors.success,
        icon: 'triangle',
        rotation: '0deg',
        pctText: `${Math.abs(bestPerformer.returnPct).toFixed(2)}%`,
        onPress: () => navigation.navigate('AssetDetail', { assetId: bestPerformer.id })
      });
    }
    
    if (worstPerformer && worstPerformer.returnPct < 0) {
      items.push({
        label: 'Top Loser',
        value: truncateName(worstPerformer.name),
        color: Colors.danger,
        icon: 'triangle',
        rotation: '180deg',
        pctText: `${Math.abs(worstPerformer.returnPct).toFixed(2)}%`,
        onPress: () => navigation.navigate('AssetDetail', { assetId: worstPerformer.id })
      });
    }

    if (largestAsset && largestAsset.value > 0 && totalValue > 0) {
      items.push({
        label: 'Largest Holding',
        value: truncateName(largestAsset.name),
        color: Colors.accent,
        icon: 'pie-chart',
        rotation: '0deg',
        pctText: `${((largestAsset.value / totalValue) * 100).toFixed(1)}%`,
        onPress: () => navigation.navigate('AssetDetail', { assetId: largestAsset.id })
      });
    }

    if (bestCategory && bestCategory.returnPct > 0) {
      items.push({
        label: 'Best Category',
        value: truncateName(bestCategory.name),
        color: Colors.success,
        icon: 'star',
        rotation: '0deg',
        pctText: `${bestCategory.returnPct.toFixed(2)}%`,
        onPress: () => navigation.navigate('CategoryAssets', { category: bestCategory.type })
      });
    }

    return items;
  }, [bestPerformer, worstPerformer, largestAsset, bestCategory, totalValue, totalInvestedAll, totalProfitLossPct, navigation]);

  useEffect(() => {
    if (banners.length <= 1) return;

    const intervalId = setInterval(() => {
      Animated.parallel([
        Animated.timing(animTranslateY, {
          toValue: -15,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(animOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(() => {
        setCurrentBannerIndex(prev => (prev + 1) % banners.length);
        animTranslateY.setValue(15);
        
        Animated.parallel([
          Animated.timing(animTranslateY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(animOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          })
        ]).start();
      });
    }, 4000);

    return () => clearInterval(intervalId);
  }, [banners.length]);

  useEffect(() => {
    const fetchSummary = async () => {
      if (settings.aiExecutiveSummaryEnabled && settings.geminiApiKey && !executiveSummary && !isFetchingSummary) {
        setIsFetchingSummary(true);
        
        const cacheKey = 'ai_executive_summary_v4';
        const cachedData = await getCacheItem(cacheKey, refreshing);
        if (cachedData) {
          setExecutiveSummary(cachedData);
          setIsFetchingSummary(false);
          return;
        }

        const portfolioSummary = getPortfolioSummary();
        const portfolioData = {
          summary: portfolioSummary,
          activeSIPs: sips.filter(s => s.status === 'ACTIVE').map(s => {
            const asset = assets.find(a => a.id === s.assetId);
            return { amount: s.amount, assetName: asset?.name, assetSymbol: asset?.symbol, type: asset?.type };
          }),
          assets: assets.map(a => ({ name: a.name, symbol: a.symbol, type: a.type, totalValue: (livePrices[a.id] || a.manualPrice || 0) * a.totalUnits })),
          exactCalculatedCAGR: portfolioCAGR
        };
        const summaryStr = await generateExecutiveSummaryWithNews(settings.geminiApiKey, settings.geminiModel, portfolioData);
        if (summaryStr) {
          await setCacheItem(cacheKey, summaryStr);
        }
        setExecutiveSummary(summaryStr);
        setIsFetchingSummary(false);
      }
    };
    fetchSummary();
  }, [settings.aiExecutiveSummaryEnabled, settings.geminiApiKey, settings.geminiModel, executiveSummary, refreshing]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    await clearCacheItem('ai_executive_summary_v4');
    setExecutiveSummary('');
    setRefreshing(false);
  }, [loadData, setExecutiveSummary]);

  const currentBanner = banners[currentBannerIndex];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        <SafeAreaView edges={['top']}>
          {/* Top Header */}
          <View style={styles.topHeader}>
            <View style={styles.netWorthHeader}>
              <Text style={styles.netWorthLabel}>MY NET WORTH</Text>
              <TouchableOpacity onPress={() => setIsVisible(!isVisible)} style={styles.eyeBtn}>
                <Feather name={isVisible ? "eye" : "eye-off"} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.netWorthValueRow}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setIsChartExpanded(!isChartExpanded)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.netWorthValue}>
                  {isVisible ? formatCurrency(totalValue) : '₹••••••'}
                </Text>
                <Feather name={isChartExpanded ? "chevron-up" : "chevron-down"} size={24} color={Colors.textPrimary} style={styles.valueChevron} />
              </TouchableOpacity>
            </View>
            
            {totalDebt > 0 && isVisible && (
              <View style={styles.debtBadge}>
                <Feather name="alert-triangle" size={14} color={Colors.danger} />
                <Text style={styles.debtText}>Includes {formatCurrency(totalDebt)} in Liabilities</Text>
              </View>
            )}

            {isChartExpanded && isVisible && (
              <View style={styles.inlineChartContainer}>
                 <ProjectionChart currentValue={totalValue} cagr={portfolioCAGR || {}} monthlySip={totalMonthlySip} />
              </View>
            )}

            {/* Top Performer Banner */}
            {currentBanner ? (
              <TouchableOpacity 
                style={styles.topGainerBanner} 
                activeOpacity={currentBanner.onPress ? 0.8 : 1}
                onPress={currentBanner.onPress}
              >
                <Animated.View style={[styles.bannerContent, { opacity: animOpacity, transform: [{ translateY: animTranslateY }] }]}>
                  <Text style={styles.topGainerLabel}>{currentBanner.label}: <Text style={styles.topGainerName}>{currentBanner.value}</Text></Text>
                  <View style={styles.topGainerBadge}>
                    <Feather name={currentBanner.icon} style={{ transform: [{ rotate: currentBanner.rotation }] }} size={10} color={currentBanner.color} />
                    <Text style={[styles.topGainerPct, { color: currentBanner.color }]}>{currentBanner.pctText}</Text>
                  </View>
                </Animated.View>
                <View style={{ flex: 1 }} />
                <Feather name="chevron-right" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.topGainerBanner, { opacity: 0.5 }]}>
                <Text style={styles.topGainerLabel}>No active investments</Text>
              </View>
            )}
          </View>
        </SafeAreaView>

        {/* AI Executive Summary */}
        {settings.aiExecutiveSummaryEnabled && settings.geminiApiKey ? (
          <View style={styles.aiSummarySection}>
            <View style={styles.aiSummaryHeader}>
              <View style={styles.aiSummaryIconBox}>
                <Feather name="cpu" size={16} color={Colors.accent} />
              </View>
              <Text style={styles.aiSummaryTitle}>Executive Summary</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity 
                onPress={async () => {
                  await clearCacheItem('ai_executive_summary_v4');
                  setExecutiveSummary('');
                }} 
                style={styles.refreshBtn}
                disabled={isFetchingSummary}
              >
                <Feather name="refresh-cw" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.aiSummaryContent}>
              {isFetchingSummary ? (
                <Text style={styles.aiSummaryLoading}>Generating insights with Gemini...</Text>
              ) : (
                <Text style={styles.aiSummaryText}>
                  {executiveSummary || 'No summary available.'}
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {/* Cash Flow Section */}
        <View style={styles.assetsSection}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Monthly Cash Flow</Text>
            <TouchableOpacity onPress={() => navigation.navigate('CashFlow')}>
              <Text style={{ color: Colors.accent, fontSize: Typography.sm, fontWeight: '600' }}>Manage</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.cashFlowCard}
            onPress={() => navigation.navigate('CashFlow')}
            activeOpacity={0.8}
          >
            <View style={styles.cfRow}>
              <View style={styles.cfItem}>
                <Text style={styles.cfLabel}>Income</Text>
                <Text style={[styles.cfValue, { color: Colors.success }]}>{formatCurrency(totalIncome)}</Text>
              </View>
              <View style={styles.cfItem}>
                <Text style={styles.cfLabel}>Expenses</Text>
                <Text style={[styles.cfValue, { color: Colors.danger }]}>{formatCurrency(totalExpense)}</Text>
              </View>
              <View style={[styles.cfItem, { borderLeftWidth: 1, borderLeftColor: Colors.surfaceBorder, paddingLeft: Spacing.md }]}>
                <Text style={styles.cfLabel}>Savings</Text>
                <Text style={[styles.cfValue, { color: netSavings >= 0 ? Colors.accent : Colors.danger }]}>{formatCurrency(netSavings)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Assets Section */}
        <View style={styles.assetsSection}>
          <Text style={styles.sectionTitle}>Allocations</Text>
          {categories.length > 0 ? (
            categories.map(cat => (
              <AssetRow
                key={cat.type}
                name={cat.name}
                type={cat.type}
                value={cat.value}
                totalValue={totalValue}
                returnPct={cat.returnPct}
                onPress={() => navigation.navigate('CategoryAssets', { category: cat.type })}
              />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Feather name="layers" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No assets yet</Text>
            </View>
          )}
        </View>

        {/* Allocations Chart */}
        {totalValue > 0 && categories.length > 0 && (
          <View style={styles.chartSection}>
            <View style={styles.chartContainer}>
              <PieChart
                data={categories.filter(c => c.value > 0).map((cat, index) => {
                  return {
                    value: cat.value,
                    color: PREMIUM_PALETTE[index % PREMIUM_PALETTE.length],
                  };
                })}
                donut
                innerRadius={65}
                radius={100}
                strokeWidth={3}
                strokeColor={Colors.background}
                backgroundColor="transparent"
              />
              
              <View style={styles.legendContainer}>
                {categories.filter(c => c.value > 0).map((cat, index) => {
                  const allocation = ((cat.value / totalValue) * 100).toFixed(0) + '%';
                  return (
                    <View key={cat.type} style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: PREMIUM_PALETTE[index % PREMIUM_PALETTE.length] }]} />
                      <Text style={styles.legendText}>{cat.name} {allocation}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        <View style={{ height: Spacing.xl + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.md },

  topHeader: {
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  netWorthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  netWorthLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  eyeBtn: {
    padding: 4,
  },
  netWorthValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  netWorthValue: {
    fontSize: 42,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  valueChevron: {
    marginLeft: 8,
    marginTop: 4,
  },
  topGainerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden', // to hide the animated content outside
  },
  inlineChartContainer: {
    marginBottom: Spacing.md,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topGainerLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  topGainerName: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  topGainerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    gap: 4,
  },
  topGainerPct: {
    color: Colors.success,
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  debtBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,77,109,0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    marginBottom: Spacing.md,
    marginTop: -Spacing.sm,
    gap: 6,
  },
  debtText: {
    color: Colors.danger,
    fontSize: Typography.xs,
    fontWeight: '600',
  },

  chartSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  aiSummarySection: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accentLight,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  aiSummaryIconBox: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  aiSummaryTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.accent,
  },
  refreshBtn: {
    padding: 4,
  },
  aiSummaryContent: {
    paddingTop: 4,
  },
  aiSummaryText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  aiSummaryLoading: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  legendColor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  cashFlowCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  cfRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cfItem: {
    flex: 1,
  },
  cfLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  cfValue: {
    fontSize: Typography.sm,
    fontWeight: 'bold',
  },

  assetsSection: {
    marginTop: Spacing.sm,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  assetIconWrapper: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  assetIconBg: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222222',
    borderWidth: 1,
    borderColor: '#333333',
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: Typography.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  assetAllocation: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  assetValues: {
    alignItems: 'flex-end',
  },
  assetValue: {
    fontSize: Typography.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  assetReturnWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assetReturnPct: {
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 12,
  },

  emptyCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.base,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },
});
