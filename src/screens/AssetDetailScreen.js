import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { getTransactions } from '../database/schema';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';

const formatCurrency = (value) => {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function AssetDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { assetId } = route.params;

  const assets = useStore(state => state.assets);
  const livePrices = useStore(state => state.livePrices);
  const createTransaction = useStore(state => state.createTransaction);
  
  const sips = useStore(state => state.sips);
  const createSIP = useStore(state => state.createSIP);
  const editAsset = useStore(state => state.editAsset);

  const asset = assets.find(a => a.id === assetId);
  const assetSips = sips ? sips.filter(s => s.assetId === assetId) : [];

  const [txs, setTxs] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [txForm, setTxForm] = useState({ type: 'buy', units: '', price: '' });
  
  const [sipModalVisible, setSipModalVisible] = useState(false);
  const [sipForm, setSipForm] = useState({ amount: '', dateOfMonth: '1', startDate: new Date().toISOString().split('T')[0] });

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', type: 'Stocks', symbol: '', manualPrice: '', interestRate: '', depreciationRate: ''
  });

  useEffect(() => {
    if (asset) {
      setEditForm({
        name: asset.name,
        type: asset.type,
        symbol: asset.symbol || '',
        manualPrice: asset.type === 'Bank Account' ? asset.totalUnits.toString() : (asset.manualPrice ? asset.manualPrice.toString() : ''),
        interestRate: asset.interestRate ? asset.interestRate.toString() : '',
        depreciationRate: asset.depreciationRate ? asset.depreciationRate.toString() : ''
      });
    }
  }, [asset]);

  useEffect(() => { loadTxs(); }, [assetId]);

  const loadTxs = async () => {
    const data = await getTransactions(assetId);
    setTxs(data);
  };

  const handleAddTx = async () => {
    let finalUnits = parseFloat(txForm.units);
    let finalPrice = parseFloat(txForm.price);
    
    if (txForm.type === 'fee') {
      // For a fee, the user just entered a total fee amount in 'units' or 'price'.
      // Let's assume we repurposed the 'units' field as 'Fee Amount' and price = 1.
      finalUnits = parseFloat(txForm.units);
      finalPrice = 1;
    }

    if (!finalUnits || !finalPrice) return;
    
    await createTransaction({
      id: Date.now().toString(),
      assetId,
      type: txForm.type,
      units: finalUnits,
      price: finalPrice,
      date: new Date().toISOString(),
    });
    setModalVisible(false);
    setTxForm({ type: 'buy', units: '', price: '' });
    loadTxs();
  };

  const handleAddSIP = async () => {
    if (!sipForm.amount || !sipForm.dateOfMonth || !sipForm.startDate) return;
    await createSIP({
      id: Date.now().toString(),
      assetId,
      amount: parseFloat(sipForm.amount),
      dateOfMonth: parseInt(sipForm.dateOfMonth, 10),
      startDate: new Date(sipForm.startDate).toISOString(),
      status: 'active',
    });
    setSipModalVisible(false);
    setSipForm({ amount: '', dateOfMonth: '1', startDate: new Date().toISOString().split('T')[0] });
    loadTxs(); 
  };

  const handleUpdateAsset = async () => {
    if (!editForm.name || !editForm.type) return;
    const isBank = editForm.type === 'Bank Account';
    const isPhysical = editForm.type === 'Physical Asset';
    const isLiability = editForm.type === 'Liability / Loan';
    const balanceOrPrice = parseFloat(editForm.manualPrice) || 0;

    await editAsset({
      ...asset,
      name: editForm.name,
      type: editForm.type,
      symbol: (isBank || isPhysical || isLiability) ? null : (editForm.symbol.trim() || null),
      totalUnits: isBank ? balanceOrPrice : asset.totalUnits,
      totalInvested: isBank ? balanceOrPrice : asset.totalInvested,
      manualPrice: isBank ? 1 : (balanceOrPrice || null),
      interestRate: (isBank || isLiability) ? (parseFloat(editForm.interestRate) || 0) : null,
      depreciationRate: isPhysical ? (parseFloat(editForm.depreciationRate) || 0) : null
    });
    setEditModalVisible(false);
  };

  if (!asset) return (
    <View style={styles.container}>
      <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginTop: 60 }}>Asset not found</Text>
    </View>
  );

  const currentPrice = livePrices[asset.id] || asset.manualPrice || 0;
  const totalValue = currentPrice * asset.totalUnits;
  const profitLoss = totalValue - asset.totalInvested;
  const isPL = profitLoss >= 0;
  const plColor = isPL ? Colors.success : Colors.danger;
  const plPct = asset.totalInvested > 0
    ? ((profitLoss / asset.totalInvested) * 100).toFixed(2)
    : '0.00';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* Nav Header */}
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={styles.navTitle}>{asset.name}</Text>
            {asset.symbol && <Text style={styles.navSub}>{asset.symbol}</Text>}
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setEditModalVisible(true)} style={{ padding: Spacing.xs }}>
              <Feather name="edit-2" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addTxBtn} onPress={() => setModalVisible(true)}>
              <Feather name="plus" size={16} color={Colors.primary} />
              <Text style={styles.addTxBtnText}>Add Transaction</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroLabel}>CURRENT VALUE</Text>
          <Text style={styles.heroValue}>{formatCurrency(totalValue)}</Text>

          <View style={[styles.plBadge, { backgroundColor: isPL ? Colors.accentLight : 'rgba(255,77,109,0.12)' }]}>
            <Feather name={isPL ? 'trending-up' : 'trending-down'} size={14} color={plColor} />
            <Text style={[styles.plText, { color: plColor }]}>
              {isPL ? '+' : ''}{formatCurrency(profitLoss)} ({isPL ? '+' : ''}{plPct}%)
            </Text>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>{(asset.type === 'Bank Account' || asset.type === 'Liability / Loan') ? 'Interest Rate' : (asset.type === 'Physical Asset' ? 'Depreciation' : 'Invested')}</Text>
              <Text style={styles.metricValue}>{(asset.type === 'Bank Account' || asset.type === 'Liability / Loan') ? `${asset.interestRate || 0}%` : (asset.type === 'Physical Asset' ? `${asset.depreciationRate || 0}%/yr` : formatCurrency(asset.totalInvested))}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>{(asset.type === 'Bank Account' || asset.type === 'Liability / Loan') ? 'Balance' : 'Units'}</Text>
              <Text style={styles.metricValue}>{(asset.type === 'Bank Account' || asset.type === 'Liability / Loan') ? formatCurrency(asset.totalUnits) : asset.totalUnits.toFixed(4)}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Avg. Price</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(asset.totalUnits > 0 ? (asset.totalInvested / asset.totalUnits) : 0)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Curr. Price</Text>
              <Text style={styles.metricValue}>{formatCurrency(currentPrice)}</Text>
            </View>
          </View>
        </View>

        {asset.type !== 'Bank Account' && asset.type !== 'Liability / Loan' && asset.type !== 'Physical Asset' && (
          <View style={[styles.txSection, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm }]}>
            <Text style={styles.txSectionTitle}>Active SIPs</Text>
            <TouchableOpacity onPress={() => setSipModalVisible(true)}>
              <Text style={{ color: Colors.accent, fontSize: Typography.sm, fontWeight: '600' }}>+ New SIP</Text>
            </TouchableOpacity>
          </View>
        )}
        {asset.type !== 'Bank Account' && asset.type !== 'Liability / Loan' && asset.type !== 'Physical Asset' && (
          <View style={{ paddingHorizontal: Spacing.md }}>
            {assetSips.map(sip => (
            <View key={sip.id} style={styles.txRow}>
              <View style={[styles.txIconBox, { backgroundColor: Colors.accentLight }]}>
                <Feather name="repeat" size={16} color={Colors.success} />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txType}>SIP</Text>
                <Text style={styles.txDate}>Day {sip.dateOfMonth} of every month</Text>
              </View>
              <View style={styles.txRight}>
                <Text style={styles.txUnits}>{formatCurrency(sip.amount)} / mo</Text>
                <Text style={styles.txPrice}>Since: {new Date(sip.startDate).toLocaleDateString('en-IN')}</Text>
              </View>
            </View>
          ))}
        </View>
        )}

        {/* Transactions */}
        <View style={[styles.txSection, { marginTop: Spacing.md }]}>
          <Text style={styles.txSectionTitle}>Transactions</Text>
        </View>

        <FlatList
          data={txs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const isBuy = item.type === 'buy';
            return (
              <View style={styles.txRow}>
                <View style={[styles.txIconBox, { backgroundColor: isBuy ? Colors.accentLight : 'rgba(255,77,109,0.1)' }]}>
                  <Feather
                    name={isBuy ? 'arrow-down-left' : (item.type === 'fee' ? 'minus-circle' : 'arrow-up-right')}
                    size={16}
                    color={isBuy ? Colors.success : Colors.danger}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txType}>{item.type.toUpperCase()}</Text>
                  <Text style={styles.txDate}>{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </View>
                <View style={styles.txRight}>
                  {item.type === 'fee' ? (
                    <Text style={[styles.txUnits, { color: Colors.danger }]}>- {formatCurrency(item.units)}</Text>
                  ) : (
                    <>
                      <Text style={styles.txUnits}>{item.units} units</Text>
                      <Text style={styles.txPrice}>@ {formatCurrency(item.price)}</Text>
                    </>
                  )}
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.txList}
          ListEmptyComponent={
            <View style={styles.txEmpty}>
              <Feather name="clock" size={28} color={Colors.textMuted} />
              <Text style={styles.txEmptyText}>No transactions yet</Text>
            </View>
          }
        />
      </SafeAreaView>

      {/* Add Transaction Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Transaction</Text>

            {/* Buy / Sell / Fee Toggle */}
            <View style={styles.toggleRow}>
              {['buy', 'sell', 'fee'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.toggleBtn,
                    txForm.type === type && {
                      backgroundColor: type === 'buy' ? Colors.accentLight : 'rgba(255,77,109,0.15)',
                      borderColor: type === 'buy' ? Colors.accent : Colors.danger,
                    },
                  ]}
                  onPress={() => setTxForm({ ...txForm, type })}
                >
                  <Feather
                    name={type === 'buy' ? 'arrow-down-left' : (type === 'fee' ? 'minus-circle' : 'arrow-up-right')}
                    size={15}
                    color={txForm.type === type ? (type === 'buy' ? Colors.success : Colors.danger) : Colors.textMuted}
                  />
                  <Text style={[
                    styles.toggleText,
                    txForm.type === type && { color: type === 'buy' ? Colors.success : Colors.danger, fontWeight: Typography.bold },
                  ]}>
                    {type.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>{txForm.type === 'fee' ? 'Fee Amount (₹)' : 'Number of Units'}</Text>
            <TextInput
              style={styles.input}
              placeholder={txForm.type === 'fee' ? "e.g. 100" : "0.00"}
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={txForm.units}
              onChangeText={t => setTxForm({ ...txForm, units: t })}
            />

            {txForm.type !== 'fee' && (
              <>
                <Text style={styles.inputLabel}>Price per Unit (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={txForm.price}
                  onChangeText={t => setTxForm({ ...txForm, price: t })}
                />
              </>
            )}

            {txForm.units && txForm.price && txForm.type !== 'fee' && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(parseFloat(txForm.units || 0) * parseFloat(txForm.price || 0))}
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddTx} style={[styles.saveBtn, txForm.type !== 'buy' && styles.saveBtnSell]}>
                <Feather name="check" size={16} color={Colors.primary} />
                <Text style={styles.saveText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add SIP Modal */}
      <Modal visible={sipModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Create SIP</Text>
            
            <Text style={styles.inputLabel}>Monthly Investment Amount (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 5000"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={sipForm.amount}
              onChangeText={t => setSipForm({ ...sipForm, amount: t })}
            />

            <Text style={styles.inputLabel}>Execution Date (1-31)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 5"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              maxLength={2}
              value={sipForm.dateOfMonth}
              onChangeText={t => setSipForm({ ...sipForm, dateOfMonth: t })}
            />
            
            <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2023-01-01"
              placeholderTextColor={Colors.textMuted}
              value={sipForm.startDate}
              onChangeText={t => setSipForm({ ...sipForm, startDate: t })}
            />
            <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: -10, marginBottom: 15 }}>
              * We will automatically fetch past prices and calculate your units from this start date!
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setSipModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddSIP} style={styles.saveBtn}>
                <Feather name="check" size={16} color={Colors.primary} />
                <Text style={styles.saveText}>Create SIP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Asset Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Asset Details</Text>

            <Text style={styles.inputLabel}>Asset Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. HDFC Bank, Bitcoin"
              placeholderTextColor={Colors.textMuted}
              value={editForm.name}
              onChangeText={text => setEditForm({ ...editForm, name: text })}
            />

            <Text style={styles.inputLabel}>Asset Type</Text>
            <View style={[styles.toggleRow, { flexWrap: 'wrap', marginBottom: Spacing.md }]}>
              {['Stocks', 'Mutual Funds', 'Crypto', 'Gold', 'Real Estate', 'Bank Account', 'Physical Asset', 'Liability / Loan', 'Other'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.toggleBtn,
                    { flex: 0, minWidth: '30%', marginBottom: Spacing.sm },
                    editForm.type === type && {
                      backgroundColor: Colors.accentLight,
                      borderColor: Colors.accent,
                    },
                  ]}
                  onPress={() => setEditForm({ ...editForm, type })}
                >
                  <Text style={[
                    styles.toggleText,
                    editForm.type === type && { color: Colors.success, fontWeight: Typography.bold },
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {editForm.type !== 'Bank Account' && editForm.type !== 'Physical Asset' && editForm.type !== 'Liability / Loan' && (
              <>
                <Text style={styles.inputLabel}>Ticker Symbol (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. HDFCBANK.NS, BTC"
                  placeholderTextColor={Colors.textMuted}
                  value={editForm.symbol}
                  onChangeText={text => setEditForm({ ...editForm, symbol: text.toUpperCase() })}
                  autoCapitalize="characters"
                />
              </>
            )}

            <Text style={styles.inputLabel}>
              {(editForm.type === 'Bank Account' || editForm.type === 'Liability / Loan') ? 'Current Balance (₹)' : 'Manual Price'}
              {(editForm.type !== 'Bank Account' && editForm.type !== 'Liability / Loan') && ' (If no symbol)'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={(editForm.type === 'Bank Account' || editForm.type === 'Liability / Loan') ? 'Enter balance in ₹' : 'e.g. 5000'}
              placeholderTextColor={Colors.textMuted}
              value={editForm.manualPrice}
              onChangeText={text => setEditForm({ ...editForm, manualPrice: text })}
              keyboardType="numeric"
            />

            {(editForm.type === 'Bank Account' || editForm.type === 'Liability / Loan') && (
              <>
                <Text style={styles.inputLabel}>Interest Rate (%)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 4.0"
                  placeholderTextColor={Colors.textMuted}
                  value={editForm.interestRate}
                  onChangeText={text => setEditForm({ ...editForm, interestRate: text })}
                  keyboardType="numeric"
                />
              </>
            )}

            {editForm.type === 'Physical Asset' && (
              <>
                <Text style={styles.inputLabel}>Annual Depreciation Rate (%)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 10.0"
                  placeholderTextColor={Colors.textMuted}
                  value={editForm.depreciationRate}
                  onChangeText={text => setEditForm({ ...editForm, depreciationRate: text })}
                  keyboardType="numeric"
                />
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!editForm.name || !editForm.type) && { opacity: 0.5 }]}
                onPress={handleUpdateAsset}
                disabled={!editForm.name || !editForm.type}
              >
                <Text style={styles.saveText}>Save Changes</Text>
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

  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  navSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  addTxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radius.sm,
  },
  addTxBtnText: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.background,
  },

  heroCard: {
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.accent,
    opacity: 0.05,
  },
  heroLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  heroValue: {
    fontSize: 34,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
  },
  plBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    gap: 5,
    marginBottom: Spacing.md,
  },
  plText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  metricItem: {
    width: '45%',
    marginBottom: Spacing.xs,
  },
  metricLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },

  txSection: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  txSectionTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  txList: { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  txIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  txInfo: { flex: 1 },
  txType: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  txDate: { fontSize: Typography.xs, color: Colors.textMuted },
  txRight: { alignItems: 'flex-end' },
  txUnits: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  txPrice: { fontSize: Typography.xs, color: Colors.textMuted },
  txEmpty: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  txEmptyText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
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
    paddingBottom: 44,
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
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceElevated,
  },
  toggleText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    fontWeight: Typography.medium,
  },
  inputLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: 6,
    fontWeight: Typography.medium,
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
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  totalLabel: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  totalValue: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.accent,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
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
  saveBtnSell: {
    backgroundColor: Colors.danger,
  },
  saveText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.background,
  },
});
