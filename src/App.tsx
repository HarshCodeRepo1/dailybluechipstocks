import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { getMe } from "./api";
import Home from "./pages/Home";
import "./App.css";

function App() {
  const auth = useAuth();
  const [apiResult, setApiResult] = useState<unknown>(null);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    async function verifyProtectedApi() {
      if (!auth.isAuthenticated || !auth.user) {
        setApiResult(null);
        return;
      }

      try {
        setApiError("");
        const result = await getMe(auth.user);
        setApiResult(result);
        console.log("Protected /me response:", result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown API error";
        setApiError(message);
        console.error(message);
      }
    }

    verifyProtectedApi();
  }, [auth.isAuthenticated, auth.user]);

  return (
    <>
      <Home />

      {auth.isAuthenticated && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 24px" }}>
          <div
            style={{
              border: "1px solid #d7e2dc",
              borderRadius: 12,
              padding: 16,
              fontFamily: "monospace",
              background: "#f8fbf9",
            }}
          >
            <strong>Protected API test:</strong>{" "}
            {apiError
              ? `Error: ${apiError}`
              : apiResult
              ? JSON.stringify(apiResult)
              : "Calling /me..."}
          </div>
        </div>
      )}
    </>
  );
}

export default App;
