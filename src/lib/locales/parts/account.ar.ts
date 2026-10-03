import type { accountEn } from "./account.en";

export const accountAr: Record<keyof typeof accountEn, string> = {
  "account.title": "حسابي",
  "account.subtitle": "ملفك كمالك، وطرق التواصل مع الدعم، والمعلومات القانونية.",

  // ── Owner profile ──
  "account.profile_title": "ملف المالك",
  "account.profile_subtitle": "الشخص الذي يسجّل الدخول لإدارة هذا المطعم.",
  "account.full_name": "الاسم الكامل",
  "account.full_name_placeholder": "مثال: محمد أحمد",
  "account.phone": "رقم الهاتف",
  "account.phone_hint": "تسجّل الدخول بهذا الرقم، لذا لا يمكن تغييره من هنا.",
  "account.load_failed": "تعذّر تحميل ملفك.",
  "account.saved": "تم تحديث الملف",
  "account.save_failed": "تعذّر تحديث ملفك. يرجى المحاولة مرة أخرى.",

  // ── Restaurant ──
  "account.restaurant_title": "المطعم",
  "account.restaurant_subtitle": "يُدار الاسم والشعار وبيانات التواصل من الإعدادات.",
  "account.edit_restaurant": "التعديل في الإعدادات",

  // ── Help ──
  "account.help_title": "المساعدة والدعم",
  "account.help_subtitle": "كيف يمكننا مساعدتك اليوم؟",
  "account.contact_call": "اتصل بنا",
  "account.contact_whatsapp": "واتساب",
  "account.contact_email": "راسلنا عبر البريد",
  "account.opens_new_tab": "(يفتح في علامة تبويب جديدة)",

  // ── Legal ──
  "account.legal_title": "المعلومات القانونية",
  "account.terms": "الشروط والأحكام",
  "account.terms_hint": "اقرأ شروط خدمة Nowlny",

  // ── Delete ──
  "account.delete_title": "حذف الحساب",
  "account.delete_body": "احذف حسابك في Nowlny وبياناته نهائياً. لا يمكن التراجع عن ذلك.",
  "account.delete_cta": "حذف الحساب",
};
