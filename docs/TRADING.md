# Trading journal

Zero's trading tab is a manual journal for closed spot and leveraged trades. Nothing is connected to an exchange; every entry is typed in by hand so the record reflects what was actually risked and banked.

## Trades

Each trade records the pair (BTC and ETH by default, custom pairs can be added), direction (long or short) with leverage from 1x to 125x, average entry price (up to eight decimals for crypto prices), trade date, strategy, planned risk : reward multiple (e.g. 2 means risking 1 to make 2), a short reason for taking the trade, and the closed position PnL. PnL uses a minus sign for a loss; win, loss, or breakeven is derived from its sign, never entered separately.

Strategies start with SFP, Trendline, Bullish Divergence, and Bearish Divergence. Strategies and pairs can be added, renamed, or deleted. Deleting a strategy or pair that still has trades is blocked so history stays accurate — edit or delete those trades first. At least one pair is always kept.

## Currency

The journal has its own USD/INR toggle, independent of the account currency, because most trading happens in USD. Opening balances, trades, totals, and reports are entered in the selected currency; switching the toggle converts every displayed amount at the fixed journal rate of 1 USD = 105 INR. Stored numbers are never rewritten, so switching back and forth is lossless. The choice syncs with display preferences like week start.

## Balances and summaries

Each month has an optional opening balance that can be set or edited from the green summary card. The closing balance is always opening plus every trade closed that month. Total PnL and the average planned risk : reward are computed from the same monthly set.

The filter bar narrows the journal by range (month, week, or day) and by pair. Week ranges respect the week-start day stored in display preferences. Counts (total, won, lost), net PnL, and the reports below all follow the active filter, while opening/closing stay monthly so the account view never shifts under the filter.

## Reports

Reports speak in plain sentences first: how many trades, how many won or lost, net PnL, win rate, profit factor (gross wins divided by gross losses), and average plan. When more than one pair or setup is present, the best pair and top setup are named, plus one honest line when losers outnumber winners or when profit comes from a few large winners.

The daily net PnL chart plots profit above and loss below a center line for up to the last 21 active days. Stat tiles show net PnL, win rate, profit factor, and average plan. Pair mix ranks pairs by net PnL with win/loss records, and setup edge ranks strategies by win rate. Reports are for tracking only, not financial advice or live market prices.

## Backup compatibility

JSON export format v8 adds trades, strategy and pair registries, and monthly opening balances. Importing a v7 or older backup leaves an existing journal untouched; importing a v8 file remaps trade IDs and validates strategy/pair references. "Delete all data" explicitly removes trades and all three trading registries. The v4 cloud reader is current; the v3 reader hides all trading records and the v2 reader hides them as well, so a mixed-version save cannot remove records an older build cannot decode.
