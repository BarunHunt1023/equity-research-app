import os


ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Default assumptions
DEFAULT_RISK_FREE_RATE = 0.043  # ~4.3% 10Y Treasury
DEFAULT_EQUITY_RISK_PREMIUM = 0.055  # 5.5%
DEFAULT_TERMINAL_GROWTH_RATE = 0.025  # 2.5%
DEFAULT_TAX_RATE = 0.21  # 21% US corporate
DEFAULT_EXIT_MULTIPLE = 12.0  # EV/EBITDA exit multiple
FORECAST_YEARS = 3
