"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleDashed, Loader2, Plus, RefreshCw } from "lucide-react";
import { StoriesService, type Story } from "@/services/api/stories";
import { getApiErrorMessage, isApiNotFound } from "@/services/api/errors";
import { useRestaurant } from "@/lib/restaurantContext";
import { useFeedback } from "@/components/ui/Feedback";
import { useI18n } from "@/lib/i18n";
import SortHandle, { beginRowDrag, moveInArray } from "@/components/menu/SortHandle";
import styles from "@/components/media/media.module.css";
import StoryModal from "./components/StoryModal";
import StoryCard from "./components/StoryCard";
import StoryViewersModal from "./components/StoryViewersModal";

/** Server order when the API reports one; otherwise the listing's own order (the sort is stable). */
const bySortOrder = (list: Story[]) =>
  list.every((s) => typeof s.sortOrder === "number")
    ? list.slice().sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
    : list;

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

export default function StoriesPage() {
  const { t } = useI18n();
  const { toast, confirm } = useFeedback();
  // The shell has already fetched the profile; only its id is needed here.
  const restaurantId = useRestaurant().restaurant?.id;

  const [stories, setStories] = useState<Story[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // `undefined` = editor closed, `null` = creating.
  const [editing, setEditing] = useState<Story | null | undefined>(undefined);
  const [viewersFor, setViewersFor] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    StoriesService.getOwnStories(restaurantId)
      .then((data) => {
        if (cancelled) return;
        setStories(bySortOrder(data));
        setLoad({ status: "ready" });
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch stories", err);
        // Fallback copy is resolved at render, so `t` stays out of the deps.
        if (!cancelled) setLoad({ status: "error", message: getApiErrorMessage(err, "") });
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, reloadKey]);

  const retry = () => {
    setLoad({ status: "loading" });
    setReloadKey((n) => n + 1);
  };

  const handleDelete = async (story: Story) => {
    const ok = await confirm({
      title: t("media.delete_story_title"),
      message: t("stories.confirm_delete"),
      danger: true,
    });
    if (!ok) return;
    setDeletingId(story.id);
    try {
      await StoriesService.deleteStory(story.id);
      setStories((current) => current.filter((s) => s.id !== story.id));
      toast.success(t("media.story_deleted"));
    } catch (err) {
      console.error("Failed to delete story", err);
      toast.error(getApiErrorMessage(err, t("media.delete_failed")));
    } finally {
      setDeletingId(null);
    }
  };

  const openCreate = () => setEditing(null);

  // ─── Reordering ─────────────────────────────────────────────────────────
  //
  // Same pattern as the menu page: the drag source lives in a ref because a
  // state update made in `dragstart` may not have rendered before the first
  // `dragover`; the state copy only paints the highlighting. One save at a
  // time, so two quick moves can't land on the server out of order.
  const draggingRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  // Set once the API answers 404 — the route isn't deployed, so stop offering it.
  const [reorderUnsupported, setReorderUnsupported] = useState(false);

  const canSort = stories.length > 1 && !reordering && !reorderUnsupported && deletingId === null;
  const sortBlockedHint = reorderUnsupported
    ? t("media.story_reorder_unavailable")
    : reordering
      ? t("media.story_reorder_saving")
      : undefined;

  const clearDrag = () => {
    draggingRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  };

  const moveStory = async (storyId: string, toIndex: number) => {
    if (!canSort) return;
    const from = stories.findIndex((s) => s.id === storyId);
    if (from < 0 || toIndex < 0 || toIndex >= stories.length || from === toIndex) return;
    const previous = stories;
    const next = moveInArray(stories, from, toIndex);
    setStories(next);
    setReordering(true);
    try {
      await StoriesService.reorderStories(next.map((s) => s.id));
    } catch (err: unknown) {
      console.error("Failed to reorder stories", err);
      setStories(previous); // the server still has the old order
      if (isApiNotFound(err)) {
        setReorderUnsupported(true);
        toast.error(t("media.story_reorder_unavailable"));
      } else {
        toast.error(getApiErrorMessage(err, t("media.story_reorder_failed")));
      }
    } finally {
      setReordering(false);
    }
  };

  const handleDrop = (targetId: string) => {
    const source = draggingRef.current;
    clearDrag();
    if (!source || source === targetId) return;
    void moveStory(source, stories.findIndex((s) => s.id === targetId));
  };

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("stories.title")}</h1>
          <p className="page-subtitle">{t("stories.subtitle")}</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          <Plus size={20} /> {t("stories.create")}
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
          <h3>{load.message || t("media.load_stories_failed")}</h3>
          <button type="button" className="btn-outline" onClick={retry}>
            <RefreshCw size={18} /> {t("common.retry")}
          </button>
        </div>
      ) : stories.length === 0 ? (
        <div className="empty-state">
          <CircleDashed size={40} color="var(--accent-primary)" aria-hidden="true" />
          <h3>{t("media.stories_empty_title")}</h3>
          <p>{t("stories.empty")}</p>
          <button type="button" className="btn-primary" onClick={openCreate} style={{ marginTop: "6px" }}>
            <Plus size={18} /> {t("stories.create")}
          </button>
        </div>
      ) : (
        <>
          {stories.length > 1 && (
            <p
              className="field-hint"
              role="status"
              style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              {reordering && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {reordering
                ? t("media.story_reorder_saving")
                : reorderUnsupported
                  ? t("media.story_reorder_unavailable")
                  : t("media.story_reorder_hint")}
            </p>
          )}
          <div className={styles.grid}>
            {stories.map((story, index) => {
              const position = index + 1;
              const isDragged = draggingId === story.id;
              const isTarget = dropTargetId === story.id && draggingId !== null && draggingId !== story.id;
              return (
                <div
                  key={story.id}
                  data-drag-card
                  className={isDragged ? "is-dragging" : undefined}
                  onDragOver={(e) => {
                    const source = draggingRef.current;
                    if (!source || source === story.id) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropTargetId(story.id);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                    setDropTargetId((prev) => (prev === story.id ? null : prev));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(story.id);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    minWidth: 0,
                    borderRadius: "var(--radius-lg)",
                    outline: isTarget ? "2px dashed var(--accent-primary)" : undefined,
                    outlineOffset: "3px",
                  }}
                >
                  {stories.length > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <SortHandle
                        label={t("media.story_sort_aria", { position })}
                        disabled={!canSort}
                        disabledHint={sortBlockedHint}
                        size={16}
                        onDragStart={(e) => {
                          beginRowDrag(e, story.id);
                          draggingRef.current = story.id;
                          setDraggingId(story.id);
                        }}
                        onDragEnd={clearDrag}
                        onMove={(delta) => void moveStory(story.id, index + delta)}
                      />
                      <span
                        className="badge"
                        aria-hidden="true"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {t("media.story_position", { position })}
                      </span>
                      <span style={{ flex: 1 }} />
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => void moveStory(story.id, index - 1)}
                        disabled={!canSort || index === 0}
                        aria-label={`${t("media.story_move_earlier")} (${t("media.story_sort_aria", { position })})`}
                        title={t("media.story_move_earlier")}
                      >
                        <ChevronLeft size={16} className="flip-in-rtl" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => void moveStory(story.id, index + 1)}
                        disabled={!canSort || index === stories.length - 1}
                        aria-label={`${t("media.story_move_later")} (${t("media.story_sort_aria", { position })})`}
                        title={t("media.story_move_later")}
                      >
                        <ChevronRight size={16} className="flip-in-rtl" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <StoryCard
                    story={story}
                    deleting={deletingId === story.id}
                    onEdit={() => setEditing(story)}
                    onDelete={() => void handleDelete(story)}
                    onShowViewers={() => setViewersFor(story.id)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {editing !== undefined && (
        <StoryModal
          key={editing?.id ?? "new"}
          story={editing}
          onClose={() => setEditing(undefined)}
          onSave={() => setReloadKey((n) => n + 1)}
        />
      )}

      {viewersFor && (
        <StoryViewersModal key={viewersFor} storyId={viewersFor} onClose={() => setViewersFor(null)} />
      )}
    </div>
  );
}
