import type { mediaEn } from "./media.en";

export const mediaAr: Record<keyof typeof mediaEn, string> = {
  // ── Stories & reels lists ──
  "media.stories_empty_title": "لا توجد قصص نشطة",
  "media.reels_empty_title": "لا توجد ريلز بعد",
  "media.load_stories_failed": "تعذّر تحميل قصصك.",
  "media.load_reels_failed": "تعذّر تحميل الريلز.",
  "media.delete_failed": "تعذّر الحذف. حاول مرة أخرى.",
  "media.story_deleted": "تم حذف القصة",
  "media.reel_deleted": "تم حذف الريل",
  "media.story_saved": "تم حفظ القصة",
  "media.reel_saved": "تم حفظ الريل",
  "media.video_badge": "فيديو",
  "media.delete_story_title": "حذف هذه القصة؟",
  "media.delete_reel_title": "حذف هذا الريل؟",

  // ── Story order ──
  "media.story_sort_aria": "القصة {position}",
  "media.story_move_earlier": "تقديم القصة",
  "media.story_move_later": "تأخير القصة",
  "media.story_position": "#{position}",
  "media.story_reorder_hint": "اسحب القصة أو استخدم الأسهم لتغيير الترتيب الذي يراها به العملاء.",
  "media.story_reorder_failed": "تعذّر حفظ الترتيب الجديد. يرجى المحاولة مرة أخرى.",
  "media.story_reorder_unavailable": "إعادة ترتيب القصص غير متاحة بعد.",
  "media.story_reorder_saving": "جارٍ حفظ الترتيب…",

  // ── Editors ──
  "media.image_too_large": "حجم الصورة {size} ميغابايت، وهو أكبر من الحد المسموح {limit} ميغابايت. استخدم صورة أصغر.",
  "media.story_media_hint": "الصور حتى {image} ميغابايت، والفيديو حتى {video} ميغابايت.",
  "media.media_formats": "JPG، PNG، MP4، MOV",
  "media.thumbnail_hint": "اتركها فارغة لاستخدام لقطة من الفيديو.",
  "media.caption_count": "{count}/{max}",

  // ── Story views ──
  "media.viewers_title": "مشاهدات القصة",
  "media.viewers_label": "مشاهد فريد",
  "media.viewers_hint": "يُحتسب كل عميل مرة واحدة مهما شاهد القصة.",

  // ── QR ──
  "media.qr_copy_failed": "تعذّر نسخ الرابط. حدّده وانسخه يدويًا.",

  // ── Home dashboard ──
  "home.status_open": "مفتوح · يستقبل الطلبات",
  "home.status_busy": "مشغول · الطلبات الجديدة متوقفة",
  "home.status_busy_until": "مشغول حتى {time}",
  "home.status_closed": "مغلق الآن",
  "home.chart_aria": "{metric} خلال آخر 7 أيام",
};
