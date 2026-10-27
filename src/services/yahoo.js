// Yahoo Finance API Service
import { CATEGORY_DEFAULT_CAGR, DEFAULT_CAGR } from '../utils/projections';

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

const fetchYahooData = async (symbol) => {
  try {
    const url = BASE_URL + '/' + encodeURIComponent(symbol) + '?interval=1d&range=1d';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
    });
    if (!response.ok) throw new Error('Failed to fetch: ' + response.status);
    const data = await response.json();
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('Symbol not found: ' + symbol);
    }
    const result = data.chart.result[0];
    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const currency = meta.currency;
    if (!price || price <= 0) throw new Error('Invalid price for: ' + symbol);
    return { price, currency, symbol };
  } catch (error) {
    console.warn('[Yahoo] fetchYahooData failed for ' + symbol + ':', error.message);
    return null;
  }
};

const fetchHistoricalYahooData = async (symbol, period1, period2) => {
  try {
    const url = BASE_URL + '/' + encodeURIComponent(symbol) + `?interval=1d&period1=${period1}&period2=${period2}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
    });
    if (!response.ok) throw new Error('Failed to fetch historical: ' + response.status);
    const data = await response.json();
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('Symbol not found historically: ' + symbol);
    }
    const result = data.chart.result[0];
    const meta = result.meta;
    
    // We want the closing price of the first trading day in the requested range
    if (!result.indicators || !result.indicators.quote || !result.indicators.quote[0].close) {
      throw new Error('No historical data found');
    }
    
    const closePrices = result.indicators.quote[0].close;
    const adjClosePrices = result.indicators.adjclose ? result.indicators.adjclose[0].adjclose : null;
    let price = null;
    for (let i = 0; i < closePrices.length; i++) {
      const p = (adjClosePrices && adjClosePrices[i]) ? adjClosePrices[i] : closePrices[i];
      if (p !== null && p > 0) {
        price = p;
        break;
      }
    }
    
    const currency = meta.currency;
    if (!price || price <= 0) throw new Error('Invalid historical price for: ' + symbol);
    return { price, currency, symbol };
  } catch (error) {
    // Only warn for unexpected errors, 400/404 are normal for young assets or bad symbols
    if (!error.message.includes('400') && !error.message.includes('404') && !error.message.includes('Symbol not found')) {
      console.warn('[Yahoo] fetchHistoricalYahooData failed for ' + symbol + ':', error.message);
    }
    return null;
  }
};

const getConversionRate = async (fromCurrency, toCurrency) => {
  if (!toCurrency) toCurrency = 'INR';
  if (fromCurrency === toCurrency) return 1;
  const pair = fromCurrency + toCurrency + '=X';
  const data = await fetchYahooData(pair);
  if (data && data.price) {
    return data.price;
  }
  // Hardcoded fallback rates (approximate) so values are not zero
  const fallbackRates = {
    'USDINR': 84,
    'GBPINR': 107,
    'EURINR': 93,
  };
  const key = fromCurrency + toCurrency;
  return fallbackRates[key] || 1;
};

export const fetchLivePrice = async (assetType, baseSymbol) => {
  let symbol = baseSymbol;
  let priceInfo = null;
  let isGoldOunce = false;
  let isSilverOunce = false;

  if (!symbol) return null;

  const type = assetType.toLowerCase();
  const sym = symbol.toUpperCase().trim();

  // Gold commodity: only when user enters GOLD as symbol under Gold type
  if (type === 'gold' && (sym === 'GOLD' || sym === 'GC=F')) {
    symbol = 'GC=F';
    isGoldOunce = true;
  } else if (type === 'silver' && (sym === 'SILVER' || sym === 'SI=F')) {
    symbol = 'SI=F';
    isSilverOunce = true;
  }

  // Attempt 1: Direct symbol
  priceInfo = await fetchYahooData(symbol);

  // Attempt 2: Fallbacks based on asset type
  if (!priceInfo) {
    if (type === 'crypto') {
      // Try appending -USD for crypto
      if (!symbol.includes('-')) {
        priceInfo = await fetchYahooData(symbol + '-USD');
      }
      // Try appending -INR for Indian crypto exchanges
      if (!priceInfo && !symbol.includes('-')) {
        priceInfo = await fetchYahooData(symbol + '-INR');
      }
    } else if (type === 'stocks' || type === 'mutual funds' || type === 'etfs') {
      if (!symbol.includes('.')) {
        // Try NSE first
        priceInfo = await fetchYahooData(symbol + '.NS');
        // Try BSE if NSE fails
        if (!priceInfo) {
          priceInfo = await fetchYahooData(symbol + '.BO');
        }
      }
    }
  }

  if (!priceInfo) {
    console.warn('[Yahoo] Could not fetch price for: ' + baseSymbol + ' (type: ' + assetType + ')');
    return null;
  }

  let finalPrice = priceInfo.price;
  const currentCurrency = priceInfo.currency;

  // Conversion for Gold from Troy Ounces to Grams
  // 1 Troy Ounce = 31.1034768 grams
  // Indian gold typically has ~10-15% premium over international price
  if (isGoldOunce) {
    finalPrice = finalPrice / 31.1034768;
    // ~12% premium for Indian gold (import duty + GST + making charges approximation)
    finalPrice = finalPrice * 1.12;
  }

  // Conversion for Silver from Troy Ounces to Grams
  if (isSilverOunce) {
    finalPrice = finalPrice / 31.1034768;
    finalPrice = finalPrice * 1.12;
  }

  // Currency conversion to INR
  if (currentCurrency && currentCurrency !== 'INR') {
    const rate = await getConversionRate(currentCurrency, 'INR');
    finalPrice = finalPrice * rate;
  }

  // Round to 2 decimal places
  finalPrice = Math.round(finalPrice * 100) / 100;

  return finalPrice;
};

export const fetchHistoricalPrice = async (assetType, baseSymbol, dateString) => {
  let symbol = baseSymbol;
  let priceInfo = null;
  let isGoldOunce = false;
  let isSilverOunce = false;

  if (!symbol) return null;

  const type = assetType.toLowerCase();
  const sym = symbol.toUpperCase().trim();

  if (type === 'gold' && (sym === 'GOLD' || sym === 'GC=F')) {
    symbol = 'GC=F';
    isGoldOunce = true;
  } else if (type === 'silver' && (sym === 'SILVER' || sym === 'SI=F')) {
    symbol = 'SI=F';
    isSilverOunce = true;
  }

  // Calculate period1 (target date) and period2 (target date + 5 days for weekends/holidays)
  const targetDate = new Date(dateString);
  const period1 = Math.floor(targetDate.getTime() / 1000);
  const period2 = period1 + (5 * 24 * 60 * 60);

  // Attempt 1: Direct symbol
  priceInfo = await fetchHistoricalYahooData(symbol, period1, period2);

  // Attempt 2: Fallbacks based on asset type
  if (!priceInfo) {
    if (type === 'crypto') {
      if (!symbol.includes('-')) {
        priceInfo = await fetchHistoricalYahooData(symbol + '-USD', period1, period2);
      }
      if (!priceInfo && !symbol.includes('-')) {
        priceInfo = await fetchHistoricalYahooData(symbol + '-INR', period1, period2);
      }
    } else if (type === 'stocks' || type === 'mutual funds' || type === 'etfs') {
      if (!symbol.includes('.')) {
        priceInfo = await fetchHistoricalYahooData(symbol + '.NS', period1, period2);
        if (!priceInfo) {
          priceInfo = await fetchHistoricalYahooData(symbol + '.BO', period1, period2);
        }
      }
    }
  }

  if (!priceInfo) {
    // Quietly fail for historical prices since many assets don't have 10-year histories
    return null;
  }

  let finalPrice = priceInfo.price;
  const currentCurrency = priceInfo.currency;

  if (isGoldOunce) {
    finalPrice = finalPrice / 31.1034768;
    finalPrice = finalPrice * 1.12;
  }

  if (isSilverOunce) {
    finalPrice = finalPrice / 31.1034768;
    finalPrice = finalPrice * 1.12;
  }

  if (currentCurrency && currentCurrency !== 'INR') {
    // Note: Using current conversion rate for historical prices as an approximation
    const rate = await getConversionRate(currentCurrency, 'INR');
    finalPrice = finalPrice * rate;
  }

  finalPrice = Math.round(finalPrice * 100) / 100;
  return finalPrice;
};

export const fetchAssetHistoricalCAGRs = async (assetType, baseSymbol, currentPrice) => {
  const fallbackCagr = CATEGORY_DEFAULT_CAGR[assetType] || DEFAULT_CAGR;
  const result = { "1": fallbackCagr, "3": fallbackCagr, "5": fallbackCagr, "10": fallbackCagr };
  
  if (!baseSymbol || !currentPrice || currentPrice <= 0) return result;

  const yearsToFetch = [1, 3, 5, 10];
  const now = new Date();

  const promises = yearsToFetch.map(async (years) => {
    const targetDate = new Date(now);
    targetDate.setFullYear(now.getFullYear() - years);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    const histPrice = await fetchHistoricalPrice(assetType, baseSymbol, dateStr);
    
    if (histPrice && histPrice > 0) {
      let cagr = Math.pow(currentPrice / histPrice, 1 / years) - 1;
      // Cap extreme values
      if (cagr > 1.0) cagr = 1.0; 
      if (cagr < -0.99) cagr = -0.99;
      return { years, cagr };
    }
    return { years, cagr: fallbackCagr };
  });

  const results = await Promise.allSettled(promises);
  results.forEach(res => {
    if (res.status === 'fulfilled') {
      result[res.value.years] = res.value.cagr;
    }
  });

  return result;
};
