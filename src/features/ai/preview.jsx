import React from "react";
import { createRoot } from "react-dom/client";
import AIOverviewPage from "./OverviewPage.jsx";
import "./ai-preview.css";

createRoot(document.getElementById("ai-root")).render(
  <React.StrictMode><AIOverviewPage /></React.StrictMode>,
);
