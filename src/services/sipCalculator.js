import { fetchHistoricalPrice } from './yahoo';

export const evaluateSIPs = async (sips, assets, existingTransactions, createTransactionAction) => {
  console.log('[SIP] Evaluating SIPs...', sips.length);
  const now = new Date();
  
  for (const sip of sips) {
    if (sip.status !== 'active') continue;
    
    const asset = assets.find(a => a.id === sip.assetId);
    if (!asset) continue;

    // Find all valid execution dates from startDate to now
    const start = new Date(sip.startDate);
    
    // Iterate month by month
    let currentDate = new Date(start.getFullYear(), start.getMonth(), sip.dateOfMonth);
    
    while (currentDate <= now) {
      if (currentDate >= start) {
        // This is a valid execution date
        const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const txId = `sip_${sip.id}_${dateString}`;
        
        // Check if already executed
        const alreadyExecuted = existingTransactions.some(tx => tx.id === txId);
        
        if (!alreadyExecuted) {
          console.log(`[SIP] Executing SIP ${sip.id} for date ${dateString}`);
          
          let price = null;
          if (asset.symbol) {
            price = await fetchHistoricalPrice(asset.type, asset.symbol, dateString);
          }
          
          if (!price || price <= 0) {
            // Fallback to manual price if historical fetch fails or no symbol
            price = asset.manualPrice;
          }
          
          if (price && price > 0) {
            const units = sip.amount / price;
            // Execute transaction
            const tx = {
              id: txId,
              assetId: sip.assetId,
              type: 'buy',
              units: parseFloat(units.toFixed(6)),
              price: parseFloat(price.toFixed(2)),
              date: currentDate.toISOString(),
            };
            
            await createTransactionAction(tx);
          } else {
            console.warn(`[SIP] Could not execute SIP ${sip.id} on ${dateString} - no price available.`);
          }
        }
      }
      
      // Move to next month
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, sip.dateOfMonth);
    }
  }
};
