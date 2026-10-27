import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../store';
import { exportData, importData } from '../database/schema';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';

const ASSET_TYPES = ['Stocks', 'Crypto', 'Mutual Funds', 'Gold', 'Real Estate', 'ETFs', 'Bank Account', 'Physical Asset', 'Liability / Loan', 'Other'];

const ASSET_ICONS = {
  Stocks: 'bar-chart-2',
  Crypto: 'cpu',
  'Mutual Funds': 'pie-chart',
  Gold: 'award',
  'Real Estate': 'home',
  ETFs: 'trending-up',
  'Bank Account': 'briefcase',
  'Physical Asset': 'monitor',
  'Liability / Loan': 'credit-card',
  Other: 'box',
};

const formatCurrency = (value) => {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function AssetListScreen() {
  const assets = useStore(state => state.assets);
  const livePrices = useStore(state => state.livePrices);
  const createAsset = useStore(state => state.createAsset);
  const loadData = useStore(state => state.loadData);
  const navigation = useNavigation();

  const [modalVisible, setModalVisible] = useState(false);
  const [newAsset, setNewAsset] = useState({ name: '', type: 'Stocks', symbol: '', manualPrice: '', interestRate: '', depreciationRate: '' });

  const handleAddAsset = async () => {
    if (!newAsset.name) return;
    const id = Date.now().toString();
    const isBank = newAsset.type === 'Bank Account';
    const isPhysical = newAsset.type === 'Physical Asset';
    const isLiability = newAsset.type === 'Liability / Loan';
    const balanceOrPrice = newAsset.manualPrice ? parseFloat(newAsset.manualPrice) : 0;
    
    await createAsset({
      id,
      name: newAsset.name,
      type: newAsset.type,
      symbol: (isBank || isPhysical || isLiability) ? null : (newAsset.symbol || null),
      totalUnits: isBank ? balanceOrPrice : 0,
      totalInvested: isBank ? balanceOrPrice : 0,
      manualPrice: isBank ? 1 : balanceOrPrice,
      interestRate: (isBank || isLiability) ? (parseFloat(newAsset.interestRate) || 0) : null,
      depreciationRate: isPhysical ? (parseFloat(newAsset.depreciationRate) || 0) : null,
    });
    setModalVisible(false);
    setNewAsset({ name: '', type: 'Stocks', symbol: '', manualPrice: '', interestRate: '', depreciationRate: '' });
  };

  const handleExport = async () => {
    try {
      await exportData();
    } catch (e) {
      Alert.alert('Export Failed', e.message);
    }
  };

  const handleImport = async () => {
    const success = await importData();
    if (success) {
      await loadData();
      Alert.alert('Import Successful', 'Your portfolio has been restored.');
    }
  };

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
            {item.type}{item.symbol ? ` · ${item.symbol}` : ''}
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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Manage</Text>
            <Text style={styles.headerTitle}>My Assets</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleImport} style={styles.iconBtn}>
              <Feather name="download" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExport} style={styles.iconBtn}>
              <Feather name="upload" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
              <Feather name="plus" size={18} color={Colors.primary} />
              <Text style={styles.addBtnText}>Add Asset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {assets.length > 0 ? (
          <FlatList
            data={assets}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIconBox}>
              <Feather name="layers" size={36} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No assets yet</Text>
            <Text style={styles.emptyDesc}>Tap "Add Asset" to start building your portfolio</Text>
          </View>
        )}
      </SafeAreaView>

      {/* Add Asset Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Asset</Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Reliance Industries"
              placeholderTextColor={Colors.textMuted}
              value={newAsset.name}
              onChangeText={t => setNewAsset({ ...newAsset, name: t })}
            />

            <Text style={styles.inputLabel}>Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.typeRow}
            >
              {ASSET_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, newAsset.type === type && styles.typeChipActive]}
                  onPress={() => setNewAsset({ ...newAsset, type })}
                >
                  <Text style={[styles.typeChipText, newAsset.type === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {newAsset.type !== 'Bank Account' && newAsset.type !== 'Physical Asset' && newAsset.type !== 'Liability / Loan' && (
              <>
                <Text style={styles.inputLabel}>Symbol <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. RELIANCE, BTC-USD"
                  placeholderTextColor={Colors.textMuted}
                  value={newAsset.symbol}
                  autoCapitalize="characters"
                  onChangeText={t => setNewAsset({ ...newAsset, symbol: t })}
                />
              </>
            )}

            <Text style={styles.inputLabel}>
              {(newAsset.type === 'Bank Account' || newAsset.type === 'Liability / Loan') ? 'Current Balance (₹)' : 'Manual Price'}
              {(newAsset.type !== 'Bank Account' && newAsset.type !== 'Liability / Loan') && <Text style={styles.optional}> (if no ticker)</Text>}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={(newAsset.type === 'Bank Account' || newAsset.type === 'Liability / Loan') ? 'Enter balance in ₹' : 'Enter price in ₹'}
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={newAsset.manualPrice}
              onChangeText={t => setNewAsset({ ...newAsset, manualPrice: t })}
            />

            {(newAsset.type === 'Bank Account' || newAsset.type === 'Liability / Loan') && (
              <>
                <Text style={styles.inputLabel}>Interest Rate (%) <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 4.0"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={newAsset.interestRate}
                  onChangeText={t => setNewAsset({ ...newAsset, interestRate: t })}
                />
              </>
            )}

            {newAsset.type === 'Physical Asset' && (
              <>
                <Text style={styles.inputLabel}>Annual Depreciation Rate (%)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 10.0"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={newAsset.depreciationRate}
                  onChangeText={t => setNewAsset({ ...newAsset, depreciationRate: t })}
                />
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddAsset} style={styles.saveBtn}>
                <Feather name="check" size={16} color={Colors.primary} />
                <Text style={styles.saveText}>Save Asset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderRadius: Radius.sm,
  },
  addBtnText: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.background,
  },

  list: { paddingHorizontal: Spacing.md, paddingBottom: 32 },

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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: 6,
    fontWeight: Typography.medium,
  },
  optional: {
    color: Colors.textMuted,
    fontWeight: '400',
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    marginBottom: Spacing.md,
  },
  typeRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  typeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginRight: Spacing.xs,
  },
  typeChipActive: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  typeChipText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    fontWeight: Typography.medium,
  },
  typeChipTextActive: {
    color: Colors.accent,
    fontWeight: Typography.semibold,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: Radius.sm,
  },
  saveText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.background,
  },
});
