"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Copy, Download, Printer } from "lucide-react";
import { useRestaurant } from "@/lib/restaurantContext";
import { useFeedback } from "@/components/ui/Feedback";
import { useI18n } from "@/lib/i18n";
import styles from "./qr.module.css";

/** Public dine-in web menu; the QR code simply deep-links to it. */
// www on purpose: it serves the app-link verification files directly; the
// apex host is a hosting-level redirect, which the OS verifiers refuse.
const MENU_BASE_URL = "https://www.nowlny.com/menu";

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
  const { toast } = useFeedback();
  // The shell has already fetched and verified the profile.
  const { restaurant } = useRestaurant();
  const [copied, setCopied] = useState(false);
  const downloadCanvasRef = useRef<HTMLCanvasElement>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  const menuUrl = restaurant ? `${MENU_BASE_URL}/${restaurant.id}` : "";

  const handleCopy = async () => {
    if (!menuUrl) return;
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard access is refused on http and in some embedded browsers.
      console.error("Failed to copy menu link", err);
      toast.error(t("media.qr_copy_failed"));
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
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("qr.title")}</h1>
          <p className="page-subtitle">{t("qr.subtitle")}</p>
        </div>
      </header>

      {!restaurant ? (
        <div className="empty-state" role="alert">
          <h3>{t("error.title")}</h3>
        </div>
      ) : (
        <div className={`card ${styles.panel}`}>
          {/* Only this block survives `window.print()` — see globals.css. */}
          <div className={`qr-print-area ${styles.printArea}`}>
            <h2 className={styles.name}>{restaurant.name}</h2>
            {/* White box so the code keeps its quiet zone and scans on the
                dark theme — a scanner needs dark-on-light whatever the theme. */}
            <div className={styles.codeBox}>
              <QRCodeCanvas
                value={menuUrl}
                size={240}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
                title={t("qr.scan_hint")}
                className={styles.code}
              />
            </div>
            <p className={styles.hint}>{t("qr.scan_hint")}</p>
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

          <div className="field" style={{ width: "100%" }}>
            <span className="field-label">{t("qr.link_label")}</span>
            <div className={styles.linkRow}>
              <code dir="ltr" className={styles.link}>
                {menuUrl}
              </code>
              <button type="button" className="btn-outline" onClick={() => void handleCopy()}>
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span aria-live="polite">{copied ? t("qr.copied") : t("qr.copy_link")}</span>
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className="btn-primary" onClick={handleDownload}>
              <Download size={18} /> {t("qr.download_png")}
            </button>
            <button type="button" className="btn-outline" onClick={() => window.print()}>
              <Printer size={18} /> {t("qr.print")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
