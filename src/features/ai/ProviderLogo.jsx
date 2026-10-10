import React, { useEffect, useState } from "react";
import { Cloud, SquaresFour } from "@phosphor-icons/react";
import { providerLogoAssets, providerLogoCatalog, resolveProviderLogoName } from "./modelLogoContract.js";
import { getModelLogoPersistenceState } from "./modelLogoReferenceContract.js";
import "./model-logo-status.css";

const genericIcons = { Cloud, SquaresFour };
const fallbackUnknown = Object.freeze({ iconName: "SquaresFour", title: "Generic provider fallback; no verified brand or model logo is available" });

export default function ProviderLogo({ provider, modelLogo, modelName, modelLogoReference, modelLogoAssignmentConfirmed, displayMode = "compact" }) {
  const [customFailed, setCustomFailed] = useState(false);
  const [providerAssetFailed, setProviderAssetFailed] = useState(false);
  const logoReference = modelLogoReference || modelLogo?.reference;
  const logoState = getModelLogoPersistenceState({ modelLogo, modelLogoReference: logoReference, serverAssignmentConfirmed: modelLogoAssignmentConfirmed === true || modelLogo?.assignmentConfirmed === true });
  const providerKey = resolveProviderLogoName(provider);
  const assetUrl = providerLogoAssets[providerKey];
  const providerCatalogEntry = providerLogoCatalog[providerKey];
  useEffect(() => { setCustomFailed(false); }, [modelLogo?.dataUrl]);
  useEffect(() => { setProviderAssetFailed(false); }, [assetUrl]);

  if (modelLogo?.kind === "custom-model" && modelLogo?.persistence === "MEMORY_ONLY" && typeof modelLogo.dataUrl === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(modelLogo.dataUrl) && !customFailed) {
    const customLogoTitle = `${modelName || "Model"}: ${modelLogo.sourceStatus || "NON_OFFICIAL_CUSTOM"}; ${logoState.label}`;
    return <span className="provider-logo provider-logo--model-custom" title={customLogoTitle} role="img" aria-label={customLogoTitle}><img src={modelLogo.dataUrl} alt="" onError={() => setCustomFailed(true)} /><small className="provider-logo-state-chip" title={modelLogo.sourceStatus || "NON_OFFICIAL_CUSTOM"}>{logoState.code === "MEMORY_ONLY" ? "LOCAL ONLY" : logoState.code}</small></span>;
  }

  if (assetUrl && !providerAssetFailed) {
    const userSuppliedMark = providerCatalogEntry?.sourceStatus === "USER_SUPPLIED_REFERENCE";
    const title = userSuppliedMark
      ? `${providerKey} 标识 · ${providerCatalogEntry?.title || "用户提供的原始图形"}`
      : `${providerKey} Provider mark · ${providerCatalogEntry?.sourceStatus || "source status unavailable"}`;
    const isWideWordmark = ["Anthropic", "Alibaba Cloud", "Microsoft Azure"].includes(providerKey);
    const modeClass = displayMode === "inline" ? " provider-logo--inline" : "";
    const shapeClass = isWideWordmark ? " provider-logo--wide" : "";
    return <span className={`provider-logo provider-logo--image provider-logo--${providerKey.toLowerCase().replace(/[^a-z]+/g, "-")}${modeClass}${shapeClass}`} title={title} role="img" aria-label={title}><img src={assetUrl} alt="" onError={() => setProviderAssetFailed(true)} /></span>;
  }

  if (assetUrl && providerAssetFailed) {
    const title = `${providerKey} name fallback; provider logo failed to load`;
    return <span className={`provider-logo provider-logo--wordmark provider-logo--${providerKey.toLowerCase().replace(/[^a-z]+/g, "-")}`} title={title} role="img" aria-label={title}>{providerKey}</span>;
  }

  const fallback = providerCatalogEntry || fallbackUnknown;
  if (fallback.kind === "provider-wordmark-fallback") {
    const title = `${fallback.wordmark} provider name; logo asset unavailable`;
    return <span className={`provider-logo provider-logo--wordmark provider-logo--${providerKey.toLowerCase().replace(/[^a-z]+/g, "-")}`} title={title} role="img" aria-label={title}>{fallback.wordmark}</span>;
  }

  const Icon = genericIcons[fallback.iconName] || SquaresFour;
  const label = String(provider || "Unknown Provider").trim() || "Unknown Provider";
  const title = fallback.title ? `${label}: ${fallback.title}` : `${label}: generic provider fallback, not a verified brand logo`;
  return <span className="provider-logo provider-logo--generic" title={logoReference ? `${title}; ${logoState.label}` : title} role="img" aria-label={logoReference ? `${title}; ${logoState.label}` : title}><Icon size={16} weight="regular" aria-hidden="true" />{logoReference && <small className="provider-logo-state-chip">{logoState.serverSaved ? "SERVER SAVED" : "REF NOT SAVED"}</small>}</span>;
}
