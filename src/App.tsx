import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import {
  getMarket,
  getMe,
  type NewsletterSelection,
} from "./api";
import PreferencesPanel from "./components/PreferencesPanel";
import Home from "./pages/Home";
import type { Stock } from "./types/market";
import "./App.css";

function App() {
  const auth = useAuth();
  const [marketStocks, setMarketStocks] = useState<Stock[]>([]);
  const [newsletter, setNewsletter] =
    useState<NewsletterSelection | null>(null);

  useEffect(() => {
    async function loadAuthenticatedData() {
      if (!auth.isAuthenticated || !auth.user) {
        setMarketStocks([]);
        setNewsletter(null);
        return;
      }

      try {
        const [me, market] = await Promise.all([
          getMe(auth.user),
          getMarket(auth.user),
        ]);

        console.log("Protected /me response:", me);
        console.log("Cached /market response:", market);

        setMarketStocks(market.stocks);
        setNewsletter(market.newsletter);
      } catch (error) {
        console.error(
          error instanceof Error ? error.message : "Unknown API error"
        );
      }
    }

    loadAuthenticatedData();
  }, [auth.isAuthenticated, auth.user]);

  return (
    <>
      <Home
        marketStocks={marketStocks}
        newsletter={newsletter}
      />

      {auth.isAuthenticated && auth.user && (
        <PreferencesPanel user={auth.user} />
      )}
    </>
  );
}

export default App;
