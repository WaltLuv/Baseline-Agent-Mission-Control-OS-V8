# Demo Mode vs Live Mode

Mission Control never blends demo data with live data.

## Demo mode
- Realistic example data that mirrors how the system behaves in production.
- Safe to explore — no real work is performed, no real money is spent.
- Useful for training new operators and walking customers through the product.
- Clearly labeled in the header. Demo data never leaks into Live mode.

## Live mode
- Real workspace data drawn directly from your runtimes.
- Real telemetry — heartbeats, skill events, approvals, outcomes.
- Real billing — credits draw down with each event.
- Real approvals — your decisions are saved and audit-logged.
- No fake activity. If a panel is empty, it is genuinely empty.

The toggle lives in the header. The badge always tells you which mode you are in.
