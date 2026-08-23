export const CATEGORY_DEFAULT_CAGR = {
  'Stocks': 0.12,
  'Mutual Funds': 0.12,
  'ETFs': 0.10,
  'Crypto': 0.15,
  'Gold': 0.08,
  'Real Estate': 0.08,
  'Other': 0.08
};

export const DEFAULT_CAGR = 0.10;

export const calculateHistoricalCAGR = (assets, transactions, livePrices) => {
  if (!assets || assets.length === 0) return DEFAULT_CAGR;

  let totalInvested = 0;
  let currentValue = 0;
  let earliestDate = new Date();

  // Find the earliest transaction date
  if (transactions && transactions.length > 0) {
    const dates = transactions.map(t => new Date(t.date).getTime());
    earliestDate = new Date(Math.min(...dates));
  } else {
    // If no transactions, just return a weighted default based on asset types
    let totalAssumed = 0;
    assets.forEach(a => {
       const val = (livePrices[a.id] || a.manualPrice || 0) * a.totalUnits;
       const rate = CATEGORY_DEFAULT_CAGR[a.type] || DEFAULT_CAGR;
       totalAssumed += rate * val;
       currentValue += val;
    });
    return currentValue > 0 ? totalAssumed / currentValue : DEFAULT_CAGR;
  }

  const now = new Date();
  const diffTime = Math.abs(now - earliestDate);
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);

  assets.forEach(a => {
    totalInvested += a.totalInvested;
    currentValue += (livePrices[a.id] || a.manualPrice || 0) * a.totalUnits;
  });

  if (totalInvested <= 0 || currentValue <= 0) return DEFAULT_CAGR;

  // If the holding period is very short (less than 6 months), use weighted category default
  if (diffYears < 0.5) {
    let totalAssumed = 0;
    assets.forEach(a => {
       const val = (livePrices[a.id] || a.manualPrice || 0) * a.totalUnits;
       const rate = CATEGORY_DEFAULT_CAGR[a.type] || DEFAULT_CAGR;
       totalAssumed += rate * val;
    });
    return currentValue > 0 ? totalAssumed / currentValue : DEFAULT_CAGR;
  }

  // Calculate CAGR: (FV / PV)^(1/n) - 1
  let cagr = Math.pow(currentValue / totalInvested, 1 / diffYears) - 1;

  // Cap extreme values to avoid absurd charts
  if (cagr > 0.5) cagr = 0.5; // Cap at 50%
  if (cagr < -0.2) cagr = -0.2; // Cap at -20%

  return cagr;
};

export const generateProjectionData = (currentValue, years, cagr, monthlySip = 0) => {
  const dataPoints = [];
  const now = new Date();
  
  let pointsCount = 10;
  let stepYears = years / pointsCount;

  if (years === 1) {
    pointsCount = 12; // 12 months
    stepYears = 1 / 12;
  } else if (years === 3) {
    pointsCount = 12; // 12 quarters
    stepYears = 3 / 12;
  } else if (years === 5) {
    pointsCount = 10; // 10 half-years
    stepYears = 5 / 10;
  } else if (years === 10) {
    pointsCount = 10; // 10 years
    stepYears = 1;
  }

  // Initial point
  dataPoints.push({
    value: currentValue,
    label: now.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    hideDataPoint: true,
  });

  for (let i = 1; i <= pointsCount; i++) {
    const projectedTime = i * stepYears;
    const monthsElapsed = projectedTime * 12;
    
    // Future Value of initial lump sum
    let projectedValue = currentValue * Math.pow(1 + cagr, projectedTime);
    
    // Future Value of monthly SIPs
    if (monthlySip > 0 && cagr !== 0) {
      const monthlyRate = cagr / 12; // Approximation of monthly compounding rate
      // Future value of an annuity formula: P * (((1 + r)^n - 1) / r) * (1 + r)
      const sipFutureValue = monthlySip * ((Math.pow(1 + monthlyRate, monthsElapsed) - 1) / monthlyRate) * (1 + monthlyRate);
      projectedValue += sipFutureValue;
    } else if (monthlySip > 0 && cagr === 0) {
      projectedValue += (monthlySip * monthsElapsed);
    }
    
    const projectedDate = new Date(now);
    projectedDate.setMonth(projectedDate.getMonth() + monthsElapsed);

    dataPoints.push({
      value: projectedValue,
      label: i === pointsCount ? projectedDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '',
      hideDataPoint: i !== pointsCount,
    });
  }

  return dataPoints;
};
