import React from "react";
import { createRoot } from "react-dom/client";
import AddModelPage from "./AddModelPage.jsx";
import { modelQuotaAdapter } from "./modelQuotaAdapter.js";

window.__addModelMockAdapter = modelQuotaAdapter;

createRoot(document.getElementById("add-model-preview")).render(
  <React.StrictMode><AddModelPage adapter={modelQuotaAdapter} onCancel={() => { window.__addModelCanceled = true; }} onSaved={() => { window.__addModelSaved = true; }} /></React.StrictMode>,
);
