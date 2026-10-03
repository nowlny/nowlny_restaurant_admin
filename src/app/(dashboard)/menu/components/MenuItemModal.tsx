"use client";

import React, { useId, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Busy, useFeedback } from "@/components/ui/Feedback";
import ImagePicker from "@/components/menu/ImagePicker";
import StockScheduleSelect from "@/components/menu/StockScheduleSelect";
import {
  MENU_IMAGE_ACCEPT,
  MENU_IMAGE_MAX_BYTES,
  MenuService,
  checkMenuImage,
  type MenuItem,
  type MenuItemPayload,
  type StockSchedule,
} from "@/services/api/menu";
import { getApiErrorMessage, isApiStatus } from "@/services/api/errors";
import { useI18n } from "@/lib/i18n";
import { useMenuMoney } from "@/lib/menuMoney";

interface MenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionId: string;
  /** Set when editing; null for a new dish. */
  item: MenuItem | null;
  /** A new dish goes after the section's last one, matching where the list shows it. */
  nextSortOrder: number;
  schedules: StockSchedule[];
  /** The section's schedule, which "none" falls back to. */
  sectionSchedule?: StockSchedule;
  /**
   * The saved dish, so the page can patch its list in place. `null` when the
   * API's answer couldn't be read and the section should be refetched instead.
   */
  onSaved: (item: MenuItem | null, sectionId: string) => void;
}

/** Inputs hold strings: a number state turned a cleared box into NaN. */
interface FormState {
  name: string;
  description: string;
  price: string;
  discountedPrice: string;
  image: string;
  isActive: boolean;
  isAvailable: boolean;
  isPopular: boolean;
}

type FieldErrors = Partial<Record<"name" | "price" | "discountedPrice", string>>;

const emptyForm: FormState = {
  name: "",
  description: "",
  price: "",
  discountedPrice: "",
  image: "",
  isActive: true,
  isAvailable: true,
  isPopular: false,
};

const toFormValue = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? "" : String(value);

/** Blank is `null`; anything unreadable is `NaN` so validation can catch it. */
const toNumberOrNull = (value: string): number | null => {
  const trimmed = value.trim().replace(",", ".");
  return trimmed === "" ? null : Number(trimmed);
};

