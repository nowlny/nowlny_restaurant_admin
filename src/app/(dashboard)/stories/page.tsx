"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Plus, Edit2, Trash2, Eye } from "lucide-react";
import { StoriesService } from "@/services/api/stories";
import { SettingsService } from "@/services/api/settings";
import StoryModal from "./components/StoryModal";
import { useI18n } from "@/lib/i18n";

export default function StoriesPage() {
  const { t } = useI18n();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<any>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    setLoading(true);
    try {
      // First get the restaurant profile to get the ID
      const profile = await SettingsService.getOwnRestaurant();
      if (profile?.id) {
        setRestaurantId(profile.id);
        const data = await StoriesService.getOwnStories(profile.id);
        setStories(data);
      }
    } catch (err) {
      console.error("Failed to fetch stories", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (storyId: string) => {
    if (confirm(t("stories.confirm_delete"))) {
      try {
        await StoriesService.deleteStory(storyId);
        fetchStories();
      } catch (err) {
        console.error("Failed to delete story", err);
      }
    }
  };

  const viewCounts = async (storyId: string) => {
    try {
      const data = await StoriesService.getStoryViewers(storyId);
      alert(t("stories.view_count", { count: data.count || 0 }));
    } catch (err) {
      console.error("Failed to fetch viewers", err);
      alert(t("stories.view_count_failed"));
    }
  };

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.endsWith(".mp4") ||
      lower.endsWith(".mov") ||
      lower.includes("/video/upload/")
    );
  };

  return (
    <div
      className="animate-fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "32px" }}
    >
      <header
        className="responsive-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1
            style={{ fontSize: "32px", fontWeight: "700", marginBottom: "8px" }}
          >
            {t("stories.title")}
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            {t("stories.subtitle")}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setEditingStory(null);
            setIsModalOpen(true);
          }}
        >
          <Plus size={20} /> {t("stories.create")}
        </button>
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
      ) : stories.length === 0 ? (
        <div
          className="glass-panel"
          style={{ padding: "40px", textAlign: "center" }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            {t("stories.empty")}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          {stories.map((story) => (
            <div
              key={story.id}
              className="glass-panel"
              style={{
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: "350px",
                  backgroundColor: "var(--bg-elevated)",
                  position: "relative",
                }}
              >
                {isVideoUrl(story.imageUrl) ? (
                  <video
                    src={story.imageUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <img
                    src={story.imageUrl}
                    alt={story.caption || t("stories.title")}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    insetInline: 0,
                    background: "linear-gradient(rgba(0,0,0,0.5), transparent)",
                    padding: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      color: "white",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    {t("stories.active")}
                  </span>
                  <button
                    onClick={() => viewCounts(story.id)}
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: "none",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      cursor: "pointer",
                    }}
                  >
                    <Eye size={14} /> {t("stories.views")}
                  </button>
                </div>
              </div>
              <div
                style={{
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--text-secondary)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: "40px",
                  }}
                >
                  {story.caption || t("stories.no_caption")}
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => {
                      setEditingStory(story);
                      setIsModalOpen(true);
                    }}
                    className="btn-outline"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    <Edit2 size={16} /> {t("common.edit")}
                  </button>
                  <button
                    onClick={() => handleDelete(story.id)}
                    aria-label={t("common.delete")}
                    className="btn-outline"
                    style={{
                      padding: "8px 12px",
                      color: "var(--error)",
                      borderColor: "var(--error)",
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <StoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        story={editingStory}
        onSave={fetchStories}
      />
    </div>
  );
}
