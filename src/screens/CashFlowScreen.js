import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { Colors, Typography, Spacing, Radius } from '../theme';

const formatCurrency = (value) => {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function CashFlowScreen() {
  const navigation = useNavigation();
  const cashFlows = useStore(state => state.cashFlows);
  const createCashFlow = useStore(state => state.createCashFlow);
  const removeCashFlow = useStore(state => state.removeCashFlow);

  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'INCOME', amount: '', dateOfMonth: '1' });

  const handleAdd = async () => {
    if (!form.name || !form.amount || !form.dateOfMonth) return;
    await createCashFlow({
      id: Date.now().toString(),
      name: form.name,
      type: form.type,
      amount: parseFloat(form.amount),
      dateOfMonth: parseInt(form.dateOfMonth, 10)
    });
    setModalVisible(false);
    setForm({ name: '', type: 'INCOME', amount: '', dateOfMonth: '1' });
  };

  const handleDelete = (id) => {
    removeCashFlow(id);
  };

  const totalIncome = cashFlows.filter(c => c.type === 'INCOME').reduce((s, c) => s + c.amount, 0);
  const totalExpense = cashFlows.filter(c => c.type === 'EXPENSE').reduce((s, c) => s + c.amount, 0);
  const netSavings = totalIncome - totalExpense;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={styles.navTitle}>Cash Flow</Text>
            <Text style={styles.navSub}>Monthly Income & Expenses</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Feather name="plus" size={16} color={Colors.primary} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>{formatCurrency(totalIncome)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: Colors.danger }]}>{formatCurrency(totalExpense)}</Text>
          </View>
          <View style={[styles.summaryItem, { borderLeftWidth: 1, borderLeftColor: Colors.surfaceBorder, paddingLeft: Spacing.md }]}>
            <Text style={styles.summaryLabel}>Savings</Text>
            <Text style={[styles.summaryValue, { color: netSavings >= 0 ? Colors.accent : Colors.danger }]}>{formatCurrency(netSavings)}</Text>
          </View>
        </View>

        <FlatList
          data={cashFlows}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="calendar" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No cash flows added yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: item.type === 'INCOME' ? 'rgba(0,200,120,0.1)' : 'rgba(255,77,109,0.1)' }]}>
                <Feather name={item.type === 'INCOME' ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={item.type === 'INCOME' ? Colors.success : Colors.danger} />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.date}>Day {item.dateOfMonth} of every month</Text>
              </View>
              <View style={styles.right}>
                <Text style={[styles.amount, { color: item.type === 'INCOME' ? Colors.success : Colors.danger }]}>
                  {item.type === 'INCOME' ? '+' : '-'}{formatCurrency(item.amount)}
                </Text>
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                <Feather name="trash-2" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        />
      </SafeAreaView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Cash Flow</Text>

            <View style={styles.toggleRow}>
              {['INCOME', 'EXPENSE'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.toggleBtn,
                    form.type === type && {
                      backgroundColor: type === 'INCOME' ? Colors.accentLight : 'rgba(255,77,109,0.15)',
                      borderColor: type === 'INCOME' ? Colors.accent : Colors.danger,
                    },
                  ]}
                  onPress={() => setForm({ ...form, type })}
                >
                  <Text style={[
                    styles.toggleText,
                    form.type === type && { color: type === 'INCOME' ? Colors.success : Colors.danger, fontWeight: Typography.bold },
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder={form.type === 'INCOME' ? "e.g. Salary" : "e.g. Rent"}
              placeholderTextColor={Colors.textMuted}
              value={form.name}
              onChangeText={t => setForm({ ...form, name: t })}
            />

            <Text style={styles.inputLabel}>Monthly Amount (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={form.amount}
              onChangeText={t => setForm({ ...form, amount: t })}
            />

            <Text style={styles.inputLabel}>Day of Month (1-31)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              maxLength={2}
              value={form.dateOfMonth}
              onChangeText={t => setForm({ ...form, dateOfMonth: t })}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAdd} style={[styles.saveBtn, form.type === 'EXPENSE' && styles.saveBtnExpense]}>
                <Feather name="check" size={16} color={Colors.primary} />
                <Text style={styles.saveText}>Save</Text>
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
    width: 40, height: 40, borderRadius: Radius.sm,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  navTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  navSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accent, paddingHorizontal: Spacing.md,
    paddingVertical: 9, borderRadius: Radius.sm,
  },
  addBtnText: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.background },
  
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  summaryItem: { flex: 1 },
  summaryLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  
  list: { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  iconBox: {
    width: 38, height: 38, borderRadius: Radius.sm,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  info: { flex: 1 },
  name: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: 2 },
  date: { fontSize: Typography.xs, color: Colors.textMuted },
  right: { alignItems: 'flex-end', marginRight: Spacing.sm },
  amount: { fontSize: Typography.sm, fontWeight: Typography.bold },
  deleteBtn: { padding: 4 },
  
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: Colors.textMuted, marginTop: Spacing.md },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, paddingBottom: 44, borderTopWidth: 1, borderColor: Colors.surfaceBorder,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.surfaceBorder, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  toggleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  toggleBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, borderRadius: Radius.sm, borderWidth: 1,
    borderColor: Colors.surfaceBorder, backgroundColor: Colors.surfaceElevated,
  },
  toggleText: { fontSize: Typography.sm, color: Colors.textMuted, fontWeight: Typography.medium },
  inputLabel: { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: 6, fontWeight: Typography.medium },
  input: {
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: Typography.base, marginBottom: Spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.surfaceBorder, alignItems: 'center' },
  cancelText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: Typography.medium },
  saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, paddingVertical: 14, borderRadius: Radius.sm },
  saveBtnExpense: { backgroundColor: Colors.danger },
  saveText: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.background },
});
