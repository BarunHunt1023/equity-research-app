"""
Market data routes: live quote and Nifty 500 screener.
"""
import asyncio
from fastapi import APIRouter, HTTPException, Query
from app.services.yahoo_finance import get_company_info, get_historical_prices
import yfinance as yf

router = APIRouter()

# ── Nifty 500 tickers (Yahoo Finance format: SYMBOL.NS) ─────────────────────
NIFTY_500 = [
    "RELIANCE.NS","TCS.NS","HDFCBANK.NS","BHARTIARTL.NS","ICICIBANK.NS",
    "INFOSYS.NS","SBIN.NS","LICI.NS","HINDUNILVR.NS","ITC.NS",
    "LT.NS","KOTAKBANK.NS","BAJFINANCE.NS","AXISBANK.NS","MARUTI.NS",
    "ASIANPAINT.NS","TITAN.NS","SUNPHARMA.NS","WIPRO.NS","ONGC.NS",
    "ADANIENT.NS","ADANIPORTS.NS","NTPC.NS","POWERGRID.NS","COALINDIA.NS",
    "HCLTECH.NS","M&M.NS","BAJAJFINSV.NS","ULTRACEMCO.NS","JSWSTEEL.NS",
    "TATAMOTORS.NS","NESTLEIND.NS","TECHM.NS","GRASIM.NS","DRREDDY.NS",
    "CIPLA.NS","BRITANNIA.NS","DIVISLAB.NS","EICHERMOT.NS","BPCL.NS",
    "TATACONSUM.NS","APOLLOHOSP.NS","SHREECEM.NS","HEROMOTOCO.NS","HINDALCO.NS",
    "TATASTEEL.NS","INDUSINDBK.NS","SBILIFE.NS","HDFCLIFE.NS","BAJAJ-AUTO.NS",
    "ADANIGREEN.NS","ADANITRANS.NS","ADANIPOWER.NS","ATGL.NS","AWL.NS",
    "AMBUJACEM.NS","AUROPHARMA.NS","BANDHANBNK.NS","BANKBARODA.NS","BERGEPAINT.NS",
    "BIOCON.NS","BOSCHLTD.NS","CANBK.NS","CHOLAFIN.NS","COLPAL.NS",
    "CONCOR.NS","CUMMINSIND.NS","DABUR.NS","DLF.NS","ESCORTS.NS",
    "FEDERALBNK.NS","FORTIS.NS","GAIL.NS","GMRINFRA.NS","GODREJCP.NS",
    "GODREJPROP.NS","GRANULES.NS","HAL.NS","HAVELLS.NS","HDFCAMC.NS",
    "HINDPETRO.NS","IBULHSGFIN.NS","ICICIPRULI.NS","IDEA.NS","IDFC.NS",
    "IDFCFIRSTB.NS","IGL.NS","INDHOTEL.NS","INDUSTOWER.NS","INFY.NS",
    "IPCALAB.NS","IRCTC.NS","JINDALSTEL.NS","JUBLFOOD.NS","LICHSGFIN.NS",
    "LUPIN.NS","MANAPPURAM.NS","MARICO.NS","MOTHERSON.NS","MPHASIS.NS",
    "MRF.NS","MUTHOOTFIN.NS","NAUKRI.NS","NMDC.NS","OBEROIRLTY.NS",
    "OFSS.NS","PAGEIND.NS","PEL.NS","PERSISTENT.NS","PETRONET.NS",
    "PFC.NS","PIDILITIND.NS","PIIND.NS","PNB.NS","POLYCAB.NS",
    "RECLTD.NS","SAIL.NS","SRF.NS","STARHEALTH.NS","SUNTV.NS",
    "SUPREMEIND.NS","TATACOMM.NS","TATAPOWER.NS","TORNTPHARM.NS","TRENT.NS",
    "UNIONBANK.NS","UPL.NS","VEDL.NS","VOLTAS.NS","ZOMATO.NS",
    "ZYDUSLIFE.NS","ABB.NS","ACC.NS","AARTIIND.NS","ABCAPITAL.NS",
    "ABFRL.NS","ALKEM.NS","APLLTD.NS","ASTRAL.NS","ATUL.NS",
    "AUBANK.NS","BALKRISIND.NS","BATAINDIA.NS","BEL.NS","BHARATFORG.NS",
    "BHEL.NS","BSOFT.NS","CANFINHOME.NS","CASTROLIND.NS","CDSL.NS",
    "CESC.NS","CHAMBLFERT.NS","COFORGE.NS","CROMPTON.NS","CSBBANK.NS",
    "DALBHARAT.NS","DEEPAKNTR.NS","DELTACORP.NS","ECLERX.NS","EDELWEISS.NS",
    "EMAMILTD.NS","ENDURANCE.NS","ENGINERSIN.NS","EQUITASBNK.NS","EXIDEIND.NS",
    "FACT.NS","FLUOROCHEM.NS","FSL.NS","GLENMARK.NS","GLAXO.NS",
    "GNFC.NS","GOCOLORS.NS","GPPL.NS","GRINDWELL.NS","GSPL.NS",
    "GUJGASLTD.NS","HEG.NS","HFCL.NS","HIKAL.NS","HONAUT.NS",
    "IEX.NS","IFCI.NS","IIFL.NS","INOXWIND.NS","INTELLECT.NS",
    "ISGEC.NS","ITI.NS","J&KBANK.NS","JBCHEPHARM.NS","JINDALSAW.NS",
    "JKCEMENT.NS","JKLAKSHMI.NS","JKPAPER.NS","JMFINANCIL.NS","JSWENERGY.NS",
    "JUBLINGREA.NS","KAJARIACER.NS","KANSAINER.NS","KEC.NS","KIMS.NS",
    "KNRCON.NS","KRBL.NS","KSB.NS","L&TFH.NS","LATENTVIEW.NS",
    "LAXMIMACH.NS","LEMONTREE.NS","LINDEINDIA.NS","LSIL.NS","LTTS.NS",
    "LUXIND.NS","MAHINDCIE.NS","MAHLOG.NS","MASFIN.NS","MCX.NS",
    "MEDPLUS.NS","METROBRAND.NS","MINDTREE.NS","MITCON.NS","MNRE.NS",
    "MRPL.NS","MSTC.NS","NATCOPHARM.NS","NAUKRI.NS","NAVINFLUOR.NS",
    "NUVAMA.NS","OLECTRA.NS","ORIENTCEM.NS","PDSL.NS","PFIZER.NS",
    "PHOENIXLTD.NS","POLYMED.NS","PRAJIND.NS","PRINCEPIPE.NS","PSPPROJECT.NS",
    "PVR.NS","RAMCOCEM.NS","RITES.NS","ROUTE.NS","SAPPHIRE.NS",
    "SCHAEFFLER.NS","SEQUENT.NS","SHYAMMETL.NS","SIEMENS.NS","SJVN.NS",
    "SKFINDIA.NS","SOBHA.NS","SPARC.NS","SRTRANSFIN.NS","STLTECH.NS",
    "SUBROS.NS","SUMICHEM.NS","SUVEN.NS","SUVENPHAR.NS","SYMPHONY.NS",
    "TANLA.NS","TATAELXSI.NS","TATAINVEST.NS","TEJASNET.NS","THERMAX.NS",
    "THYROCARE.NS","TIMKEN.NS","TITAGARH.NS","TTKPRESTIG.NS","TVSHLTD.NS",
    "UCOBANK.NS","UJJIVANSFB.NS","UNITDSPR.NS","UTIAMC.NS","VAIBHAVGBL.NS",
    "VBL.NS","VESUVIUS.NS","VINATIORGA.NS","VIPIND.NS","WELCORP.NS",
    "WELSPUNLIV.NS","WHIRLPOOL.NS","WOCKPHARMA.NS","ZEEL.NS","ZENSARTECH.NS",
]


