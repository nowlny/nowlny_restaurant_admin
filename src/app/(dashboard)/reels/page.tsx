"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Plus, RefreshCw } from "lucide-react";
import { ReelsService, type Reel } from "@/services/api/reels";
import { getApiErrorMessage } from "@/services/api/errors";
import { useFeedback } from "@/components/ui/Feedback";
import { useI18n } from "@/lib/i18n";
import styles from "@/components/media/media.module.css";
import ReelModal from "./components/ReelModal";
import ReelCard from "./components/ReelCard";

/** `/reels/me` pages at 10 by default, which silently hid an owner's older reels. */
const PAGE_LIMIT = 50;

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

export default function ReelsPage() {
  const { t } = useI18n();
  const { toast, confirm } = useFeedback();
  const [reels, setReels] = useState<Reel[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // `undefined` = editor closed, `null` = creating.
  const [editing, setEditing] = useState<Reel | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    ReelsService.getOwnReels({ limit: PAGE_LIMIT })
      .then((data) => {
        if (cancelled) return;
        setReels(data);
        setLoad({ status: "ready" });
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch reels", err);
        // Fallback copy is resolved at render, so `t` stays out of the deps.
        if (!cancelled) setLoad({ status: "error", message: getApiErrorMessage(err, "") });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = () => {
    setLoad({ status: "loading" });
    setReloadKey((n) => n + 1);
  };

  const handleDelete = async (reel: Reel) => {
    const ok = await confirm({
      title: t("media.delete_reel_title"),
      message: t("reels.confirm_delete"),
      danger: true,
    });
    if (!ok) return;
    setDeletingId(reel.id);
    try {
      await ReelsService.deleteReel(reel.id);
      setReels((current) => current.filter((r) => r.id !== reel.id));
      toast.success(t("media.reel_deleted"));
    } catch (err) {
      console.error("Failed to delete reel", err);
      toast.error(getApiErrorMessage(err, t("media.delete_failed")));
    } finally {
      setDeletingId(null);
    }
  };

  const openCreate = () => setEditing(null);

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("reels.title")}</h1>
          <p className="page-subtitle">{t("reels.subtitle")}</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          <Plus size={20} /> {t("reels.create")}
        </button>
      </header>

      {load.status === "loading" ? (
        <div className={styles.grid} aria-busy="true" aria-label={t("common.loading")}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: "9 / 16", borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      ) : load.status === "error" ? (
        <div className="empty-state" role="alert">
          <h3>{load.message || t("media.load_reels_failed")}</h3>
          <button type="button" className="btn-outline" onClick={retry}>
            <RefreshCw size={18} /> {t("common.retry")}
          </button>
        </div>
      ) : reels.length === 0 ? (
        <div className="empty-state">
          <Clapperboard size={40} color="var(--accent-primary)" aria-hidden="true" />
          <h3>{t("media.reels_empty_title")}</h3>
          <p>{t("reels.empty")}</p>
          <button type="button" className="btn-primary" onClick={openCreate} style={{ marginTop: "6px" }}>
            <Plus size={18} /> {t("reels.create")}
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {reels.map((reel) => (
            <ReelCard
              key={reel.id}
              reel={reel}
              deleting={deletingId === reel.id}
              onEdit={() => setEditing(reel)}
              onDelete={() => void handleDelete(reel)}
            />
          ))}
        </div>
      )}

      {editing !== undefined && (
        <ReelModal
          key={editing?.id ?? "new"}
          reel={editing}
          onClose={() => setEditing(undefined)}
          onSave={() => setReloadKey((n) => n + 1)}
        />
      )}
    </div>
  );
}
