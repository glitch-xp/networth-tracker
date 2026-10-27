import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { generateProjectionData } from '../utils/projections';

const { width } = Dimensions.get('window');

const formatCurrency = (value) => {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export default function ProjectionChart({ currentValue, cagr, monthlySip = 0 }) {
  const [years, setYears] = useState(3); // Default to 3 years

  const currentCagr = useMemo(() => {
    if (typeof cagr === 'object' && cagr !== null) {
      // Find the closest year or exact match in the object
      return cagr[years] || cagr["3"] || 0.10;
    }
    return cagr || 0;
  }, [cagr, years]);

  const data = useMemo(() => {
    return generateProjectionData(currentValue, years, currentCagr, monthlySip);
  }, [currentValue, years, currentCagr, monthlySip]);

  const finalValue = data[data.length - 1]?.value || currentValue;
  const growth = finalValue - currentValue;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Projected Value ({years}Y)</Text>
          <Text style={styles.value}>{formatCurrency(finalValue)}</Text>
        </View>
        <View style={styles.growthBadge}>
          <Text style={styles.growthText}>+{formatCurrency(growth)}</Text>
          <Text style={styles.cagrText}>{(currentCagr * 100).toFixed(1)}% Nominal CAGR</Text>
        </View>
      </View>

      <View style={styles.chartContainer}>
        <LineChart
          data={data}
          width={width - Spacing.md * 4 - 32} // Account for padding
          height={160}
          thickness={3}
          color={Colors.accent}
          hideDataPoints
          hideRules
          hideYAxisText
          hideAxesAndRules
          showVerticalLines={false}
          curved
          isAnimated
          animateOnDataChange
          animationDuration={600}
          initialSpacing={0}
          endSpacing={0}
          areaChart
          startFillColor={Colors.accent}
          startOpacity={0.3}
          endFillColor={Colors.surface}
          endOpacity={0.0}
        />
      </View>

      <View style={styles.toggles}>
        {[1, 3, 5, 10].map(y => (
          <TouchableOpacity
            key={y}
            style={[styles.toggleBtn, years === y && styles.toggleBtnActive]}
            onPress={() => setYears(y)}
          >
            <Text style={[styles.toggleText, years === y && styles.toggleTextActive]}>{y}Y</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  growthBadge: {
    alignItems: 'flex-end',
  },
  growthText: {
    fontSize: Typography.sm,
    fontWeight: '600',
    color: Colors.success,
  },
  cagrText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  toggles: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  toggleBtnActive: {
    backgroundColor: '#333333', // Slightly lighter than surfaceElevated to show it's pressed
  },
  toggleText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.textPrimary,
  },
});
