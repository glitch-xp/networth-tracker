import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

// We use async versions of SQLite via openDatabaseAsync
let dbPromise = null;

export const getDB = async () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('networth.db');
  }
  const db = await dbPromise;
  return db;
};

export const initDatabase = async () => {
  const db = await getDB();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      symbol TEXT,
      totalUnits REAL NOT NULL,
      totalInvested REAL NOT NULL,
      manualPrice REAL,
      interestRate REAL,
      depreciationRate REAL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      assetId TEXT NOT NULL,
      type TEXT NOT NULL,
      units REAL NOT NULL,
      price REAL NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sips (
      id TEXT PRIMARY KEY NOT NULL,
      assetId TEXT NOT NULL,
      amount REAL NOT NULL,
      dateOfMonth INTEGER NOT NULL,
      startDate TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      totalValue REAL NOT NULL,
      totalInvested REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_flows (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      dateOfMonth INTEGER NOT NULL
    );
  `);

  // Migration: Add interestRate column if it doesn't exist
  try {
    const tableInfo = await db.getAllAsync("PRAGMA table_info(assets);");
    const hasInterestRate = tableInfo.some(col => col.name === 'interestRate');
    if (!hasInterestRate) {
      await db.execAsync("ALTER TABLE assets ADD COLUMN interestRate REAL;");
    }
    const hasDepreciationRate = tableInfo.some(col => col.name === 'depreciationRate');
    if (!hasDepreciationRate) {
      await db.execAsync("ALTER TABLE assets ADD COLUMN depreciationRate REAL;");
    }
  } catch (e) {
    console.log("Migration error for assets schema:", e);
  }
};

// CRUD for Assets
export const getAssets = async () => {
  const db = await getDB();
  return await db.getAllAsync('SELECT * FROM assets;');
};

export const addAsset = async (asset) => {
  const db = await getDB();
  await db.runAsync(
    'INSERT INTO assets (id, name, type, symbol, totalUnits, totalInvested, manualPrice, interestRate, depreciationRate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
    [asset.id, asset.name, asset.type, asset.symbol || null, asset.totalUnits, asset.totalInvested, asset.manualPrice || null, asset.interestRate || null, asset.depreciationRate || null]
  );
};

export const updateAsset = async (asset) => {
  const db = await getDB();
  await db.runAsync(
    'UPDATE assets SET name = ?, type = ?, symbol = ?, totalUnits = ?, totalInvested = ?, manualPrice = ?, interestRate = ?, depreciationRate = ? WHERE id = ?;',
    [asset.name, asset.type, asset.symbol || null, asset.totalUnits, asset.totalInvested, asset.manualPrice || null, asset.interestRate || null, asset.depreciationRate || null, asset.id]
  );
};

export const deleteAsset = async (id) => {
  const db = await getDB();
  await db.runAsync('DELETE FROM assets WHERE id = ?;', [id]);
};

// CRUD for Transactions
export const getTransactions = async (assetId = null) => {
  const db = await getDB();
  if (assetId) {
    return await db.getAllAsync('SELECT * FROM transactions WHERE assetId = ? ORDER BY date DESC;', [assetId]);
  }
  return await db.getAllAsync('SELECT * FROM transactions ORDER BY date DESC;');
};

export const addTransaction = async (tx) => {
  const db = await getDB();
  await db.runAsync(
    'INSERT INTO transactions (id, assetId, type, units, price, date) VALUES (?, ?, ?, ?, ?, ?);',
    [tx.id, tx.assetId, tx.type, tx.units, tx.price, tx.date]
  );
};

// CRUD for SIPs
export const getSIPs = async (assetId = null) => {
  const db = await getDB();
  if (assetId) {
    return await db.getAllAsync('SELECT * FROM sips WHERE assetId = ?;', [assetId]);
  }
  return await db.getAllAsync('SELECT * FROM sips;');
};

export const addSIP = async (sip) => {
  const db = await getDB();
  await db.runAsync(
    'INSERT INTO sips (id, assetId, amount, dateOfMonth, startDate, status) VALUES (?, ?, ?, ?, ?, ?);',
    [sip.id, sip.assetId, sip.amount, sip.dateOfMonth, sip.startDate, sip.status]
  );
};

export const deleteSIP = async (id) => {
  const db = await getDB();
  await db.runAsync('DELETE FROM sips WHERE id = ?;', [id]);
};

// CRUD for Cash Flows
export const getCashFlows = async () => {
  const db = await getDB();
  return await db.getAllAsync('SELECT * FROM cash_flows ORDER BY type, name;');
};

export const addCashFlow = async (cf) => {
  const db = await getDB();
  await db.runAsync(
    'INSERT INTO cash_flows (id, name, type, amount, dateOfMonth) VALUES (?, ?, ?, ?, ?);',
    [cf.id, cf.name, cf.type, cf.amount, cf.dateOfMonth]
  );
};

export const deleteCashFlow = async (id) => {
  const db = await getDB();
  await db.runAsync('DELETE FROM cash_flows WHERE id = ?;', [id]);
};

// History
export const getHistory = async () => {
  const db = await getDB();
  return await db.getAllAsync('SELECT * FROM history ORDER BY date ASC;');
};

export const addHistory = async (history) => {
  const db = await getDB();
  await db.runAsync(
    'INSERT INTO history (id, date, totalValue, totalInvested) VALUES (?, ?, ?, ?);',
    [history.id, history.date, history.totalValue, history.totalInvested]
  );
};

// Import / Export
export const exportData = async () => {
  const db = await getDB();
  const assets = await getAssets();
  const transactions = await getTransactions();
  const sips = await getSIPs();
  const history = await getHistory();
  const cash_flows = await getCashFlows();

  const data = { assets, transactions, sips, history, cash_flows };
  const json = JSON.stringify(data);
  const dateStr = new Date().toISOString().split('T')[0];
  const fileUri = FileSystem.documentDirectory + `portfolio_backup_${dateStr}.json`;
  
  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
  
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri);
  }
  return fileUri;
};

export const importData = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return false;
    }

    const file = result.assets[0];
    const response = await fetch(file.uri);
    const jsonStr = await response.text();
    const data = JSON.parse(jsonStr);

    const db = await getDB();

    // Begin transaction for safety (simulate with async operations, though expo-sqlite supports transactions via withTransactionAsync)
    await db.withTransactionAsync(async () => {
      // Clear existing data
      await db.runAsync('DELETE FROM transactions;');
      await db.runAsync('DELETE FROM sips;');
      await db.runAsync('DELETE FROM assets;');
      await db.runAsync('DELETE FROM history;');

      // Restore Assets exactly matching original IDs
      if (data.assets) {
        for (const asset of data.assets) {
          await db.runAsync(
            'INSERT INTO assets (id, name, type, symbol, totalUnits, totalInvested, manualPrice, interestRate, depreciationRate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
            [asset.id, asset.name, asset.type, asset.symbol || null, asset.totalUnits, asset.totalInvested, asset.manualPrice || null, asset.interestRate || null, asset.depreciationRate || null]
          );
        }
      }

      // Restore Transactions exactly matching original IDs and assetIds
      if (data.transactions) {
        for (const tx of data.transactions) {
          await db.runAsync(
            'INSERT INTO transactions (id, assetId, type, units, price, date) VALUES (?, ?, ?, ?, ?, ?);',
            [tx.id, tx.assetId, tx.type, tx.units, tx.price, tx.date]
          );
        }
      }

      // Restore SIPs
      if (data.sips) {
        for (const sip of data.sips) {
          await db.runAsync(
            'INSERT INTO sips (id, assetId, amount, dateOfMonth, startDate, status) VALUES (?, ?, ?, ?, ?, ?);',
            [sip.id, sip.assetId, sip.amount, sip.dateOfMonth, sip.startDate, sip.status]
          );
        }
      }

      // Restore History
      if (data.history) {
        for (let i = 0; i < data.history.length; i++) {
          const h = data.history[i];
          const histId = h.id || `hist_${Date.now()}_${i}`;
          await db.runAsync(
            'INSERT INTO history (id, date, totalValue, totalInvested) VALUES (?, ?, ?, ?);',
            [histId, h.date, h.totalValue, h.totalInvested]
          );
        }
      }

      // Restore Cash Flows
      if (data.cash_flows) {
        for (const cf of data.cash_flows) {
          await db.runAsync(
            'INSERT INTO cash_flows (id, name, type, amount, dateOfMonth) VALUES (?, ?, ?, ?, ?);',
            [cf.id, cf.name, cf.type, cf.amount, cf.dateOfMonth]
          );
        }
      }
    });

    return true;
  } catch (e) {
    console.error('Import failed', e);
    return false;
  }
};
