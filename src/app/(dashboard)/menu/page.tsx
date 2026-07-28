"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Edit2,
  Trash2,
  Settings,
  Image as ImageIcon,
  Sparkles,
  UploadCloud,
  Check,
  AlertCircle,
  FolderPlus,
  Eye,
} from "lucide-react";
import { MenuService } from "@/services/api/menu";
import { SettingsService } from "@/services/api/settings";
import MenuItemModal from "./components/MenuItemModal";
import OptionGroupsDrawer from "./components/OptionGroupsDrawer";
import { useI18n } from "@/lib/i18n";

interface ParsedMenuData {
  name: string;
  type: "pdf" | "excel" | "image";
  size: string;
  categories: {
    name: string;
    items: {
      name: string;
      description?: string;
      price: number;
      image?: string;
      isAvailable: boolean;
      addons?: {
        name: string;
        price?: number;
      }[];
    }[];
  }[];
}

export default function MenuPage() {
  const { t } = useI18n();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Section Modal State
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<any>(null);
  const [sectionForm, setSectionForm] = useState({ name: "", description: "" });

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Option Groups Drawer State
  const [isOptionGroupsOpen, setIsOptionGroupsOpen] = useState(false);
  const [activeItemForOptions, setActiveItemForOptions] = useState<any>(null);

  // AI Parsing states
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("nowlny_gemini_key") || "";
    }
    return "";
  });

  const handleUpdateApiKey = (key: string) => {
    setGeminiApiKey(key);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("nowlny_gemini_key", key);
    }
  };

  const [customFileName, setCustomFileName] = useState<string>("");
  const [isParsing, setIsParsing] = useState(false);
  const [isIntegrating, setIsIntegrating] = useState(false);
  const [parsingStep, setParsingStep] = useState<string>("");
  const [parseProgress, setParseProgress] = useState(0);
  const [parsedData, setParsedData] = useState<ParsedMenuData | null>(null);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<{
    name: string;
    base64Data: string;
    fileMime: string;
    fileSize: string;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const profile = await SettingsService.getOwnRestaurant();
      if (profile?.id) {
        setRestaurantId(profile.id);
        await fetchSections(profile.id);
      }
    } catch (err) {
      console.error("Failed to fetch restaurant profile", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async (restId: string) => {
    try {
      const data = await MenuService.getSectionsByRestaurant(restId);
      // Fetch items for each section in parallel to display them inline
      const sectionsWithItems = await Promise.all(
        data.map(async (section: any) => {
          const items = await MenuService.getItemsBySection(section.id);
          return { ...section, items };
        }),
      );
      setSections(sectionsWithItems);
    } catch (err) {
      console.error("Failed to fetch sections", err);
    }
  };

  const handleSaveSection = async () => {
    if (!restaurantId) return;
    try {
      if (editingSection) {
        await MenuService.updateSection(editingSection.id, sectionForm);
      } else {
        await MenuService.createSection({ ...sectionForm, restaurantId });
      }
      setIsSectionModalOpen(false);
      setEditingSection(null);
      fetchSections(restaurantId);
    } catch (err) {
      console.error("Failed to save section", err);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (confirm(t("menu.confirm_delete_section"))) {
      try {
        await MenuService.deleteSection(sectionId);
        if (restaurantId) fetchSections(restaurantId);
      } catch (err) {
        console.error("Failed to delete section", err);
      }
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (confirm(t("menu.confirm_delete_item"))) {
      try {
        await MenuService.deleteItem(itemId);
        if (restaurantId) fetchSections(restaurantId);
      } catch (err) {
        console.error("Failed to delete item", err);
      }
    }
  };

  // Real Google Gemini 1.5 Flash API scanner
  const runLiveGeminiScan = async (
    fileName: string,
    base64Data: string,
    fileMime: string,
    fileSize: string,
  ) => {
    setIsParsing(true);
    setParseProgress(10);
    setParsingStep(t("parser.step_connecting"));
    setParsedData(null);
    setParseSuccess(false);
    setParsingError(null);

    // Dynamic scanning progress steps simulator
    let currentProgress = 10;
    const progressInterval = setInterval(() => {
      if (currentProgress < 95) {
        currentProgress += Math.floor(Math.random() * 5) + 2;
        setParseProgress(Math.min(95, currentProgress));

        if (currentProgress > 25 && currentProgress <= 45) {
          setParsingStep(t("parser.step_vision"));
        } else if (currentProgress > 45 && currentProgress <= 70) {
          setParsingStep(t("parser.step_ocr"));
        } else if (currentProgress > 70) {
          setParsingStep(t("parser.step_structuring"));
        }
      }
    }, 300);

    try {
      const response = await fetch("/api/parse-menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: fileMime,
          customApiKey: geminiApiKey,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(
          errorBody.error || t("parser.scan_failed"),
        );
      }

      const parsedResult = await response.json();

      setParseProgress(100);
      setParsingStep(t("parser.step_done"));

      setTimeout(() => {
        setIsParsing(false);
        setParsedData({
          name: fileName,
          type: fileMime.includes("pdf")
            ? "pdf"
            : fileMime.includes("sheet") ||
                fileMime.includes("excel") ||
                fileMime.includes("csv")
              ? "excel"
              : "image",
          size: fileSize,
          categories: parsedResult.categories || [],
        });
        setParseSuccess(true);
      }, 500);
    } catch (err: any) {
      clearInterval(progressInterval);
      setIsParsing(false);

      let friendlyMessage = err.message;
      if (err.message.includes("Gemini API responded with error:")) {
        try {
          const jsonStartIndex = err.message.indexOf("{");
          if (jsonStartIndex !== -1) {
            const rawJson = err.message.substring(jsonStartIndex);
            const errorObj = JSON.parse(rawJson);
            if (errorObj?.error?.message) {
              friendlyMessage = errorObj.error.message;
            }
          }
        } catch (e) {}
      }

      setParsingError(friendlyMessage);
    }
  };

  const handleRetryScan = async () => {
    if (!lastUploadedFile) return;
    await runLiveGeminiScan(
      lastUploadedFile.name,
      lastUploadedFile.base64Data,
      lastUploadedFile.fileMime,
      lastUploadedFile.fileSize,
    );
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const mockSize = (file.size / (1024 * 1024)).toFixed(1) + " MB";

      setCustomFileName(file.name);
      setParsingError(null);

      const reader = new FileReader();
      reader.onload = async () => {
        if (reader.result) {
          const base64Data = (reader.result as string).split(",")[1];
          setLastUploadedFile({
            name: file.name,
            base64Data,
            fileMime: file.type || "image/png",
            fileSize: mockSize,
          });
          await runLiveGeminiScan(
            file.name,
            base64Data,
            file.type || "image/png",
            mockSize,
          );
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApproveParsedMenu = async () => {
    if (!parsedData || !restaurantId) return;

    setIsIntegrating(true);
    try {
      let currentSections = [...sections];

      for (const parsedCat of parsedData.categories) {
        let existingSec = currentSections.find(
          (s) => s.name.toLowerCase() === parsedCat.name.toLowerCase(),
        );
        let sectionId = existingSec?.id;

        if (!existingSec) {
          try {
            const newSec = await MenuService.createSection({
              restaurantId,
              name: parsedCat.name,
              sortOrder: currentSections.length,
            });
            sectionId = newSec.id;
            currentSections.push(newSec);
          } catch (err: any) {
            console.error(err);
          }
        }

        if (!sectionId) continue;

        for (const [idx, item] of parsedCat.items.entries()) {
          try {
            const newItem = await MenuService.createItem({
              sectionId,
              name: item.name,
              description: item.description || "",
              price: item.price || 0,
              image: item.image,
              isAvailable: item.isAvailable ?? true,
              sortOrder: idx,
            });

            // Handle extracted addons by creating an Option Group
            if (item.addons && Array.isArray(item.addons) && item.addons.length > 0) {
              const optionGroup = await MenuService.createOptionGroup({
                menuItemId: newItem.id,
                name: t("parser.addons_group"),
                type: "checkbox",
                isRequired: false,
              });

              if (optionGroup && optionGroup.id) {
                for (const addon of item.addons) {
                  await MenuService.addOptionToGroup(optionGroup.id, {
                    name: addon.name,
                    price: addon.price || 0,
                  });
                }
              }
            }
          } catch (err: any) {
            console.error(err);
          }
        }
      }

      await fetchSections(restaurantId);

      setParsedData(null);
      setCustomFileName("");
      setParseSuccess(false);
      setLastUploadedFile(null);
      alert(t("parser.integrated"));
    } catch (err) {
      console.error(err);
      alert(t("parser.integrate_failed"));
    } finally {
      setIsIntegrating(false);
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
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{ fontSize: "32px", fontWeight: "700", marginBottom: "8px" }}
          >
            {t("menu.title")}
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            {t("menu.subtitle")}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link className="btn-outline" href="/menu/preview">
            <Eye size={20} /> {t("menu.customer_preview")}
          </Link>
          <button
            className="btn-primary"
            onClick={() => {
              setEditingSection(null);
              setSectionForm({ name: "", description: "" });
              setIsSectionModalOpen(true);
            }}
          >
            <Plus size={20} /> {t("menu.add_section")}
          </button>
        </div>
      </header>

      {/* AI MENU UPLOADER / PARSER SECTION */}
      <div
        className="responsive-flex-wrap"
        style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}
      >
        <div
          className="glass-panel"
          style={{
            flex: parsedData ? "1 1 40%" : "1 1 100%",
            padding: "24px",
            transition: "all 0.3s ease",
          }}
        >
          <div
            className="responsive-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "rgba(168, 85, 247, 0.1)",
                  color: "#a855f7",
                  borderRadius: "12px",
                }}
              >
                <Sparkles size={24} className="animate-pulse" />
              </div>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "700" }}>
                  {t("parser.title")}
                </h3>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                  {t("parser.subtitle")}
                </p>
              </div>
            </div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "800",
                textTransform: "uppercase",
                letterSpacing: "1px",
                padding: "4px 8px",
                backgroundColor: "rgba(168, 85, 247, 0.1)",
                color: "#a855f7",
                borderRadius: "4px",
                border: "1px solid rgba(168, 85, 247, 0.2)",
              }}
              className="animate-pulse"
            >
              {t("parser.badge")}
            </span>
          </div>

          {parsingError && (
            <div
              style={{
                padding: "16px",
                backgroundColor: "rgba(239, 68, 68, 0.05)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "12px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  color: "var(--error)",
                }}
              >
                <AlertCircle size={20} />
                <div>
                  <p style={{ fontWeight: "700", marginBottom: "4px" }}>
                    {t("parser.failure_title")}
                  </p>
                  <p
                    style={{ fontSize: "14px", color: "var(--text-secondary)" }}
                  >
                    {parsingError}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                {lastUploadedFile && (
                  <button
                    onClick={handleRetryScan}
                    disabled={isParsing}
                    className="btn-primary"
                    style={{
                      backgroundColor: "var(--error)",
                      padding: "8px 16px",
                      fontSize: "14px",
                    }}
                  >
                    {isParsing && (
                      <Loader2 size={16} className="animate-spin" />
                    )}{" "}
                    {t("parser.retry")}
                  </button>
                )}
                <button
                  onClick={() => setParsingError(null)}
                  className="btn-outline"
                  style={{ padding: "8px 16px", fontSize: "14px" }}
                >
                  {t("parser.dismiss")}
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              marginBottom: "24px",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                fontWeight: "800",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "8px",
              }}
            >
              {t("parser.credentials")}
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginBottom: "16px",
              }}
            >
              {t("parser.credentials_hint")}
            </p>
            <input
              type="password"
              placeholder={t("parser.api_key_placeholder")}
              value={geminiApiKey}
              onChange={(e) => handleUpdateApiKey(e.target.value)}
              className="form-input"
              style={{ marginBottom: "8px", padding: "10px 14px" }}
            />
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {t("parser.api_key_note_before")}
              <code>GEMINI_API_KEY</code>
              {t("parser.api_key_note_after")}
            </p>
          </div>

          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px",
              border: "2px dashed var(--border-color)",
              borderRadius: "16px",
              backgroundColor: "var(--bg-surface)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              textAlign: "center",
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = "#a855f7")}
            onMouseOut={(e) =>
              (e.currentTarget.style.borderColor = "var(--border-color)")
            }
          >
            <UploadCloud
              size={48}
              color="var(--text-muted)"
              style={{ marginBottom: "16px" }}
            />
            <p style={{ fontWeight: "600", marginBottom: "4px" }}>
              {t("parser.drop_title")}
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginBottom: "16px",
              }}
            >
              {t("parser.drop_hint")}
            </p>
            <div
              className="btn-outline"
              style={{ padding: "8px 16px", fontSize: "14px" }}
            >
              {t("parser.browse")}
            </div>
            <input
              type="file"
              accept=".pdf, .xlsx, .xls, .csv, .png, .jpg, .jpeg, .webp"
              onChange={handleCustomFileUpload}
              style={{ display: "none" }}
            />
          </label>

          {isParsing && (
            <div
              style={{
                marginTop: "24px",
                padding: "16px",
                backgroundColor: "rgba(168, 85, 247, 0.05)",
                border: "1px solid rgba(168, 85, 247, 0.2)",
                borderRadius: "12px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                className="flex-col-mobile"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#a855f7",
                  marginBottom: "12px",
                }}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <Loader2 size={16} className="animate-spin" /> {parsingStep}
                </span>
                <span>{parseProgress}%</span>
              </div>
              <div
                style={{
                  height: "6px",
                  backgroundColor: "var(--bg-surface)",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    backgroundColor: "#a855f7",
                    width: `${parseProgress}%`,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {parsedData && (
          <div
            className="glass-panel animate-fade-in"
            style={{
              flex: "1 1 50%",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="responsive-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "16px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <div
                  style={{
                    padding: "8px",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    color: "var(--success)",
                    borderRadius: "8px",
                  }}
                >
                  <Check size={20} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {t("parser.preview_title")}
                  </h3>
                  <p
                    style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                  >
                    {t("parser.source", { name: parsedData.name })}
                  </p>
                </div>
              </div>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "800",
                  color: "var(--success)",
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                {t("parser.confidence")}
              </span>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                maxHeight: "400px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {parsedData.categories.map((cat, idx) => (
                <div key={idx}>
                  <h4
                    style={{
                      fontSize: "12px",
                      fontWeight: "800",
                      color: "#a855f7",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "12px",
                    }}
                  >
                    <FolderPlus size={16} /> {t("parser.category", { name: cat.name })}
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {cat.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex-col-mobile"
                        style={{
                          padding: "12px",
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <p style={{ fontWeight: "700", fontSize: "14px" }}>
                            {item.name}
                          </p>
                          <p
                            style={{
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                              marginTop: "4px",
                            }}
                          >
                            {item.description}
                          </p>
                          {item.addons && item.addons.length > 0 && (
                            <div style={{ marginTop: "8px" }}>
                              <p style={{ fontSize: "12px", fontWeight: "600", color: "#a855f7", marginBottom: "4px" }}>{t("parser.addons")}</p>
                              <ul style={{ fontSize: "11px", color: "var(--text-secondary)", paddingInlineStart: "16px", margin: 0 }}>
                                {item.addons.map((addon, aIdx) => (
                                  <li key={aIdx}>{addon.name} (+${addon.price?.toFixed(2) || "0.00"})</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <span
                          style={{
                            fontWeight: "800",
                            color: "var(--accent-primary)",
                            marginInlineStart: "12px",
                          }}
                        >
                          ${item.price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="flex-col-mobile"
              style={{
                display: "flex",
                gap: "12px",
                borderTop: "1px solid var(--border-color)",
                paddingTop: "16px",
                marginTop: "16px",
              }}
            >
              <button
                onClick={() => {
                  setParsedData(null);
                  setCustomFileName("");
                }}
                className="btn-outline"
                style={{ flex: 1 }}
                disabled={isIntegrating}
              >
                {t("parser.discard")}
              </button>
              <button
                onClick={handleApproveParsedMenu}
                className="btn-primary"
                style={{ flex: 2, backgroundColor: "#a855f7", border: "none" }}
                disabled={isIntegrating}
              >
                {isIntegrating ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Check size={18} />
                )}{" "}
                {t("parser.approve")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section Form Inline */}
      {isSectionModalOpen && (
        <div
          className="glass-panel"
          style={{
            padding: "24px",
            backgroundColor: "var(--bg-elevated)",
            marginBottom: "16px",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              marginBottom: "16px",
            }}
          >
            {editingSection ? t("menu.edit_section") : t("menu.new_section")}
          </h3>
          <div
            className="flex-col-mobile"
            style={{ display: "flex", gap: "16px", marginBottom: "16px" }}
          >
            <input
              type="text"
              className="form-input"
              placeholder={t("menu.section_name_placeholder")}
              style={{ flex: 1 }}
              value={sectionForm.name}
              onChange={(e) =>
                setSectionForm({ ...sectionForm, name: e.target.value })
              }
            />
            <input
              type="text"
              className="form-input"
              placeholder={t("menu.section_description_placeholder")}
              style={{ flex: 2 }}
              value={sectionForm.description}
              onChange={(e) =>
                setSectionForm({ ...sectionForm, description: e.target.value })
              }
            />
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <button className="btn-primary" onClick={handleSaveSection}>
              {t("menu.save_section")}
            </button>
            <button
              className="btn-outline"
              onClick={() => setIsSectionModalOpen(false)}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

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
      ) : sections.length === 0 ? (
        <div
          className="glass-panel"
          style={{ padding: "40px", textAlign: "center" }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            {t("menu.empty")}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {sections.map((section: any) => (
            <div
              key={section.id}
              className="glass-panel"
              style={{ padding: "24px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid var(--border-color)",
                  paddingBottom: "16px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: "600" }}>
                    {section.name}
                  </h3>
                  {section.description && (
                    <p
                      style={{
                        fontSize: "14px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {section.description}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => {
                      setEditingSection(section);
                      setSectionForm({
                        name: section.name,
                        description: section.description || "",
                      });
                      setIsSectionModalOpen(true);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Edit2 size={16} /> {t("common.edit")}
                  </button>
                  <button
                    onClick={() => handleDeleteSection(section.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--error)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Trash2 size={16} /> {t("common.delete")}
                  </button>
                </div>
              </div>

              <div
                className="responsive-grid-2"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "16px",
                  marginBottom: "16px",
                }}
              >
                {(section.items || []).map((item: any) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid var(--border-color)",
                      borderRadius: "12px",
                      padding: "16px",
                      display: "flex",
                      gap: "16px",
                      backgroundColor: "var(--bg-elevated)",
                    }}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{
                          width: "80px",
                          height: "80px",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "80px",
                          height: "80px",
                          backgroundColor: "var(--bg-surface)",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-muted)",
                        }}
                      >
                        <ImageIcon size={24} />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: "600", marginBottom: "4px" }}>
                        {item.name}
                      </h4>
                      <p
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "14px",
                          marginBottom: "8px",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.description}
                      </p>
                      <div
                        style={{
                          fontWeight: "600",
                          color: "var(--accent-primary)",
                        }}
                      >
                        ${item.price}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          marginTop: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => {
                            setActiveSectionId(section.id);
                            setEditingItem(item);
                            setIsItemModalOpen(true);
                          }}
                          className="btn-outline"
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            flex: 1,
                            justifyContent: "center",
                          }}
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          onClick={() => {
                            setActiveItemForOptions(item);
                            setIsOptionGroupsOpen(true);
                          }}
                          className="btn-outline"
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            flex: 1,
                            justifyContent: "center",
                          }}
                        >
                          {t("menu.options")}
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="btn-outline"
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            flex: "0 0 auto",
                            color: "var(--error)",
                            borderColor: "var(--error)",
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setActiveSectionId(section.id);
                  setEditingItem(null);
                  setIsItemModalOpen(true);
                }}
                className="btn-outline"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  borderStyle: "dashed",
                }}
              >
                <Plus size={18} /> {t("menu.add_item_to", { section: section.name })}
              </button>
            </div>
          ))}
        </div>
      )}

      {activeSectionId && (
        <MenuItemModal
          isOpen={isItemModalOpen}
          onClose={() => setIsItemModalOpen(false)}
          sectionId={activeSectionId}
          item={editingItem}
          onSave={() => restaurantId && fetchSections(restaurantId)}
        />
      )}

      {activeItemForOptions && (
        <OptionGroupsDrawer
          isOpen={isOptionGroupsOpen}
          onClose={() => setIsOptionGroupsOpen(false)}
          itemId={activeItemForOptions.id}
          itemName={activeItemForOptions.name}
        />
      )}
    </div>
  );
}