export default function MenuItemModal({
  isOpen,
  onClose,
  sectionId,
  item,
  nextSortOrder,
  onSaved,
  schedules,
  sectionSchedule,
}: MenuItemModalProps) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const money = useMenuMoney();
  const formId = useId();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Seeded once: the page mounts this fresh for every dish it opens, which is
  // what keeps a previous dish's edits from leaking into the next one.
  const [form, setForm] = useState<FormState>(() =>
    item
      ? {
          name: item.name || "",
          description: item.description || "",
          price: toFormValue(item.price),
          // A stored 0 means "no sale" — showing it invites saving it back.
          discountedPrice: Number(item.discountedPrice) > 0 ? toFormValue(item.discountedPrice) : "",
          image: item.image || "",
          isActive: item.isActive !== false,
          isAvailable: item.isAvailable !== false,
          isPopular: item.isPopular === true,
        }
      : emptyForm,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [scheduleId, setScheduleId] = useState<string | null>(item?.stockScheduleId ?? null);

  /**
   * Attach / detach the dish's own schedule after it is saved. Answers with
   * the dish as the API now resolves it (its stock may have flipped). A
   * refusal (409: the dish runs a one-off) is shown in the API's words.
   */
  const applySchedule = async (itemId: string): Promise<MenuItem | null> => {
    if (scheduleId === (item?.stockScheduleId ?? null)) return null;
    try {
      return await MenuService.setItemStockSchedule(itemId, scheduleId);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t("stock.attach_failed")));
      return null;
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const validate = (): { price: number; discountedPrice: number | null } | null => {
    const next: FieldErrors = {};
    const price = toNumberOrNull(form.price);
    const discountedPrice = toNumberOrNull(form.discountedPrice);

    if (!form.name.trim()) next.name = t("menu.error_name_required");
    if (price === null || !Number.isFinite(price) || price < 0) {
      next.price = t("menu.error_price_invalid");
    }
    if (discountedPrice !== null) {
      if (!Number.isFinite(discountedPrice) || discountedPrice < 0) {
        next.discountedPrice = t("menu.error_price_invalid");
      } else if (price !== null && Number.isFinite(price) && discountedPrice >= price) {
        next.discountedPrice = t("menu.error_discount_not_lower");
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return { price: price as number, discountedPrice };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || uploading) return;
    const numbers = validate();
    if (!numbers) return;

    const payload: MenuItemPayload = {
      sectionId,
      name: form.name.trim(),
      description: form.description.trim(),
      price: numbers.price,
      discountedPrice: numbers.discountedPrice,
      isActive: form.isActive,
      isPopular: form.isPopular,
    };
    // `image: ""` fails the API's URL check, so a blank photo is left out.
    // Removing an existing one is the one case that has to say so: `null`.
    const image = form.image.trim();
    if (image) payload.image = image;
    else if (item?.image) payload.image = null;

    setSaving(true);
    try {
      if (item) {
        let saved = await MenuService.updateItem(item.id, payload);
        // Stock goes through its own endpoint, which knows about schedules.
        const wasAvailable = item.isAvailable !== false;
        if (form.isAvailable !== wasAvailable) {
          try {
            saved =
              (await MenuService.setItemStock(item.id, { isAvailable: form.isAvailable })) ?? saved;
          } catch (stockError: unknown) {
            toast.error(
              isApiStatus(stockError, 409)
                ? t("menu.stock_scheduled")
                : getApiErrorMessage(stockError, t("menu.stock_failed")),
            );
          }
        }
        const scheduled = await applySchedule(item.id);
        if (scheduled) saved = { ...(saved ?? item), ...scheduled };
        onSaved(
          saved ? { ...item, ...saved } : ({ ...item, ...payload, id: item.id } as MenuItem),
          sectionId,
        );
      } else {
        const created = await MenuService.createItem({
          ...payload,
          isAvailable: form.isAvailable,
          sortOrder: nextSortOrder,
        });
        const scheduled = created?.id ? await applySchedule(created.id) : null;
        onSaved(created && scheduled ? { ...created, ...scheduled } : created, sectionId);
      }
      toast.success(t("menu.item_saved"));
      onClose();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t("item.save_failed")));
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || uploading;
  const priceSuffix = money.code ? ` (${money.code})` : "";
  // Lira prices are whole numbers; offering cents there only invites typos.
  const priceStep = money.decimals === 0 ? "1" : "0.01";

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={item ? t("item.edit_title") : t("item.add_title")}
      dismissible={!saving}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button type="submit" form={formId} className="btn-primary" disabled={busy}>
            <Busy
              busy={saving}
              label={uploading ? t("menu.image_uploading") : t("item.save")}
              busyLabel={t("common.saving")}
            />
          </button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "18px" }}
      >
        <div className="field">
          <label htmlFor={`${formId}-name`} className="field-label">
            {t("item.name")} *
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            className="form-input"
            value={form.name}
            maxLength={200}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${formId}-name-error` : undefined}
            onChange={(e) => set("name", e.target.value)}
          />
          {errors.name && (
            <p id={`${formId}-name-error`} className="field-hint" style={{ color: "var(--error)" }}>
              {errors.name}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor={`${formId}-description`} className="field-label">
            {t("item.description")}
          </label>
          <textarea
            id={`${formId}-description`}
            className="form-input"
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <div
          className="responsive-grid-2"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}
        >
          <div className="field">
            <label htmlFor={`${formId}-price`} className="field-label">
              {t("item.price")}
              {priceSuffix} *
            </label>
            <input
              id={`${formId}-price`}
              type="number"
              inputMode="decimal"
              min={0}
              step={priceStep}
              className="form-input force-ltr"
              value={form.price}
              aria-invalid={!!errors.price}
              aria-describedby={errors.price ? `${formId}-price-error` : undefined}
              onChange={(e) => set("price", e.target.value)}
            />
            {errors.price ? (
              <p id={`${formId}-price-error`} className="field-hint" style={{ color: "var(--error)" }}>
                {errors.price}
              </p>
            ) : (
              form.price.trim() !== "" &&
              Number.isFinite(Number(form.price)) &&
              money.secondary(form.price) && (
                <p className="field-hint force-ltr">{money.secondary(form.price)}</p>
              )
            )}
          </div>
          <div className="field">
            <label htmlFor={`${formId}-discount`} className="field-label">
              {t("item.discounted_price")}
              {priceSuffix}
            </label>
            <input
              id={`${formId}-discount`}
              type="number"
              inputMode="decimal"
              min={0}
              step={priceStep}
              className="form-input force-ltr"
              value={form.discountedPrice}
              placeholder={t("common.optional")}
              aria-invalid={!!errors.discountedPrice}
              aria-describedby={`${formId}-discount-hint`}
              onChange={(e) => set("discountedPrice", e.target.value)}
            />
            <p
              id={`${formId}-discount-hint`}
              className="field-hint"
              style={errors.discountedPrice ? { color: "var(--error)" } : undefined}
            >
              {errors.discountedPrice ?? t("menu.discount_hint")}
            </p>
          </div>
        </div>

        <ImagePicker
          value={form.image}
          onChange={(url) => set("image", url)}
          upload={MenuService.uploadImage}
          accept={MENU_IMAGE_ACCEPT}
          disabled={saving}
          onUploadingChange={setUploading}
          validate={(file) => {
            const problem = checkMenuImage(file);
            if (problem === "type") return t("menu.image_bad_type");
            if (problem === "size") {
              return t("menu.image_too_large", {
                size: (file.size / (1024 * 1024)).toFixed(1),
                max: MENU_IMAGE_MAX_BYTES / (1024 * 1024),
              });
            }
            return null;
          }}
        />

        <fieldset
          style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <legend className="sr-only">{t("menu.visibility_legend")}</legend>
          {(
            [
              ["isActive", t("item.active"), t("menu.active_hint")],
              ["isAvailable", t("item.available"), t("menu.available_hint")],
              ["isPopular", t("menu.popular"), t("menu.popular_hint")],
            ] as const
          ).map(([key, label, hint]) => (
            <label
              key={key}
              htmlFor={`${formId}-${key}`}
              style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}
            >
              <input
                id={`${formId}-${key}`}
                type="checkbox"
                checked={form[key]}
                onChange={(e) => set(key, e.target.checked)}
                style={{ marginTop: "3px", accentColor: "var(--accent-primary)" }}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontWeight: 600, fontSize: "14px" }}>{label}</span>
                <span className="field-hint">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {schedules.length > 0 && (
          <StockScheduleSelect
            schedules={schedules}
            value={scheduleId}
            onChange={setScheduleId}
            hint={
              !scheduleId && sectionSchedule
                ? t("stock.follows_section_schedule", { name: sectionSchedule.name })
                : t("stock.item_schedule_hint")
            }
          />
        )}
      </form>
    </Modal>
  );
}
