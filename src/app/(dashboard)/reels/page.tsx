"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Plus, Edit2, Trash2, Video } from "lucide-react";
import { ReelsService } from "@/services/api/reels";
import ReelModal from "./components/ReelModal";

export default function ReelsPage() {
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReel, setEditingReel] = useState<any>(null);

  useEffect(() => {
    fetchReels();
  }, []);

  const fetchReels = async () => {
    setLoading(true);
    try {
      const data = await ReelsService.getOwnReels();
      setReels(data);
    } catch (err) {
      console.error("Failed to fetch reels", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reelId: string) => {
    if (confirm("Are you sure you want to delete this reel?")) {
      try {
        await ReelsService.deleteReel(reelId);
        fetchReels();
      } catch (err) {
        console.error("Failed to delete reel", err);
      }
    }
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
            Reels
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Engage customers with short video reels.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setEditingReel(null);
            setIsModalOpen(true);
          }}
        >
          <Plus size={20} /> Create Reel
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
      ) : reels.length === 0 ? (
        <div
          className="glass-panel"
          style={{ padding: "40px", textAlign: "center" }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            No reels found. Add one to engage your customers.
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
          {reels.map((reel) => (
            <div
              key={reel.id}
              className="glass-panel"
              style={{
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: "450px",
                  backgroundColor: "var(--bg-elevated)",
                  position: "relative",
                }}
              >
                <video
                  src={reel.videoUrl}
                  poster={reel.thumbnailUrl}
                  controls
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    background: "linear-gradient(rgba(0,0,0,0.5), transparent)",
                    padding: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    pointerEvents: "none",
                  }}
                >
                  <span
                    style={{
                      color: "white",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    {reel.status === 'active' ? 'Active' : 'Hidden'}
                  </span>
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
                  {reel.caption || "No caption"}
                </p>
                
                {reel.menuItemId && (
                  <div style={{ fontSize: "12px", color: "var(--accent-primary)", fontWeight: "600" }}>
                    Linked to Menu Item
                  </div>
                )}
                
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => {
                      setEditingReel(reel);
                      setIsModalOpen(true);
                    }}
                    className="btn-outline"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    <Edit2 size={16} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(reel.id)}
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

      <ReelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        reel={editingReel}
        onSave={fetchReels}
      />
    </div>
  );
}
