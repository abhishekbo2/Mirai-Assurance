import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { initializeAuthentication } from "./auth/keycloak";

const root = createRoot(document.getElementById("root"));

initializeAuthentication()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error) => {
    root.render(
      <main className="flex min-h-screen items-center justify-center bg-blue-100 p-4">
        <p className="max-w-lg rounded-xl bg-white p-6 text-center text-red-700 shadow-lg">
          Authentication setup is incomplete: {error.message}
        </p>
      </main>,
    );
  });
