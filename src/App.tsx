import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { getMe } from "./api";
import PreferencesPanel from "./components/PreferencesPanel";
import Home from "./pages/Home";
import "./App.css";

function App() {
  const auth = useAuth();

  useEffect(() => {
    async function verifyProtectedApi() {
      if (!auth.isAuthenticated || !auth.user) return;

      try {
        const result = await getMe(auth.user);
        console.log("Protected /me response:", result);
      } catch (error) {
        console.error(
          error instanceof Error ? error.message : "Unknown API error"
        );
      }
    }

    verifyProtectedApi();
  }, [auth.isAuthenticated, auth.user]);

  return (
    <>
      <Home />

      {auth.isAuthenticated && auth.user && (
        <PreferencesPanel user={auth.user} />
      )}
    </>
  );
}

export default App;
