import type { settingsEn } from "./settings.en";

export const settingsAr: Record<keyof typeof settingsEn, string> = {
  // ── Settings ──
  "settingsx.tab_delivery": "مناطق التوصيل",
  "settingsx.saves_blocked":
    "لا يمكن حفظ التغييرات ما دام مطعمك في هذه الحالة. تواصل مع دعم نولني لاستعادته.",
  "settingsx.message_language": "لغة رسائل التذكير",
  "settingsx.message_language_hint":
    "لغة الرسالة النصية التي نرسلها إليك عندما يبقى طلب دون رد.",
  "settingsx.language_ar": "العربية",
  "settingsx.language_en": "الإنجليزية",
  "settingsx.unsaved": "تغييرات غير محفوظة",
  "settingsx.rate_delete_title": "حذف سعر الصرف هذا؟",
  "settingsx.rate_delete_body":
    "سيُزال السعر المخصص {from} → {to} وسيُطبَّق سعر المنصة الافتراضي.",
  "settingsx.rate_deleted": "تم حذف سعر الصرف.",

  // ── Delivery zones ──
  "settingsx.zones_title": "مناطق التوصيل",
  "settingsx.zones_selector": "مناطق التوصيل",
  "settingsx.zone_untitled": "منطقة {n}",
  "settingsx.zone_add": "إضافة منطقة",
  "settingsx.zone_remove": "إزالة المنطقة",
  "settingsx.zone_remove_title": "إزالة هذه المنطقة؟",
  "settingsx.zone_remove_body":
    "سيتم حذف «{name}» عند الحفظ. ستُرفض الطلبات من داخلها ما لم تغطِّ منطقة أخرى المكان.",
  "settingsx.zone_too_few":
    "تحتاج «{name}» إلى 3 زوايا على الأقل. أضف زوايا أخرى أو امسحها.",
  "settingsx.zones_other_hint": "تظهر مناطقك الأخرى بخط متقطع للمرجعية.",
  "settingsx.zones_save": "حفظ المناطق",
  "settingsx.zones_saved": "تم حفظ مناطق التوصيل.",

  // ── Application ──
  "appx.cancel": "إلغاء الطلب",
  "appx.cancel_title": "إلغاء طلب الانضمام؟",
  "appx.cancel_body":
    "سيُسحب الطلب من المراجعة. يمكنك تقديم طلب جديد في أي وقت.",
  "appx.cancel_confirm": "نعم، ألغِه",
  "appx.keep": "الإبقاء عليه",
  "appx.cancelled": "تم إلغاء طلبك.",
  "appx.cancel_failed": "تعذّر إلغاء طلبك. يرجى المحاولة مرة أخرى.",
};
