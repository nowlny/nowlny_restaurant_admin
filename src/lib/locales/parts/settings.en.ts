/** English strings for the settings area. Every key here needs a twin in settings.ar.ts. */
export const settingsEn = {
  // ── Settings ──
  "settingsx.tab_delivery": "Delivery Zones",
  "settingsx.saves_blocked":
    "Changes can't be saved while your restaurant is in this state. Contact Nowlny support to restore it.",
  "settingsx.message_language": "Reminder text language",
  "settingsx.message_language_hint":
    "The language of the SMS we send you when an order goes unanswered.",
  "settingsx.language_ar": "Arabic",
  "settingsx.language_en": "English",
  "settingsx.unsaved": "Unsaved changes",
  "settingsx.rate_delete_title": "Delete this exchange rate?",
  "settingsx.rate_delete_body":
    "The {from} → {to} override will be removed and the platform default rate will apply.",
  "settingsx.rate_deleted": "Exchange rate deleted.",

  // ── Delivery zones ──
  "settingsx.zones_title": "Delivery Zones",
  "settingsx.zones_selector": "Delivery zones",
  "settingsx.zone_untitled": "Zone {n}",
  "settingsx.zone_add": "Add zone",
  "settingsx.zone_remove": "Remove zone",
  "settingsx.zone_remove_title": "Remove this zone?",
  "settingsx.zone_remove_body":
    "“{name}” will be deleted when you save. Orders from inside it will be refused unless another zone covers the area.",
  "settingsx.zone_too_few":
    "“{name}” needs at least 3 corners. Add more corners, or clear it.",
  "settingsx.zones_other_hint": "Your other zones are shown dashed for reference.",
  "settingsx.zones_save": "Save Zones",
  "settingsx.zones_saved": "Delivery zones saved.",

  // ── Application ──
  "appx.cancel": "Cancel application",
  "appx.cancel_title": "Cancel your application?",
  "appx.cancel_body":
    "It will be withdrawn from review. You can submit a new application at any time.",
  "appx.cancel_confirm": "Yes, cancel it",
  "appx.keep": "Keep it",
  "appx.cancelled": "Your application was cancelled.",
  "appx.cancel_failed": "We could not cancel your application. Please try again.",
} as const;
