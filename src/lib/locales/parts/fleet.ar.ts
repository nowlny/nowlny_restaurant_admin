import type { fleetEn } from "./fleet.en";

export const fleetAr: Record<keyof typeof fleetEn, string> = {
  // ── Page ──
  "fleet.title": "السائقون",
  "fleet.subtitle": "ادعُ السائقين إلى أسطولك وحدّد من يمكنه توصيل طلباتك.",
  "fleet.invite": "دعوة سائق",
  "fleet.filter_label": "تصفية السائقين حسب الحالة",
  "fleet.filter_all": "الكل",
  "fleet.filter_active": "نشط",
  "fleet.filter_inactive": "غير نشط",
  "fleet.search_placeholder": "ابحث بالاسم أو رقم الهاتف",
  "fleet.refresh": "تحديث",

  // ── Roster ──
  "fleet.load_failed": "تعذّر تحميل السائقين.",
  "fleet.empty_title": "لا يوجد سائقون بعد",
  "fleet.empty_body": "ادعُ السائقين المسجّلين برقم هاتفهم لبناء أسطولك.",
  "fleet.no_results": "لا يوجد سائقون يطابقون هذه الفلاتر.",
  "fleet.clear_filters": "مسح الفلاتر",
  "fleet.unnamed": "سائق بدون اسم",
  "fleet.status_active": "نشط",
  "fleet.status_inactive": "غير نشط",
  "fleet.available": "متاح",
  "fleet.unavailable": "غير متاح",
  "fleet.no_plate": "بدون لوحة",
  "fleet.vehicle_unknown": "المركبة غير محددة",
  "fleet.vehicle.motorcycle": "دراجة نارية",
  "fleet.vehicle.car": "سيارة",
  "fleet.vehicle.bicycle": "دراجة هوائية",
  "fleet.vehicle.scooter": "سكوتر",
  "fleet.manage_named": "إدارة {name}",
  "fleet.remove_named": "إزالة {name}",
  "fleet.manage": "إدارة",

  // ── Remove ──
  "fleet.remove": "إزالة من الأسطول",
  "fleet.remove_title": "إزالة هذا السائق؟",
  "fleet.remove_message": "إزالة {name} من أسطولك؟ يبقى حساب السائق فعّالاً.",
  "fleet.remove_confirm": "إزالة",
  "fleet.removed": "تمت إزالة {name} من أسطولك",
  "fleet.remove_failed": "تعذّرت إزالة السائق.",

  // ── Pending invitations ──
  "fleet.pending_title": "دعوات معلّقة",
  "fleet.pending_hint": "بانتظار رد السائق",
  "fleet.invited_on": "أُرسلت الدعوة {date}",
  "fleet.invitations_failed": "تعذّر تحميل الدعوات المعلّقة.",
  "fleet.revoke_named": "إلغاء الدعوة المرسلة إلى {phone}",
  "fleet.revoke_title": "إلغاء هذه الدعوة؟",
  "fleet.revoke_message": "إلغاء الدعوة المعلّقة المرسلة إلى {phone}؟",
  "fleet.revoke_confirm": "إلغاء الدعوة",
  "fleet.revoked": "تم إلغاء الدعوة",
  "fleet.revoke_failed": "تعذّر إلغاء الدعوة.",

  // ── Invite ──
  "fleet.invite_title": "دعوة سائق",
  "fleet.invite_hint":
    "أدخل رقم الهاتف الذي سجّل به السائق في تطبيق نولني للسائقين. ينضم إلى أسطولك بعد قبول الدعوة.",
  "fleet.phone_label": "رقم هاتف السائق",
  "fleet.phone_placeholder": "71 234 567",
  "fleet.send_invite": "إرسال الدعوة",
  "fleet.sending": "جارٍ الإرسال…",
  "fleet.invalid_phone": "أدخل رقم هاتف صالحاً.",
  "fleet.invite_no_account":
    "لا يوجد حساب سائق مسجّل بهذا الرقم. اطلب منه التسجيل في تطبيق السائقين أولاً.",
  "fleet.invite_duplicate": "هذا السائق موجود في أسطولك أو لديه دعوة معلّقة.",
  "fleet.invite_failed": "تعذّر إرسال الدعوة. حاول مرة أخرى.",
  "fleet.invite_sent": "تم إرسال الدعوة. ينضم السائق إلى أسطولك بعد قبولها.",

  // ── Driver details ──
  "fleet.details_title": "تفاصيل السائق",
  "fleet.details_stale": "تعذّر تحديث بيانات السائق. نعرض آخر بيانات محمّلة.",
  "fleet.phone": "الهاتف",
  "fleet.vehicle": "المركبة",
  "fleet.plate": "اللوحة",
  "fleet.rating": "التقييم",
  "fleet.rating_value": "{rating} ({count} تقييم)",
  "fleet.no_ratings": "لا توجد تقييمات بعد",
  "fleet.availability": "التوفر",
  "fleet.joined": "تاريخ الانضمام",
  "fleet.profile_note": "يدير السائق اسمه وبيانات مركبته من تطبيقه الخاص.",
  "fleet.status_label": "حالة الإسناد",
  "fleet.status_active_hint": "يمكن إسناد طلبات جديدة إليه.",
  "fleet.status_inactive_hint": "يبقى في أسطولك لكن لن تُسند إليه طلبات جديدة.",
  "fleet.updated": "تم تحديث السائق",
  "fleet.update_failed": "تعذّر تحديث السائق.",
};
