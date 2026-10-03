import type { menuEn } from "./menu.en";

export const menuAr: Record<keyof typeof menuEn, string> = {
  // ── Menu page ──
  "menu.load_failed": "تعذّر تحميل قائمة الطعام.",
  "menu.empty_title": "قائمتك فارغة",
  "menu.section_empty": "لا توجد أطباق في هذا القسم بعد.",
  "menu.search_label": "البحث في الأطباق",
  "menu.search_placeholder": "ابحث في الأطباق والأقسام…",
  "menu.search_clear": "مسح البحث",
  "menu.search_empty": "لا يوجد في القائمة ما يطابق «{query}».",
  "menu.badge_hidden": "مخفي",
  "menu.popular": "رائج",
  "menu.edit_section_aria": "تعديل القسم {name}",
  "menu.delete_section_aria": "حذف القسم {name}",
  "menu.delete_section_with_items": "سيتم حذف «{name}» و{count} من الأطباق فيه نهائيًا.",
  "menu.edit_item_aria": "تعديل {name}",
  "menu.delete_item_aria": "حذف {name}",
  "menu.options_aria": "مجموعات الخيارات لـ {name}",
  "menu.section_saved": "تم حفظ القسم.",
  "menu.section_save_failed": "تعذّر حفظ القسم.",
  "menu.section_deleted": "تم حذف القسم.",
  "menu.item_saved": "تم حفظ الطبق.",
  "menu.item_deleted": "تم حذف الطبق.",
  "menu.delete_failed": "تعذّر الحذف. يرجى المحاولة مرة أخرى.",

  // ── Section form ──
  "menu.section_name": "اسم القسم",
  "menu.section_active_hint": "الأقسام المخفية وأطباقها لا تظهر للزبائن.",

  // ── Dish form ──
  "menu.error_name_required": "أدخل اسمًا.",
  "menu.error_price_invalid": "أدخل سعرًا يساوي 0 أو أكثر.",
  "menu.error_discount_not_lower": "يجب أن يكون سعر العرض أقل من السعر العادي.",
  "menu.discount_hint": "اتركه فارغًا إذا لم يكن الطبق عليه عرض.",
  "menu.visibility_legend": "الظهور",
  "menu.active_hint": "يظهر في قائمتك. أوقفه لإخفاء الطبق دون حذفه.",
  "menu.available_hint": "يمكن للزبائن طلبه الآن.",
  "menu.popular_hint": "يُبرز للزبائن كطبق مفضّل.",

  // ── Stock ──
  "menu.in_stock": "متوفر",
  "menu.out_of_stock": "غير متوفر",
  "menu.stock_toggle_aria": "{name} متوفر",
  "menu.stock_failed": "تعذّر تغيير حالة التوفر.",
  "menu.stock_scheduled": "هذا الطبق يتبع جدول توفر، لذا لا يمكن تغيير توفره بهذه الطريقة الآن.",

  // ── Sorting ──
  "menu.sort_handle_aria": "إعادة ترتيب {name}. اسحب، أو استخدم مفتاحي الأسهم للأعلى وللأسفل.",
  "menu.sort_handle_title": "اسحب لإعادة الترتيب",
  "menu.sort_hint": "اسحب المقابض لإعادة الترتيب — أو أفلت طبقًا على قسم آخر لنقله.",
  "menu.sort_blocked_search": "امسح البحث لإعادة الترتيب.",
  "menu.sort_failed": "تعذّر حفظ الترتيب الجديد.",
  "menu.item_moved": "تم نقل «{name}» إلى {section}.",

  // ── Option groups ──
  "menu.group_type": "نوع الاختيار",
  "menu.options_load_failed": "تعذّر تحميل مجموعات الخيارات.",
  "menu.options_save_failed": "تعذّر الحفظ. يرجى المحاولة مرة أخرى.",
  "menu.options_delete_failed": "تعذّر الحذف. يرجى المحاولة مرة أخرى.",

  // ── Dish photo ──
  "menu.image_label": "الصورة",
  "menu.image_hint": "أفلت أو الصق أو ارفع صورة JPEG أو PNG أو WebP أو AVIF حتى 5 ميغابايت.",
  "menu.image_use_url": "استخدام رابط",
  "menu.image_hide_url": "إخفاء الرابط",
  "menu.image_upload": "رفع صورة",
  "menu.image_replace": "استبدال الصورة",
  "menu.image_uploading": "جارٍ الرفع…",
  "menu.image_remove": "إزالة",
  "menu.image_preview_failed": "لم يتم تحميل هذا الرابط كصورة.",
  "menu.image_upload_failed": "فشل الرفع. يرجى المحاولة مرة أخرى.",
  "menu.image_bad_type": "اختر صورة JPEG أو PNG أو WebP أو AVIF.",
  "menu.image_too_large": "حجم هذه الصورة {size} ميغابايت. الحد الأقصى {max} ميغابايت.",

  // ── AI import ──
  "menu.import_hint": "PDF أو CSV أو PNG أو JPG أو WebP — حتى 3 ميغابايت.",
  "menu.import_too_large":
    "حجم هذا الملف {size} ميغابايت. يقبل الماسح حتى 3 ميغابايت — جرّب صورة أو ملف PDF أصغر.",
  "menu.import_failed_title": "لم ينجح المسح",
  "menu.import_missing_key":
    "ماسح الذكاء الاصطناعي غير مُعدّ على هذا الخادم بعد. يمكنك لصق مفتاح Gemini API الخاص بك أدناه والمحاولة مجددًا.",
  "menu.import_nothing_found": "لم يُعثر على أطباق في هذا الملف. جرّب صورة أوضح أو ملفًا آخر.",
  "menu.import_own_key": "استخدام مفتاح Gemini API الخاص بي",
  "menu.import_own_key_hint": "يُستخدم فقط لعمليات المسح في هذه الجلسة — ولا يتم حفظه.",
  "menu.import_step_upload": "جارٍ رفع قائمتك…",
  "menu.import_step_reading": "جارٍ قراءة القائمة…",
  "menu.import_step_dishes": "جارٍ استخراج الأطباق والأسعار والإضافات…",
  "menu.import_step_structuring": "جارٍ تنظيم الأقسام…",
  "menu.import_summary": "{dishes} طبق · {sections} قسم",
  "menu.import_progress": "جارٍ إضافة الأطباق… {done} من {total}",
  "menu.import_done": "تمت إضافة {count} طبق إلى قائمتك.",
  "menu.import_partial": "تعذّرت إضافة {items} طبق و{groups} مجموعة خيارات. راجع قائمتك.",
};
