"use client";

import React, { useEffect, useState } from "react";
import { Store, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { apiClient } from "@/services/api/client";

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await apiClient.get("/restaurants/me");
        setProfile(data);
      } catch (err) {
        // Handle error or lack of approved restaurant
        console.error("Failed to fetch profile", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

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
            Welcome back{profile?.name ? `, ${profile.name}` : ""}!
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Here is what's happening with your restaurant today.
          </p>
        </div>
      </header>

      {/* Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: "24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "var(--accent-light)",
              color: "var(--accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Store size={24} />
          </div>
          <div>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "14px",
                fontWeight: "500",
                marginBottom: "4px",
              }}
            >
              Status
            </p>
            <h3 style={{ fontSize: "24px", fontWeight: "700" }}>
              {loading ? "..." : profile?.status || "Pending Review"}
            </h3>
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: "24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(16, 185, 129, 0.1)",
              color: "var(--success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingUp size={24} />
          </div>
          <div>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "14px",
                fontWeight: "500",
                marginBottom: "4px",
              }}
            >
              Today's Orders
            </p>
            <h3 style={{ fontSize: "24px", fontWeight: "700" }}>0</h3>
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: "24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(245, 158, 11, 0.1)",
              color: "var(--warning)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Clock size={24} />
          </div>
          <div>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "14px",
                fontWeight: "500",
                marginBottom: "4px",
              }}
            >
              Pending Orders
            </p>
            <h3 style={{ fontSize: "24px", fontWeight: "700" }}>0</h3>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="glass-panel"
        style={{
          padding: "32px",
          minHeight: "400px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {profile?.status === "PENDING" ? (
          <>
            <AlertCircle
              size={48}
              color="var(--warning)"
              style={{ marginBottom: "16px" }}
            />
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "700",
                marginBottom: "12px",
              }}
            >
              Application Under Review
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "400px" }}>
              Your restaurant application is currently being reviewed by our
              administrative team. We will notify you once it has been approved.
            </p>
          </>
        ) : (
          <>
            <Store
              size={48}
              color="var(--border-color)"
              style={{ marginBottom: "16px" }}
            />
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "700",
                marginBottom: "12px",
              }}
            >
              No Recent Activity
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "400px" }}>
              When customers place orders from your restaurant, they will appear
              here in real-time.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
