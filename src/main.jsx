import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import DevStatusPage from "./DevStatusPage.jsx";
import "./styles.css";

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    {window.location.pathname === "/dev-status" ? <DevStatusPage /> : <App />}
  </React.StrictMode>,
);
