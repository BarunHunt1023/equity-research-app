import os

# Path to a local .env file in the backend directory for persisting the key
_ENV_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")


def _load_env_file():
    """Load KEY=VALUE pairs from backend/.env into os.environ (if file exists)."""
    if not os.path.isfile(_ENV_FILE):
        return
    with open(_ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_env_file()


def get_anthropic_key() -> str:
    """Return the current Anthropic API key (reads from env at call time)."""
    return os.environ.get("ANTHROPIC_API_KEY", "")


def set_anthropic_key(key: str) -> None:
    """Set the Anthropic API key at runtime and persist it to backend/.env."""
    os.environ["ANTHROPIC_API_KEY"] = key
    # Persist: rewrite the .env file preserving other entries
    lines = []
    if os.path.isfile(_ENV_FILE):
        with open(_ENV_FILE) as f:
            for line in f:
                stripped = line.strip()
                if stripped.startswith("ANTHROPIC_API_KEY"):
                    continue  # will be re-added below
                lines.append(line.rstrip("\n"))
    lines.append(f'ANTHROPIC_API_KEY="{key}"')
    with open(_ENV_FILE, "w") as f:
        f.write("\n".join(lines) + "\n")


# Keep module-level constant for backward compatibility (legacy /report endpoint)
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
