"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  ChevronRight,
  Clock3,
  Eye,
  Globe2,
  Loader2,
  Phone,
  RefreshCw,
  Star,
  Tag,
  UtensilsCrossed,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  MenuItem,
  MenuItemOptionGroup,
  MenuSection,
  MenuService,
} from "@/services/api/menu";
import {
  RestaurantProfile,
  SettingsService,
} from "@/services/api/settings";
import { getApiErrorMessage } from "@/services/api/errors";
import styles from "./preview.module.css";

interface PreviewSection extends MenuSection {
  items: MenuItem[];
}

const toNumber = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const getDiscount = (item: MenuItem) => {
  const price = toNumber(item.price);
  const discountedPrice = toNumber(item.discountedPrice);
  return discountedPrice > 0 && discountedPrice < price
    ? discountedPrice
    : null;
};

export default function MenuPreviewPage() {
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [sections, setSections] = useState<PreviewSection[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [optionGroups, setOptionGroups] = useState<MenuItemOptionGroup[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const optionRequestId = useRef(0);

  const closeItemDetails = useCallback(() => {
    optionRequestId.current += 1;
    setSelectedItem(null);
    setOptionGroups([]);
    setLoadingOptions(false);
  }, []);

  const loadPreview = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const profile = await SettingsService.getOwnRestaurant();
      const sectionData = await MenuService.getSectionsByRestaurant(profile.id);
      const visibleSections = sectionData
        .filter((section) => section.isActive !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      const sectionsWithItems = await Promise.all(
        visibleSections.map(async (section) => {
          const items = await MenuService.getItemsBySection(section.id);
          return {
            ...section,
            items: items
              .filter((item) => item.isActive !== false)
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
          };
        }),
      );

      const customerVisibleSections = sectionsWithItems.filter(
        (section) => section.items.length > 0,
      );
      setRestaurant(profile);
      setSections(customerVisibleSections);
      setActiveSectionId(customerVisibleSections[0]?.id ?? null);
    } catch (previewError: unknown) {
      setError(
        getApiErrorMessage(
          previewError,
          "We could not load the customer menu preview.",
        ),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialRequest = window.setTimeout(() => {
      void loadPreview();
    }, 0);

    return () => window.clearTimeout(initialRequest);
  }, [loadPreview]);

  useEffect(() => {
    if (!selectedItem) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeItemDetails();
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeItemDetails, selectedItem]);

  const formatPrice = (value: number | string | null | undefined) => {
    const amount = toNumber(value);
    const currencyCode = restaurant?.currency?.code?.toUpperCase() || "LBP";

    if (currencyCode === "USD") return `$${amount.toFixed(2)}`;
    if (currencyCode === "LBP") {
      return `${Math.round(amount).toLocaleString("en-US")} L.L.`;
    }

    return `${amount.toFixed(2)} ${restaurant?.currency?.symbol || currencyCode}`;
  };

  const openItemDetails = async (item: MenuItem) => {
    if (item.isAvailable === false) return;

    const requestId = ++optionRequestId.current;
    setSelectedItem(item);
    setOptionGroups([]);
    setLoadingOptions(true);

    try {
      const groups = await MenuService.getOptionGroupsByItem(item.id);
      if (requestId === optionRequestId.current) {
        setOptionGroups(
          [...groups].sort(
            (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
          ),
        );
      }
    } catch {
      if (requestId === optionRequestId.current) setOptionGroups([]);
    } finally {
      if (requestId === optionRequestId.current) setLoadingOptions(false);
    }
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handlePreviewScroll = () => {
    const scroller = previewScrollRef.current;
    if (!scroller || sections.length === 0) return;

    const threshold = scroller.getBoundingClientRect().top + 128;
    let visibleSectionId = sections[0].id;
    sections.forEach((section) => {
      const node = sectionRefs.current[section.id];
      if (node && node.getBoundingClientRect().top <= threshold) {
        visibleSectionId = section.id;
      }
    });
    setActiveSectionId(visibleSectionId);
  };

  if (loading) {
    return (
      <div className={styles.centerState}>
        <Loader2 className="animate-spin" size={34} />
        <strong>Building the customer preview…</strong>
        <span>Loading your restaurant and customer-visible menu.</span>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className={styles.centerState}>
        <div className={styles.errorIcon}>!</div>
        <strong>Preview unavailable</strong>
        <span>{error || "Restaurant information is unavailable."}</span>
        <button className="btn-primary" onClick={() => void loadPreview()}>
          <RefreshCw size={18} /> Try again
        </button>
        <Link className="btn-outline" href="/menu">
          Back to menu
        </Link>
      </div>
    );
  }

  const deliveryFee = toNumber(restaurant.deliveryFee);
  const rating = toNumber(restaurant.rating);
  const deliveryTime =
    restaurant.deliveryTimeRange ||
    `${toNumber(restaurant.deliveryTimeMinMinutes)}–${toNumber(
      restaurant.deliveryTimeMaxMinutes,
    )} min`;

  return (
    <div className={`${styles.page} animate-fade-in`}>
      <header className={styles.pageHeader}>
        <div>
          <Link className={styles.backLink} href="/menu">
            <ArrowLeft size={17} /> Menu management
          </Link>
          <h1>Customer Menu Preview</h1>
          <p>See the menu exactly as a customer can browse it.</p>
        </div>
        <button
          className="btn-outline"
          disabled={refreshing}
          onClick={() => void loadPreview(true)}
        >
          <RefreshCw
            className={refreshing ? "animate-spin" : undefined}
            size={18}
          />
          {refreshing ? "Refreshing…" : "Refresh preview"}
        </button>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.previewGuide}>
          <div className={styles.guideIcon}>
            <Eye size={22} />
          </div>
          <h2>Customer view</h2>
          <p>
            This preview is read-only and follows the same visibility rules as
            the customer app.
          </p>
          <ul>
            <li>Inactive sections and items are hidden.</li>
            <li>Unavailable items appear as out of stock.</li>
            <li>Tap an item to preview its options.</li>
          </ul>
          <Link className="btn-primary" href="/menu">
            Edit menu
          </Link>
        </aside>

        <div className={styles.deviceShell}>
          <div className={styles.deviceSpeaker} />
          <div
            className={styles.previewScroller}
            onScroll={handlePreviewScroll}
            ref={previewScrollRef}
          >
            <div className={styles.previewTopBar}>
              <div>
                <span>Customer Preview</span>
                <small>Read-only experience</small>
              </div>
              <span className={styles.previewBadge}>
                <Eye size={12} /> Preview
              </span>
            </div>

            <section className={styles.restaurantHeader}>
              <div
                aria-label={`${restaurant.name} cover image`}
                className={styles.cover}
                role="img"
                style={
                  restaurant.backgroundImageUrl
                    ? {
                        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.22)), url("${restaurant.backgroundImageUrl}")`,
                      }
                    : undefined
                }
              >
                {!restaurant.backgroundImageUrl && (
                  <span>{restaurant.name.charAt(0).toUpperCase()}</span>
                )}
                {restaurant.isOpen !== undefined && (
                  <span
                    className={`${styles.openBadge} ${
                      restaurant.isOpen ? styles.isOpen : styles.isClosed
                    }`}
                  >
                    {restaurant.isOpen ? "Open now" : "Closed"}
                  </span>
                )}
              </div>

              <div className={styles.restaurantInfo}>
                <div
                  aria-label={`${restaurant.name} logo`}
                  className={styles.restaurantLogo}
                  role="img"
                  style={
                    restaurant.logo
                      ? { backgroundImage: `url("${restaurant.logo}")` }
                      : undefined
                  }
                >
                  {!restaurant.logo && (
                    <span>{restaurant.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <h2>{restaurant.name}</h2>
                {(rating > 0 || (restaurant.totalRatings ?? 0) > 0) && (
                  <div className={styles.ratingRow}>
                    <Star size={15} fill="currentColor" />
                    <strong>{rating.toFixed(1)}</strong>
                    <span>({restaurant.totalRatings ?? 0} ratings)</span>
                  </div>
                )}
                {restaurant.description && <p>{restaurant.description}</p>}

                <div className={styles.infoChips}>
                  <span>
                    <Bike size={14} />
                    {deliveryFee === 0
                      ? "Free delivery"
                      : `${formatPrice(deliveryFee)} delivery`}
                  </span>
                  <span>
                    <Clock3 size={14} /> {deliveryTime}
                  </span>
                  {restaurant.phone && (
                    <span>
                      <Phone size={14} /> {restaurant.phone}
                    </span>
                  )}
                  {restaurant.website && (
                    <span>
                      <Globe2 size={14} /> Website
                    </span>
                  )}
                </div>
              </div>
            </section>

            {sections.length > 0 ? (
              <>
                <nav aria-label="Menu sections" className={styles.categoryNav}>
                  {sections.map((section) => (
                    <button
                      className={
                        activeSectionId === section.id ? styles.activeTab : ""
                      }
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      type="button"
                    >
                      {section.name}
                    </button>
                  ))}
                </nav>

                <main className={styles.menuContent}>
                  {sections.map((section) => (
                    <section
                      className={styles.menuSection}
                      key={section.id}
                      ref={(node) => {
                        sectionRefs.current[section.id] = node;
                      }}
                    >
                      <div className={styles.sectionHeading}>
                        <h3>{section.name}</h3>
                        {section.description && <p>{section.description}</p>}
                      </div>

                      <div>
                        {section.items.map((item) => {
                          const discount = getDiscount(item);
                          return (
                            <button
                              className={styles.itemRow}
                              disabled={item.isAvailable === false}
                              key={item.id}
                              onClick={() => void openItemDetails(item)}
                              type="button"
                            >
                              <span className={styles.itemCopy}>
                                <span className={styles.itemNameRow}>
                                  <strong>{item.name}</strong>
                                  {item.isPopular && (
                                    <span className={styles.popularPill}>
                                      <Star size={10} fill="currentColor" /> Popular
                                    </span>
                                  )}
                                </span>
                                {item.description && <small>{item.description}</small>}
                                <span className={styles.priceRow}>
                                  <strong>
                                    {formatPrice(discount ?? item.price)}
                                  </strong>
                                  {discount !== null && (
                                    <del>{formatPrice(item.price)}</del>
                                  )}
                                </span>
                              </span>

                              <span
                                className={`${styles.itemImage} ${
                                  item.isAvailable === false
                                    ? styles.unavailableImage
                                    : ""
                                }`}
                                style={
                                  item.image
                                    ? { backgroundImage: `url("${item.image}")` }
                                    : undefined
                                }
                              >
                                {!item.image && <UtensilsCrossed size={26} />}
                                {discount !== null && (
                                  <span className={styles.saleBadge}>
                                    <Tag size={9} /> Sale
                                  </span>
                                )}
                                {item.isAvailable === false ? (
                                  <span className={styles.outOfStock}>
                                    Out of stock
                                  </span>
                                ) : (
                                  <ChevronRight
                                    className={styles.itemChevron}
                                    size={17}
                                  />
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </main>
              </>
            ) : (
              <div className={styles.emptyMenu}>
                <UtensilsCrossed size={34} />
                <h3>No customer-visible menu yet</h3>
                <p>
                  Add active sections and items to see the customer experience.
                </p>
                <Link href="/menu">Go to menu management</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedItem && (
        <div
          aria-label="Menu item preview"
          aria-modal="true"
          className={styles.modalBackdrop}
          onClick={closeItemDetails}
          role="dialog"
        >
          <div className={styles.itemModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHandle} />
            <button
              aria-label="Close item preview"
              className={styles.closeButton}
              onClick={closeItemDetails}
              type="button"
            >
              <X size={20} />
            </button>

            <div
              className={styles.detailImage}
              style={
                selectedItem.image
                  ? { backgroundImage: `url("${selectedItem.image}")` }
                  : undefined
              }
            >
              {!selectedItem.image && <UtensilsCrossed size={42} />}
            </div>

            <div className={styles.modalBody}>
              <div className={styles.detailNameRow}>
                <h2>{selectedItem.name}</h2>
                {selectedItem.isPopular && (
                  <span className={styles.popularPill}>
                    <Star size={10} fill="currentColor" /> Popular
                  </span>
                )}
              </div>
              {selectedItem.description && <p>{selectedItem.description}</p>}
              <div className={styles.detailPrice}>
                <strong>
                  {formatPrice(getDiscount(selectedItem) ?? selectedItem.price)}
                </strong>
                {getDiscount(selectedItem) !== null && (
                  <del>{formatPrice(selectedItem.price)}</del>
                )}
              </div>

              <div className={styles.modalDivider} />

              {loadingOptions ? (
                <div className={styles.optionsState}>
                  <Loader2 className="animate-spin" size={24} /> Loading options…
                </div>
              ) : optionGroups.length === 0 ? (
                <div className={styles.optionsState}>No add-ons for this item.</div>
              ) : (
                <div className={styles.optionGroups}>
                  {optionGroups.map((group) => (
                    <section key={group.id}>
                      <div className={styles.optionGroupHeader}>
                        <div>
                          <h3>{group.name}</h3>
                          <span>
                            {group.type === "radio" ? "Choose 1" : "Multi-select"}
                          </span>
                        </div>
                        <span
                          className={
                            group.isRequired
                              ? styles.requiredPill
                              : styles.optionalPill
                          }
                        >
                          {group.isRequired ? "Required" : "Optional"}
                        </span>
                      </div>
                      {[...(group.options ?? [])]
                        .sort(
                          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
                        )
                        .map((option) => (
                          <div className={styles.optionRow} key={option.id}>
                            <span
                              className={
                                group.type === "radio"
                                  ? styles.radioIndicator
                                  : styles.checkboxIndicator
                              }
                            />
                            <span>{option.name}</span>
                            {toNumber(option.price) > 0 && (
                              <strong>+{formatPrice(option.price)}</strong>
                            )}
                          </div>
                        ))}
                    </section>
                  ))}
                </div>
              )}

              <div className={styles.previewNotice}>
                <Eye size={14} /> Preview mode — no actions available
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
