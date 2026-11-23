// Trading quiz question bank. id must stay stable (missed answers are stored by id).
// a = index of the correct option.
export const TOPICS = {
  risk: 'Risk & sizing',
  psych: 'Psychology',
  prop: 'Prop firm rules',
  pa: 'Price action & liquidity',
  options: 'Options',
  india: 'Indian markets',
};

export const QUESTIONS = [
  // ---------- Risk & sizing ----------
  { id: 'r1', t: 'risk', q: 'Your account is $50,000 and you risk 1% per trade. Your stop is 20 points on a contract worth $2 per point. How many contracts can you take?', o: ['5', '12', '25', '50'], a: 1, e: 'Risk = $500. Each contract risks 20 × $2 = $40. $500 ÷ $40 = 12.5, so 12 contracts (always round down).' },
  { id: 'r2', t: 'risk', q: 'You win 40% of trades. Winners average 2R and losers lose 1R. What is your expectancy per trade?', o: ['-0.2R', '0R', '+0.2R', '+0.8R'], a: 2, e: '(0.40 × 2) − (0.60 × 1) = 0.8 − 0.6 = +0.2R per trade. A low win rate can still be profitable.' },
  { id: 'r3', t: 'risk', q: 'After a 50% drawdown, what gain do you need to get back to break-even?', o: ['50%', '75%', '100%', '150%'], a: 2, e: 'Half the account must double: 50 → 100 is a 100% gain. Losses compound against you, which is why small risk matters.' },
  { id: 'r4', t: 'risk', q: 'What does "1R" mean?', o: ['One round-trip trade', 'The amount you risk on the trade (entry to stop)', 'A 1% move in price', 'Your average winning trade'], a: 1, e: 'R is your initial risk. A trade that makes three times what you risked is +3R.' },
  { id: 'r5', t: 'risk', q: 'Which is the biggest risk-management mistake?', o: ['Taking partial profits', 'Moving your stop further away once in a losing trade', 'Using a fixed risk per trade', 'Skipping a trade that doesn’t meet your rules'], a: 1, e: 'Widening a stop turns a planned 1R loss into an unplanned larger one. It is the classic way accounts blow up.' },
  { id: 'r6', t: 'risk', q: 'With a 50% win rate and 1:1 reward-to-risk, after costs you will most likely…', o: ['Make money steadily', 'Slowly lose money', 'Break even exactly', 'Double the account'], a: 1, e: 'Before costs it’s break-even. Commissions, spreads and slippage push it negative. You need an edge in win rate or R:R.' },
  { id: 'r7', t: 'risk', q: 'Why size every trade with the same risk?', o: ['It guarantees profit', 'It keeps one trade from dominating your results and makes your stats meaningful', 'Brokers require it', 'It increases win rate'], a: 1, e: 'Fixed risk means your win rate and R stats actually describe your edge, and no single trade can wreck the account.' },
  { id: 'r8', t: 'risk', q: 'Two correlated trades (e.g. long NQ and long ES) at 1% each are effectively…', o: ['Two independent 1% risks', 'Close to one 2% bet on the same move', 'A hedge', 'Zero risk'], a: 1, e: 'Highly correlated positions tend to win or lose together, so your real exposure roughly adds up.' },

  // ---------- Psychology ----------
  { id: 'p1', t: 'psych', q: 'You just took two losses and feel the urge to "win it back". What is the best action?', o: ['Double size on the next A+ setup', 'Stop, step away, and only return if the plan allows', 'Switch to a faster timeframe', 'Trade the next breakout'], a: 1, e: 'That urge is revenge trading. Most traders’ worst losses come right after a loss streak. Distance first, decisions later.' },
  { id: 'p2', t: 'psych', q: 'A good trade is one that…', o: ['Made money', 'Followed your plan, regardless of the result', 'Hit the exact top or bottom', 'Was taken quickly'], a: 1, e: 'Judge process, not outcome. A rule-following loss is a good trade; a rule-breaking win reinforces bad habits.' },
  { id: 'p3', t: 'psych', q: 'FOMO usually makes you…', o: ['Enter late, chase price, and place poor stops', 'Wait for confirmation', 'Reduce size', 'Skip trades'], a: 0, e: 'Fear of missing out leads to late, extended entries with wide or no stops, which hurts both R and win rate.' },
  { id: 'p4', t: 'psych', q: 'Which habit improves discipline the most over time?', o: ['Watching more YouTube', 'Reviewing every trade against written rules', 'Trading more sessions', 'Following signals'], a: 1, e: 'Written rules plus honest review create a feedback loop. Without review, the same mistakes repeat.' },
  { id: 'p5', t: 'psych', q: 'You hit your daily loss limit. A perfect setup appears. You should…', o: ['Take it with half size', 'Take it, it’s perfect', 'Not trade. The limit exists for exactly this moment', 'Switch to a demo account and come back'], a: 2, e: 'A limit you break when it feels right isn’t a limit. Protecting the rule protects the account.' },
  { id: 'p6', t: 'psych', q: 'Overconfidence after a winning streak most often shows up as…', o: ['Smaller size', 'Bigger size and lower-quality setups', 'More journaling', 'Tighter stops'], a: 1, e: 'Winning streaks tempt you to size up and lower standards, often giving back the gains quickly.' },
  { id: 'p7', t: 'psych', q: 'What is the purpose of a pre-market plan?', o: ['To predict the exact high and low', 'To decide levels, bias and what you will NOT do before emotions are involved', 'To find more trades', 'To impress others'], a: 1, e: 'Decisions made calmly before the open are better than decisions made in the heat of a move.' },

  // ---------- Prop firm rules ----------
  { id: 'f1', t: 'prop', q: 'On a $50K account with a $2,500 trailing drawdown, your balance peaks at $52,000. Where is your fail level (if it trails without a lock)?', o: ['$47,500', '$49,500', '$50,000', '$52,000'], a: 1, e: 'A trailing drawdown follows your highest balance: $52,000 − $2,500 = $49,500. Many firms stop trailing once it reaches the starting balance.' },
  { id: 'f2', t: 'prop', q: 'A "static" max loss on a $100K account with 10% max loss means you fail at…', o: ['$90,000, no matter how high you go', '10% below your highest balance', '$95,000', 'Whenever you lose 10% in a day'], a: 0, e: 'Static means the floor never moves: $100,000 − $10,000 = $90,000.' },
  { id: 'f3', t: 'prop', q: 'What does a 50% consistency rule usually mean?', o: ['You must win 50% of trades', 'No single day can be more than 50% of your total profit', 'You must trade 50% of days', 'You can only use 50% of max size'], a: 1, e: 'It stops one lucky day from passing the evaluation. Spread profits over several days.' },
  { id: 'f4', t: 'prop', q: 'Why is a daily loss limit dangerous even if you’re up for the evaluation?', o: ['It isn’t dangerous', 'Breaching it once usually fails the account immediately', 'It only applies on Mondays', 'It resets your profits'], a: 1, e: 'Most firms fail the account on a single daily-limit breach, regardless of overall profit.' },
  { id: 'f5', t: 'prop', q: 'The best risk per trade for passing an evaluation is usually…', o: ['As large as allowed to pass fast', 'Small enough that a normal losing streak can’t hit max loss', 'Different every trade', 'Zero until the last day'], a: 1, e: 'If 8 losses in a row would breach max loss, you’re sizing too big. Survive first; the target comes with time.' },
  { id: 'f6', t: 'prop', q: 'A minimum trading days rule of 3 means…', o: ['You must pass within 3 days', 'You need at least 3 days with a trade before you can pass', 'You can only trade 3 days a week', 'Profits are paid every 3 days'], a: 1, e: 'Even if you hit the target on day one, you need trades on the minimum number of days.' },

  // ---------- Price action & liquidity ----------
  { id: 'a1', t: 'pa', q: 'A fair value gap (FVG) is…', o: ['Any large candle', 'A three-candle gap where candle 1’s high and candle 3’s low don’t overlap (bullish case)', 'The gap between open and close', 'Spread between bid and ask'], a: 1, e: 'In a bullish FVG, the wicks of candles 1 and 3 leave an imbalance that price often revisits.' },
  { id: 'a2', t: 'pa', q: 'Equal highs on a chart usually represent…', o: ['Strong resistance that never breaks', 'Resting buy-side liquidity (stops above the highs)', 'A trend reversal confirmed', 'Low volume'], a: 1, e: 'Traders place stops above obvious equal highs, which makes them a magnet for price to sweep.' },
  { id: 'a3', t: 'pa', q: 'A liquidity sweep followed by a market structure shift suggests…', o: ['Continuation in the sweep direction', 'Stops were taken and price may reverse', 'Nothing useful', 'Time to add size against the shift'], a: 1, e: 'The sweep grabs liquidity; the shift shows the opposite side taking control.' },
  { id: 'a4', t: 'pa', q: 'In a range, the 50% level (equilibrium) divides…', o: ['Day and night session', 'Premium (above) and discount (below)', 'Support and resistance exactly', 'Bulls and bears volume'], a: 1, e: 'Buying in discount and selling in premium improves your average location within the range.' },
  { id: 'a5', t: 'pa', q: 'A bullish order block is commonly defined as…', o: ['The last down candle before a strong move up', 'The first green candle of the day', 'Any support line', 'A gap up open'], a: 0, e: 'It marks where larger orders likely entered before displacement; price often returns to it.' },
  { id: 'a6', t: 'pa', q: 'A higher-timeframe bias matters because…', o: ['Lower timeframes are always wrong', 'It tells you which direction your lower-timeframe setups have the wind behind them', 'Brokers require it', 'It increases leverage'], a: 1, e: 'Trading with the higher-timeframe draw on liquidity usually gives better follow-through.' },
  { id: 'a7', t: 'pa', q: 'A breakout on low volume is…', o: ['More reliable', 'Less reliable and more likely to fail', 'Exactly as reliable', 'Only valid on Fridays'], a: 1, e: 'Strong breakouts typically come with expanding volume. Weak volume breakouts often trap traders.' },

  // ---------- Options ----------
  { id: 'o1', t: 'options', q: 'Put-Call Ratio (PCR) by open interest is calculated as…', o: ['Call OI ÷ Put OI', 'Put OI ÷ Call OI', 'Put premium ÷ Call premium', 'Put volume − Call volume'], a: 1, e: 'PCR (OI) = total put OI ÷ total call OI. Readings are interpreted relative to that market’s normal range.' },
  { id: 'o2', t: 'options', q: 'What is the maximum loss when buying a call option?', o: ['Unlimited', 'The premium paid', 'The strike price', 'Twice the premium'], a: 1, e: 'An option buyer can lose at most the premium paid (plus costs).' },
  { id: 'o3', t: 'options', q: 'Which risk is unlimited in theory?', o: ['Buying a put', 'Buying a call', 'Selling a naked call', 'Selling a covered call'], a: 2, e: 'A naked short call loses more as price keeps rising, with no cap.' },
  { id: 'o4', t: 'options', q: 'An at-the-money option’s delta is roughly…', o: ['0', '0.25', '0.5', '1'], a: 2, e: 'ATM calls have a delta near 0.5 (puts near −0.5). Deep ITM approaches 1, far OTM approaches 0.' },
  { id: 'o5', t: 'options', q: 'Time decay (theta) for option buyers is fastest…', o: ['Months before expiry', 'In the last days before expiry', 'It’s constant', 'Only on weekends'], a: 1, e: 'Theta accelerates into expiry, especially for at-the-money options.' },
  { id: 'o6', t: 'options', q: '"IV crush" after an event (results, policy) means…', o: ['Implied volatility drops sharply, lowering option premiums', 'The stock crashes', 'Open interest goes to zero', 'Delta becomes 1'], a: 0, e: 'Once uncertainty is gone, IV falls; buyers can lose even if direction was right.' },
  { id: 'o7', t: 'options', q: '"Max pain" is the strike at which…', o: ['Option buyers make the most', 'Total option value held by buyers would be lowest at expiry', 'Volume is highest', 'IV is highest'], a: 1, e: 'It’s where outstanding calls and puts would expire with the least total value. It’s a reference, not a prediction.' },
  { id: 'o8', t: 'options', q: 'Rising price with rising open interest in futures/options usually indicates…', o: ['Short covering', 'Long buildup (new longs entering)', 'Long unwinding', 'No information'], a: 1, e: 'Price ↑ + OI ↑ = long buildup. Price ↑ + OI ↓ = short covering. Price ↓ + OI ↑ = short buildup. Price ↓ + OI ↓ = long unwinding.' },
  { id: 'o9', t: 'options', q: 'Heavy call writing (large call OI addition) at a strike often acts as…', o: ['Support', 'Resistance', 'Nothing', 'A gap'], a: 1, e: 'Writers defend those strikes, so large call OI is often read as resistance; large put OI as support.' },

  // ---------- Indian markets ----------
  { id: 'i1', t: 'india', q: 'Regular trading hours for NSE equities are…', o: ['9:00 – 15:00 IST', '9:15 – 15:30 IST', '10:00 – 16:00 IST', '9:30 – 15:30 IST'], a: 1, e: 'The normal market runs 9:15 to 15:30 IST, with a pre-open session before 9:15.' },
  { id: 'i2', t: 'india', q: 'A stock trading near its 52-week low is…', o: ['Always a buy', 'At an important reference level; it can bounce or break down, so wait for confirmation', 'Always a short', 'About to be delisted'], a: 1, e: '52-week lows are watched levels. Treat them as context, then trade the reaction with a stop.' },
  { id: 'i3', t: 'india', q: 'What is a "bhavcopy"?', o: ['A trading strategy', 'The exchange’s official end-of-day price file for all traded securities', 'A broker app', 'A margin report'], a: 1, e: 'NSE publishes daily bhavcopy files with open, high, low, close and volume for each security.' },
  { id: 'i4', t: 'india', q: 'Upper and lower circuit limits on a stock mean…', o: ['The stock cannot trade beyond a set % band that day', 'The stock is halted forever', 'Brokers set their own limits', 'Only options are affected'], a: 0, e: 'Price bands cap how far a stock can move in a session; at the limit, trading can only happen at that price.' },
  { id: 'i5', t: 'india', q: 'India VIX measures…', o: ['Nifty’s trading volume', 'Expected near-term volatility of Nifty from option prices', 'FII flows', 'Interest rates'], a: 1, e: 'India VIX is derived from Nifty option prices and reflects expected volatility over the next 30 days.' },
];

/** Random sample of n questions (optionally from one topic or a list of ids) */
export function pick({ n = 10, topic, ids } = {}) {
  let pool = QUESTIONS;
  if (topic) pool = pool.filter((q) => q.t === topic);
  if (ids?.length) pool = pool.filter((q) => ids.includes(q.id));
  const a = pool.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
