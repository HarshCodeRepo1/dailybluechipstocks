import { useEffect, useMemo, useState } from "react";
import type { User } from "oidc-client-ts";
import {
  getPreferences,
  savePreferences,
  type UserPreferences,
} from "../api";

type Props = {
  user: User;
};

const SECTORS = [
  "AI",
  "Technology",
  "Pharma",
  "Healthcare",
  "Energy",
  "Financials",
  "Consumer",
  "Industrials",
  "Telecom",
];

const STOCKS = [
  { ticker: "AAPL", name: "Apple", sector: "Technology" },
  { ticker: "MSFT", name: "Microsoft", sector: "Technology" },
  { ticker: "NVDA", name: "NVIDIA", sector: "AI" },
  { ticker: "GOOGL", name: "Alphabet", sector: "Technology" },
  { ticker: "AMZN", name: "Amazon", sector: "Consumer" },
  { ticker: "META", name: "Meta Platforms", sector: "Technology" },
  { ticker: "AVGO", name: "Broadcom", sector: "AI" },
  { ticker: "ORCL", name: "Oracle", sector: "Technology" },
  { ticker: "CRM", name: "Salesforce", sector: "Technology" },
  { ticker: "ADBE", name: "Adobe", sector: "Technology" },
  { ticker: "LLY", name: "Eli Lilly", sector: "Pharma" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { ticker: "PFE", name: "Pfizer", sector: "Pharma" },
  { ticker: "MRK", name: "Merck", sector: "Pharma" },
  { ticker: "ABBV", name: "AbbVie", sector: "Pharma" },
  { ticker: "XOM", name: "Exxon Mobil", sector: "Energy" },
  { ticker: "CVX", name: "Chevron", sector: "Energy" },
  { ticker: "COP", name: "ConocoPhillips", sector: "Energy" },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "Financials" },
  { ticker: "BAC", name: "Bank of America", sector: "Financials" },
  { ticker: "GS", name: "Goldman Sachs", sector: "Financials" },
  { ticker: "V", name: "Visa", sector: "Financials" },
  { ticker: "MA", name: "Mastercard", sector: "Financials" },
  { ticker: "WMT", name: "Walmart", sector: "Consumer" },
  { ticker: "COST", name: "Costco", sector: "Consumer" },
  { ticker: "HD", name: "Home Depot", sector: "Consumer" },
  { ticker: "KO", name: "Coca-Cola", sector: "Consumer" },
  { ticker: "PEP", name: "PepsiCo", sector: "Consumer" },
  { ticker: "CAT", name: "Caterpillar", sector: "Industrials" },
  { ticker: "GE", name: "GE Aerospace", sector: "Industrials" },
];

const ALERT_PERIODS = ["1M", "2M", "3M", "4M", "6M", "1Y"];

