import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export const setCacheItem = async (key, value, expirationMs = DEFAULT_CACHE_EXPIRATION_MS) => {
  try {
    const item = {
      value,
      timestamp: Date.now(),
      expirationMs,
    };
    await AsyncStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error('Error setting cache:', error);
  }
};

export const getCacheItem = async (key, forceRefresh = false) => {
  if (forceRefresh) return null;
  
  try {
    const itemStr = await AsyncStorage.getItem(key);
    if (!itemStr) return null;
    
    const item = JSON.parse(itemStr);
    const expirationMs = item.expirationMs || DEFAULT_CACHE_EXPIRATION_MS;
    
    if (Date.now() - item.timestamp > expirationMs) {
      return null; // Expired
    }
    return item.value;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
};

export const clearCacheItem = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};
