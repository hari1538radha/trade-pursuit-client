// Instrument catalogue for the trade log. Each category lists common symbols;
// anything else can still be typed in as a manual entry.
export const ASSET_CATEGORIES = [
  { key: 'Forex', icon: '💱', items: [
    ['EURUSD', 'Euro / US Dollar'], ['GBPUSD', 'British Pound / US Dollar'], ['USDJPY', 'US Dollar / Japanese Yen'], ['AUDUSD', 'Australian Dollar / US Dollar'],
    ['USDCAD', 'US Dollar / Canadian Dollar'], ['USDCHF', 'US Dollar / Swiss Franc'], ['NZDUSD', 'New Zealand Dollar / US Dollar'], ['EURJPY', 'Euro / Japanese Yen'],
    ['GBPJPY', 'British Pound / Japanese Yen'], ['EURGBP', 'Euro / British Pound'], ['AUDJPY', 'Australian Dollar / Japanese Yen'], ['DXY', 'US Dollar Index'],
  ] },
  { key: 'Metals', icon: '🥇', items: [
    ['XAUUSD', 'Gold spot'], ['XAGUSD', 'Silver spot'], ['XPTUSD', 'Platinum spot'], ['XPDUSD', 'Palladium spot'],
    ['GC', 'Gold futures (COMEX)'], ['MGC', 'Micro Gold futures'], ['SI', 'Silver futures'], ['SIL', 'Micro Silver futures'], ['HG', 'Copper futures'],
  ] },
  { key: 'Futures', icon: '📈', items: [
    ['NQ', 'E-mini Nasdaq-100'], ['MNQ', 'Micro E-mini Nasdaq-100'], ['ES', 'E-mini S&P 500'], ['MES', 'Micro E-mini S&P 500'],
    ['YM', 'E-mini Dow'], ['MYM', 'Micro E-mini Dow'], ['RTY', 'E-mini Russell 2000'], ['M2K', 'Micro E-mini Russell 2000'],
    ['CL', 'Crude Oil (WTI)'], ['MCL', 'Micro Crude Oil'], ['GC', 'Gold'], ['MGC', 'Micro Gold'], ['ZB', '30-Year T-Bond'], ['ZN', '10-Year T-Note'],
    ['6E', 'Euro FX'], ['6B', 'British Pound'], ['6J', 'Japanese Yen'],
  ] },
  { key: 'CFD', icon: '📊', items: [
    ['NAS100', 'Nasdaq 100 CFD'], ['US30', 'Dow Jones 30 CFD'], ['SPX500', 'S&P 500 CFD'], ['GER40', 'DAX 40 CFD'], ['UK100', 'FTSE 100 CFD'],
    ['XAUUSD', 'Gold CFD'], ['USOIL', 'WTI Crude CFD'], ['UKOIL', 'Brent Crude CFD'], ['BTCUSD', 'Bitcoin CFD'], ['ETHUSD', 'Ethereum CFD'],
  ] },
  { key: 'Indices', icon: '🏛️', items: [
    ['US100', 'Nasdaq 100'], ['US500', 'S&P 500'], ['US30', 'Dow Jones 30'], ['US2000', 'Russell 2000'], ['GER40', 'DAX 40'], ['UK100', 'FTSE 100'],
    ['FRA40', 'CAC 40'], ['EU50', 'Euro Stoxx 50'], ['JP225', 'Nikkei 225'], ['HK50', 'Hang Seng 50'], ['AUS200', 'ASX 200'], ['VIX', 'Volatility Index'],
  ] },
  { key: 'Oil & Energy', icon: '🛢️', items: [
    ['USOIL', 'WTI Crude spot'], ['UKOIL', 'Brent Crude spot'], ['CL', 'WTI Crude futures'], ['MCL', 'Micro WTI Crude futures'], ['BZ', 'Brent Crude futures'],
    ['NG', 'Natural Gas futures'], ['XNGUSD', 'Natural Gas spot'], ['RB', 'RBOB Gasoline futures'], ['HO', 'Heating Oil futures'],
  ] },
  { key: 'Crypto', icon: '🪙', items: [
    ['BTCUSD', 'Bitcoin'], ['ETHUSD', 'Ethereum'], ['SOLUSD', 'Solana'], ['XRPUSD', 'XRP'], ['BNBUSD', 'BNB'], ['DOGEUSD', 'Dogecoin'], ['MBT', 'Micro Bitcoin futures (CME)'], ['MET', 'Micro Ether futures (CME)'],
  ] },
  { key: 'Stocks', icon: '🏢', items: [
    ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['NVDA', 'NVIDIA'], ['TSLA', 'Tesla'], ['AMZN', 'Amazon'], ['META', 'Meta'], ['GOOGL', 'Alphabet'], ['AMD', 'AMD'], ['SPY', 'SPDR S&P 500 ETF'], ['QQQ', 'Invesco QQQ ETF'],
  ] },
  { key: 'Options', icon: '🎯', items: [
    ['SPY', 'SPY options'], ['QQQ', 'QQQ options'], ['SPX', 'S&P 500 index options'], ['NDX', 'Nasdaq 100 index options'], ['TSLA', 'TSLA options'], ['NVDA', 'NVDA options'],
  ] },
];

export const ASSET_KEYS = ASSET_CATEGORIES.map((c) => c.key);
export const ALL_SYMBOLS = [...new Map(ASSET_CATEGORIES.flatMap((c) => c.items.map(([s, n]) => [s, { symbol: s, name: n, category: c.key }]))).values()];

/** Best-guess category for a symbol, or null for a manual entry. */
export const categoryOf = (symbol = '') => {
  const s = symbol.toUpperCase();
  return ASSET_CATEGORIES.find((c) => c.items.some(([x]) => x === s))?.key || null;
};