const EMPTY_PREFERENCES: UserPreferences = {
  sectors: [],
  stocks: [],
  alertPeriods: ["1M", "3M", "6M"],
  newsletterEnabled: true,
};

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export default function PreferencesPanel({ user }: Props) {
  const [preferences, setPreferences] =
    useState<UserPreferences>(EMPTY_PREFERENCES);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setMessage("");
        const result = await getPreferences(user);
        if (!cancelled) {
          setPreferences({
            ...EMPTY_PREFERENCES,
            ...result,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not load preferences."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredStocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return STOCKS;

    return STOCKS.filter(
      (stock) =>
        stock.ticker.toLowerCase().includes(q) ||
        stock.name.toLowerCase().includes(q) ||
        stock.sector.toLowerCase().includes(q)
    );
  }, [search]);

  async function handleSave() {
    try {
      setSaving(true);
      setMessage("");

      const saved = await savePreferences(user, {
        sectors: preferences.sectors,
        stocks: preferences.stocks,
        alertPeriods: preferences.alertPeriods,
        newsletterEnabled: preferences.newsletterEnabled,
      });

      setPreferences({
        ...preferences,
        ...saved,
      });
      setMessage("Preferences saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save preferences."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section style={styles.wrapper}>
        <div style={styles.card}>Loading your preferences...</div>
      </section>
    );
  }

  return (
    <section style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>PERSONALIZE YOUR NEWSLETTER</div>
          <h2 style={styles.title}>Choose what you want us to watch</h2>
          <p style={styles.subtitle}>
            Follow as many supported stocks as you like. Each newsletter will
            still show a maximum of 10 stocks so it stays concise.
          </p>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Sectors</h3>
          <div style={styles.optionsGrid}>
            {SECTORS.map((sector) => (
              <label key={sector} style={styles.option}>
                <input
                  type="checkbox"
                  checked={preferences.sectors.includes(sector)}
                  onChange={() =>
                    setPreferences((current) => ({
                      ...current,
                      sectors: toggleValue(current.sectors, sector),
                    }))
                  }
                />
                <span>{sector}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Price-low alerts</h3>
          <div style={styles.optionsGrid}>
            {ALERT_PERIODS.map((period) => (
              <label key={period} style={styles.option}>
                <input
                  type="checkbox"
                  checked={preferences.alertPeriods.includes(period)}
                  onChange={() =>
                    setPreferences((current) => ({
                      ...current,
                      alertPeriods: toggleValue(
                        current.alertPeriods,
                        period
                      ),
                    }))
                  }
                />
                <span>{period} low</span>
              </label>
            ))}
          </div>

          <label style={{ ...styles.option, marginTop: 20 }}>
            <input
              type="checkbox"
              checked={preferences.newsletterEnabled}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  newsletterEnabled: event.target.checked,
                }))
              }
            />
            <span>Send me the newsletter</span>
          </label>
        </div>
      </div>

      <div style={{ ...styles.card, marginTop: 18 }}>
        <div style={styles.stockHeader}>
          <div>
            <h3 style={styles.cardTitle}>Stocks</h3>
            <div style={styles.count}>
              {preferences.stocks.length} selected
            </div>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search AAPL, Apple, AI..."
            style={styles.search}
          />
        </div>

        <div style={styles.stockGrid}>
          {filteredStocks.map((stock) => {
            const checked = preferences.stocks.includes(stock.ticker);

            return (
              <label
                key={stock.ticker}
                style={{
                  ...styles.stockOption,
                  ...(checked ? styles.stockOptionSelected : {}),
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setPreferences((current) => ({
                      ...current,
                      stocks: toggleValue(current.stocks, stock.ticker),
                    }))
                  }
                />
                <div>
                  <strong>{stock.name}</strong>
                  <div style={styles.stockMeta}>
                    {stock.ticker} · {stock.sector}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div style={styles.footer}>
        <div style={styles.message}>{message}</div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            ...styles.saveButton,
            opacity: saving ? 0.65 : 1,
          }}
        >
          {saving ? "Saving..." : "Save preferences"}
        </button>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "28px 24px 56px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: 800,
    color: "#169c4b",
    letterSpacing: 0.8,
  },
  title: {
    margin: "8px 0 6px",
    fontSize: 32,
    color: "#102544",
  },
  subtitle: {
    margin: 0,
    color: "#65748b",
    maxWidth: 760,
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 18,
  },
  card: {
    border: "1px solid #dbe6df",
    borderRadius: 18,
    background: "#ffffff",
    padding: 22,
    boxShadow: "0 10px 30px rgba(16, 37, 68, 0.05)",
  },
  cardTitle: {
    margin: 0,
    color: "#102544",
    fontSize: 20,
  },
  optionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 12,
    marginTop: 18,
  },
  option: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    color: "#24364f",
    cursor: "pointer",
  },
  stockHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  count: {
    marginTop: 5,
    fontSize: 13,
    color: "#738097",
  },
  search: {
    minWidth: 260,
    flex: "0 1 360px",
    padding: "11px 14px",
    borderRadius: 10,
    border: "1px solid #cad7cf",
    outline: "none",
    fontSize: 14,
  },
  stockGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 12,
  },
  stockOption: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    border: "1px solid #e1e9e4",
    borderRadius: 12,
    cursor: "pointer",
    background: "#fff",
  },
  stockOptionSelected: {
    border: "1px solid #2bbf69",
    background: "#f2fbf5",
  },
  stockMeta: {
    fontSize: 12,
    color: "#7c8798",
    marginTop: 3,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 18,
    marginTop: 18,
  },
  message: {
    color: "#526077",
    fontSize: 14,
  },
  saveButton: {
    border: 0,
    borderRadius: 12,
    background: "#19a954",
    color: "#fff",
    fontWeight: 800,
    padding: "13px 20px",
    cursor: "pointer",
  },
};
