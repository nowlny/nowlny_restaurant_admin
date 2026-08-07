"use client";

import React, { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Copy, Download, Loader2, Printer } from "lucide-react";
import { SettingsService } from "@/services/api/settings";
import { getApiErrorMessage } from "@/services/api/errors";
import { useI18n } from "@/lib/i18n";

/** Public dine-in web menu; the QR code simply deep-links to it. */
const MENU_BASE_URL = "https://nowlny.com/menu";

/** High-resolution size for the hidden canvas the PNG download is cut from. */
const DOWNLOAD_SIZE = 1024;

/** Restaurant name → something safe inside a `menu-qr-{name}.png` filename. */
const fileNameSlug = (name: string) =>
  name
    .trim()
    .replace(/[\\/:*?"<>|#%&{}]+/g, "")
    .replace(/\s+/g, "-") || "menu";

export default function QrPage() {
  const { t } = useI18n();
  const [restaurant, setRestaurant] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const downloadCanvasRef = useRef<HTMLCanvasElement>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRestaurant = async () => {
    try {
      const profile = await SettingsService.getOwnRestaurant();
      setRestaurant({ id: profile.id, name: profile.name });
    } catch (err) {
      console.error("Failed to fetch restaurant profile", err);
      setErrorMessage(getApiErrorMessage(err, ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch-on-mount, same as the stories/reels pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRestaurant();
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  const handleRetry = () => {
    setLoading(true);
    setErrorMessage("");
    void fetchRestaurant();
  };

  const menuUrl = restaurant ? `${MENU_BASE_URL}/${restaurant.id}` : "";

  const handleCopy = async () => {
    if (!menuUrl) return;
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy menu link", err);
    }
  };

  const handleDownload = () => {
    const canvas = downloadCanvasRef.current;
    if (!canvas || !restaurant) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `menu-qr-${fileNameSlug(restaurant.name)}.png`;
    link.click();
  };

  return (
    <div
      className="animate-fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "32px" }}
    >
      <header className="responsive-header">
        <div>
          <h1
            style={{ fontSize: "32px", fontWeight: "700", marginBottom: "8px" }}
          >
            {t("qr.title")}
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>{t("qr.subtitle")}</p>
        </div>
      </header>

      {loading ? (
        <div
          style={{ display: "flex", justifyContent: "center", padding: "40px" }}
        >
          <Loader2
            className="animate-spin"
            size={32}
            color="var(--accent-primary)"
          />
        </div>
      ) : !restaurant ? (
        <div
          className="glass-panel"
          style={{
            padding: "40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            {errorMessage || t("error.title")}
          </p>
          <button className="btn-outline" onClick={handleRetry}>
            {t("error.retry")}
          </button>
        </div>
      ) : (
        <div
          className="glass-panel"
          style={{
            padding: "40px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "28px",
            maxWidth: "560px",
            width: "100%",
            margin: "0 auto",
          }}
        >
          {/* Only this block survives `window.print()` — see globals.css. */}
          <div
            className="qr-print-area"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <h2
              style={{
                fontSize: "22px",
                fontWeight: "700",
                margin: 0,
                textAlign: "center",
              }}
            >
              {restaurant.name}
            </h2>
            {/* White box so the code keeps its quiet zone and scans on the
                dark theme. */}
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "20px",
                borderRadius: "16px",
                display: "flex",
              }}
            >
              <QRCodeCanvas
                value={menuUrl}
                size={240}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
                title={t("qr.scan_hint")}
              />
            </div>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              {t("qr.scan_hint")}
            </p>
          </div>

          {/* Hidden high-resolution copy, rendered only to feed the PNG
              download. */}
          <div style={{ display: "none" }} aria-hidden="true">
            <QRCodeCanvas
              ref={downloadCanvasRef}
              value={menuUrl}
              size={DOWNLOAD_SIZE}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
              marginSize={4}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              width: "100%",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--text-secondary)",
              }}
            >
              {t("qr.link_label")}
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <code
                dir="ltr"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  overflowWrap: "anywhere",
                }}
              >
                {menuUrl}
              </code>
              <button className="btn-outline" onClick={() => void handleCopy()}>
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? t("qr.copied") : t("qr.copy_link")}
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button className="btn-primary" onClick={handleDownload}>
              <Download size={18} /> {t("qr.download_png")}
            </button>
            <button className="btn-outline" onClick={() => window.print()}>
              <Printer size={18} /> {t("qr.print")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
