import React from "react";
import { createRoot } from "react-dom/client";
import { UsageCostPreview } from "./UsageCostPreview.jsx";

const host = document.getElementById("usage-cost-preview");

if (host) {
  createRoot(host).render(<React.StrictMode><UsageCostPreview /></React.StrictMode>);
}
