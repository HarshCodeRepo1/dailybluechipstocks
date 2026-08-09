import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { getMarket, getMe, getPublicMarket } from "./api";
import PreferencesPanel from "./components/PreferencesPanel";
import Home from "./pages/Home";
import type { Stock } from "./types/market";
import "./App.css";

function App() {
  const auth = useAuth();
  const [marketStocks, setMarketStocks] = useState<Stock[]>([]);

  useEffect(() => {
    async function loadMarketData() {
      try {
        // Public landing page: always show the default 10 blue chips
        // from our cached DynamoDB data. This does NOT call Marketstack.
        if (!auth.isAuthenticated || !auth.user) {
          const market = await getPublicMarket();
          setMarketStocks(market.stocks);
          return;
        }

        const [me, market] = await Promise.all([
          getMe(auth.user),
          getMarket(auth.user),
        ]);

        console.log("Protected /me response:", me);
        console.log("Cached /market response:", market);

        // Logged in:
        // explicit stocks only, max 10.
        // If the user chose none, backend returns default 10.
        setMarketStocks(market.stocks);
      } catch (error) {
        console.error(
          error instanceof Error ? error.message : "Unknown API error"
        );
      }
    }

    loadMarketData();
  }, [auth.isAuthenticated, auth.user]);

  return (
    <>
      <Home marketStocks={marketStocks} />

      {auth.isAuthenticated && auth.user && (
        <PreferencesPanel user={auth.user} />
      )}
    </>
  );
}

export default App;