@router.get("/quote/{ticker}")
def get_quote(ticker: str):
    """Lightweight live quote for watchlist."""
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        prev = info.get("previousClose") or info.get("regularMarketPreviousClose")
        change_pct = ((price - prev) / prev * 100) if price and prev else None
        return {
            "ticker": ticker.upper(),
            "name": info.get("longName") or info.get("shortName", ticker.upper()),
            "price": price,
            "prev_close": prev,
            "change_pct": change_pct,
            "market_cap": info.get("marketCap"),
            "pe": info.get("trailingPE"),
            "currency": info.get("currency", "USD"),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/screener")
def nifty_screener(
    sector: str = Query(None),
    min_pe: float = Query(None),
    max_pe: float = Query(None),
    min_mcap_b: float = Query(None),
    max_mcap_b: float = Query(None),
    limit: int = Query(100, le=500),
):
    """
    Return key metrics for up to `limit` Nifty 500 stocks.
    Filters: sector, PE range, market-cap range (in Billions INR).
    """
    results = []
    for ticker in NIFTY_500[:limit]:
        try:
            info = yf.Ticker(ticker).info or {}
            price = info.get("currentPrice") or info.get("regularMarketPrice")
            prev = info.get("previousClose") or info.get("regularMarketPreviousClose")
            change_pct = ((price - prev) / prev * 100) if price and prev else None
            mcap = info.get("marketCap")
            pe = info.get("trailingPE")
            mcap_b = (mcap / 1e9) if mcap else None

            # Filters
            if sector and info.get("sector", "").lower() != sector.lower():
                continue
            if min_pe is not None and (pe is None or pe < min_pe):
                continue
            if max_pe is not None and (pe is None or pe > max_pe):
                continue
            if min_mcap_b is not None and (mcap_b is None or mcap_b < min_mcap_b):
                continue
            if max_mcap_b is not None and (mcap_b is None or mcap_b > max_mcap_b):
                continue

            results.append({
                "ticker": ticker,
                "name": info.get("longName") or info.get("shortName", ticker),
                "sector": info.get("sector", "N/A"),
                "industry": info.get("industry", "N/A"),
                "price": price,
                "change_pct": change_pct,
                "market_cap": mcap,
                "market_cap_b": mcap_b,
                "pe": pe,
                "pb": info.get("priceToBook"),
                "roe": info.get("returnOnEquity"),
                "revenue_growth": info.get("revenueGrowth"),
                "net_margin": info.get("profitMargins"),
                "dividend_yield": info.get("dividendYield"),
                "beta": info.get("beta"),
                "52w_high": info.get("fiftyTwoWeekHigh"),
                "52w_low": info.get("fiftyTwoWeekLow"),
                "currency": info.get("currency", "INR"),
            })
        except Exception:
            continue

    return {"count": len(results), "stocks": results}
