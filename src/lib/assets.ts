export type AssetClass = 'forex' | 'commodity' | 'crypto';

/**
 * How profit in the quote currency converts to the USD account currency.
 *  - `direct`:  quote is USD (or a USD stablecoin) → 1:1
 *  - `inverse`: USD is the base currency (e.g. USD/JPY) → divide by price
 */
export type QuoteConversion = 'direct' | 'inverse';

export interface AssetSpec {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  /** Units of the base asset in 1 lot (100,000 for FX majors, 100 oz for gold, 1 coin for crypto). */
  contractSize: number;
  /** Price increment that counts as one pip (FX) or point (metals/crypto). */
  pipSize: number;
  /** Decimals shown for prices. */
  digits: number;
  conversion: QuoteConversion;
  volumeUnit: 'lots' | 'coins';
  volumeStep: number;
  minVolume: number;
  /** Sensible defaults used when the asset is selected. */
  defaults: {
    price: number;
    rangePct: number;
    grids: number;
    leverage: number;
    spreadPips: number;
    commissionPerLot: number;
    feePct: number;
  };
}

export const ASSETS: AssetSpec[] = [
  {
    id: 'EURUSD', symbol: 'EUR/USD', name: 'Euro / US Dollar', assetClass: 'forex',
    contractSize: 100_000, pipSize: 0.0001, digits: 5, conversion: 'direct',
    volumeUnit: 'lots', volumeStep: 0.01, minVolume: 0.01,
    defaults: { price: 1.085, rangePct: 3, grids: 12, leverage: 100, spreadPips: 0.8, commissionPerLot: 7, feePct: 0 },
  },
  {
    id: 'GBPUSD', symbol: 'GBP/USD', name: 'British Pound / US Dollar', assetClass: 'forex',
    contractSize: 100_000, pipSize: 0.0001, digits: 5, conversion: 'direct',
    volumeUnit: 'lots', volumeStep: 0.01, minVolume: 0.01,
    defaults: { price: 1.27, rangePct: 3, grids: 12, leverage: 100, spreadPips: 1.2, commissionPerLot: 7, feePct: 0 },
  },
  {
    id: 'AUDUSD', symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', assetClass: 'forex',
    contractSize: 100_000, pipSize: 0.0001, digits: 5, conversion: 'direct',
    volumeUnit: 'lots', volumeStep: 0.01, minVolume: 0.01,
    defaults: { price: 0.66, rangePct: 3, grids: 10, leverage: 100, spreadPips: 1, commissionPerLot: 7, feePct: 0 },
  },
  {
    id: 'USDJPY', symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', assetClass: 'forex',
    contractSize: 100_000, pipSize: 0.01, digits: 3, conversion: 'inverse',
    volumeUnit: 'lots', volumeStep: 0.01, minVolume: 0.01,
    defaults: { price: 150, rangePct: 3, grids: 12, leverage: 100, spreadPips: 1, commissionPerLot: 7, feePct: 0 },
  },
  {
    id: 'XAUUSD', symbol: 'XAU/USD', name: 'Gold Spot', assetClass: 'commodity',
    contractSize: 100, pipSize: 0.1, digits: 2, conversion: 'direct',
    volumeUnit: 'lots', volumeStep: 0.01, minVolume: 0.01,
    defaults: { price: 2650, rangePct: 4, grids: 16, leverage: 200, spreadPips: 2.5, commissionPerLot: 7, feePct: 0 },
  },
  {
    id: 'XAGUSD', symbol: 'XAG/USD', name: 'Silver Spot', assetClass: 'commodity',
    contractSize: 5_000, pipSize: 0.001, digits: 3, conversion: 'direct',
    volumeUnit: 'lots', volumeStep: 0.01, minVolume: 0.01,
    defaults: { price: 31, rangePct: 6, grids: 12, leverage: 100, spreadPips: 25, commissionPerLot: 7, feePct: 0 },
  },
  {
    id: 'BTCUSDT', symbol: 'BTC/USDT', name: 'Bitcoin / Tether', assetClass: 'crypto',
    contractSize: 1, pipSize: 0.1, digits: 1, conversion: 'direct',
    volumeUnit: 'coins', volumeStep: 0.00001, minVolume: 0.00001,
    defaults: { price: 68_000, rangePct: 10, grids: 20, leverage: 1, spreadPips: 0, commissionPerLot: 0, feePct: 0.1 },
  },
  {
    id: 'ETHUSDT', symbol: 'ETH/USDT', name: 'Ethereum / Tether', assetClass: 'crypto',
    contractSize: 1, pipSize: 0.01, digits: 2, conversion: 'direct',
    volumeUnit: 'coins', volumeStep: 0.0001, minVolume: 0.0001,
    defaults: { price: 3_400, rangePct: 12, grids: 20, leverage: 1, spreadPips: 0, commissionPerLot: 0, feePct: 0.1 },
  },
  {
    id: 'SOLUSDT', symbol: 'SOL/USDT', name: 'Solana / Tether', assetClass: 'crypto',
    contractSize: 1, pipSize: 0.01, digits: 2, conversion: 'direct',
    volumeUnit: 'coins', volumeStep: 0.001, minVolume: 0.001,
    defaults: { price: 160, rangePct: 15, grids: 20, leverage: 1, spreadPips: 0, commissionPerLot: 0, feePct: 0.1 },
  },
];

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  forex: 'Forex',
  commodity: 'Metals',
  crypto: 'Crypto',
};

export function getAsset(id: string): AssetSpec {
  return ASSETS.find((a) => a.id === id) ?? ASSETS[0];
}
