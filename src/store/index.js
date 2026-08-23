import { create } from 'zustand';
import { getAssets, getTransactions, getHistory, getSIPs, getCashFlows, addAsset, updateAsset, deleteAsset, addTransaction, addSIP, addCashFlow, deleteCashFlow } from '../database/schema';
import { fetchLivePrice, fetchAssetHistoricalCAGRs } from '../services/yahoo';
import { evaluateSIPs } from '../services/sipCalculator';
import { getCacheItem, setCacheItem } from '../utils/cache';
import { CATEGORY_DEFAULT_CAGR, DEFAULT_CAGR } from '../utils/projections';

export const useStore = create((set, get) => ({
  assets: [],
  transactions: [],
  sips: [],
  history: [],
  cashFlows: [],
  livePrices: {}, // { assetId: price }
  isLoading: true,
  settings: {
    geminiApiKey: '',
    hideValues: false,
    aiExecutiveSummaryEnabled: false,
    geminiModel: 'gemini-1.5-flash',
  },
  executiveSummary: '',
  aiExpectedCAGR: { "1": 0, "3": 0, "5": 0, "10": 0 },
  portfolioCAGR: { "1": 0, "3": 0, "5": 0, "10": 0 },
  isFetchingSummary: false,

  setSetting: (key, value) => set((state) => ({
    settings: { ...state.settings, [key]: value }
  })),

  setExecutiveSummary: (summary) => set({ executiveSummary: summary }),
  setAiExpectedCAGR: (cagr) => set({ aiExpectedCAGR: cagr }),
  setIsFetchingSummary: (isFetching) => set({ isFetchingSummary: isFetching }),

  loadData: async (forceRefresh = false) => {
    set({ isLoading: true });
    try {
      const assets = await getAssets();
      const transactions = await getTransactions();
      const sips = await getSIPs();
      const history = await getHistory();
      const cashFlows = await getCashFlows();
      set({ assets, transactions, sips, history, cashFlows, isLoading: false });
      // Fetch live prices async
      get().refreshLivePrices(forceRefresh);
      
      // Evaluate SIPs in background
      get().runSIPEvaluation();
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  refreshLivePrices: async (forceRefresh = false) => {
    const { assets } = get();
    const pricePromises = assets.map(async (asset) => {
      if (asset.type === 'Physical Asset' && asset.depreciationRate) {
        const txs = get().transactions.filter(t => t.assetId === asset.id).sort((a, b) => new Date(a.date) - new Date(b.date));
        if (txs.length > 0) {
          const years = (new Date() - new Date(txs[0].date)) / (1000 * 60 * 60 * 24 * 365.25);
          const originalPrice = asset.manualPrice || (asset.totalUnits > 0 ? (asset.totalInvested / asset.totalUnits) : 0);
          const depreciatedPrice = originalPrice * Math.pow(1 - (asset.depreciationRate / 100), Math.max(0, years));
          return { id: asset.id, price: depreciatedPrice };
        }
      }

      if (!asset.symbol) {
        if (asset.manualPrice && asset.manualPrice > 0) {
          return { id: asset.id, price: asset.manualPrice };
        }
        return null;
      }
      try {
        const cacheKey = `live_price_${asset.symbol}`;
        const cachedPrice = await getCacheItem(cacheKey, forceRefresh);
        if (cachedPrice !== null) {
          return { id: asset.id, price: cachedPrice };
        }

        const price = await fetchLivePrice(asset.type, asset.symbol);
        if (price && price > 0) {
          await setCacheItem(cacheKey, price);
          return { id: asset.id, price };
        }
        // If live price fails, use manualPrice as fallback
        if (asset.manualPrice && asset.manualPrice > 0) {
          return { id: asset.id, price: asset.manualPrice };
        }
        return null;
      } catch (e) {
        console.warn('[Store] Price fetch failed for ' + asset.symbol + ':', e.message);
        if (asset.manualPrice && asset.manualPrice > 0) {
          return { id: asset.id, price: asset.manualPrice };
        }
        return null;
      }
    });

    const results = await Promise.allSettled(pricePromises);
    const newPrices = {};
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        newPrices[result.value.id] = result.value.price;
      }
    });

    // Merge new prices to compute correct weights for CAGR
    const mergedPrices = { ...get().livePrices, ...newPrices };
    if (Object.keys(newPrices).length > 0) {
      set({ livePrices: mergedPrices });
    }

    // Now fetch historical CAGRs for each asset
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const cagrPromises = assets.map(async (asset) => {
      const fallbackRate = CATEGORY_DEFAULT_CAGR[asset.type] || DEFAULT_CAGR;
      const defaultCagrObj = { "1": fallbackRate, "3": fallbackRate, "5": fallbackRate, "10": fallbackRate };

      if (!asset.symbol) return { id: asset.id, cagrObj: defaultCagrObj };

      try {
        const cacheKey = `historical_cagr_${asset.symbol}`;
        const cachedCagr = await getCacheItem(cacheKey, forceRefresh);
        if (cachedCagr !== null) {
          return { id: asset.id, cagrObj: cachedCagr };
        }

        const currentPrice = mergedPrices[asset.id] || asset.manualPrice || 0;
        const cagrObj = await fetchAssetHistoricalCAGRs(asset.type, asset.symbol, currentPrice);
        if (cagrObj) {
          await setCacheItem(cacheKey, cagrObj, THIRTY_DAYS_MS);
          return { id: asset.id, cagrObj };
        }
        return { id: asset.id, cagrObj: defaultCagrObj };
      } catch (e) {
        return { id: asset.id, cagrObj: defaultCagrObj };
      }
    });

    const cagrResults = await Promise.allSettled(cagrPromises);
    let weightedCagr = { "1": 0, "3": 0, "5": 0, "10": 0 };
    
    // Calculate monthly SIP per asset
    const sips = get().sips;
    const activeSips = sips ? sips.filter(s => s.status === 'ACTIVE') : [];
    const assetSips = {};
    activeSips.forEach(sip => {
      assetSips[sip.assetId] = (assetSips[sip.assetId] || 0) + sip.amount;
    });

    const horizons = [1, 3, 5, 10];
    
    horizons.forEach(years => {
      let totalProjectedPrincipal = 0;
      
      // Calculate total portfolio projected principal for this horizon
      assets.forEach(asset => {
        const currentVal = (mergedPrices[asset.id] || asset.manualPrice || 0) * asset.totalUnits;
        const monthlySip = assetSips[asset.id] || 0;
        const projectedPrincipal = currentVal + (monthlySip * 12 * years);
        totalProjectedPrincipal += projectedPrincipal;
      });

      if (totalProjectedPrincipal > 0) {
        cagrResults.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value) {
            const asset = assets[idx];
            const currentVal = (mergedPrices[asset.id] || asset.manualPrice || 0) * asset.totalUnits;
            const monthlySip = assetSips[asset.id] || 0;
            const projectedPrincipal = currentVal + (monthlySip * 12 * years);
            
            const weight = projectedPrincipal / totalProjectedPrincipal;
            const cagrObj = result.value.cagrObj;
            
            weightedCagr[years.toString()] += (cagrObj[years.toString()] * weight);
          }
        });
      }
    });

    set({ portfolioCAGR: weightedCagr });
  },

  runSIPEvaluation: async () => {
    const { sips, assets, transactions, createTransaction } = get();
    if (sips && sips.length > 0) {
      await evaluateSIPs(sips, assets, transactions, createTransaction);
    }
  },

  createAsset: async (asset) => {
    await addAsset(asset);
    await get().loadData();
  },

  editAsset: async (asset) => {
    await updateAsset(asset);
    await get().loadData();
  },

  removeAsset: async (id) => {
    await deleteAsset(id);
    await get().loadData();
  },

  createTransaction: async (tx) => {
    await addTransaction(tx);
    // Update asset totalUnits and totalInvested
    const asset = get().assets.find(a => a.id === tx.assetId);
    if (asset) {
      const isBuy = tx.type.toLowerCase() === 'buy';
      const updatedAsset = {
        ...asset,
        totalUnits: asset.totalUnits + (isBuy ? tx.units : -tx.units),
        totalInvested: asset.totalInvested + (isBuy ? tx.price * tx.units : -(tx.price * tx.units))
      };
      await updateAsset(updatedAsset);
    }
    await get().loadData();
  },

  createSIP: async (sip) => {
    await addSIP(sip);
    await get().loadData();
  },

  createCashFlow: async (cf) => {
    await addCashFlow(cf);
    await get().loadData();
  },

  removeCashFlow: async (id) => {
    await deleteCashFlow(id);
    await get().loadData();
  },

  // Selectors/Computed
  getPortfolioSummary: () => {
    const { assets, livePrices } = get();
    let totalInvested = 0;
    let totalValue = 0;
    let bestPerformer = null;
    let maxReturn = -Infinity;
    const allocation = {};
    let totalDebt = 0;

    assets.forEach(asset => {
      const isLiability = asset.type === 'Liability / Loan';
      const currentPrice = livePrices[asset.id] || asset.manualPrice || 0;
      let currentValue = currentPrice * asset.totalUnits;
      
      if (isLiability) {
        totalDebt += currentValue;
        totalValue -= currentValue;
        // Don't add liability to totalInvested in the normal sense, but we can subtract it if we want net invested.
        totalInvested -= asset.totalInvested;
      } else {
        totalValue += currentValue;
        totalInvested += asset.totalInvested;
      }

      if (!allocation[asset.type]) allocation[asset.type] = 0;
      // For allocation, we can keep Liability negative or just store it for separate display
      allocation[asset.type] += (isLiability ? -currentValue : currentValue);

      const returnPct = asset.totalInvested > 0 
        ? ((currentValue - asset.totalInvested) / asset.totalInvested) * 100 
        : 0;
      
      if (!isLiability && returnPct > maxReturn && currentValue > 0) {
        maxReturn = returnPct;
        bestPerformer = { ...asset, returnPct };
      }
    });

    const totalProfitLoss = totalValue - totalInvested;
    const totalProfitLossPct = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalValue,
      totalProfitLoss,
      totalProfitLossPct,
      bestPerformer,
      allocation,
      totalDebt
    };
  }
}));
