import type { shellEn } from "./shell.en";

export const shellAr: Record<keyof typeof shellEn, string> = {
  "shell.busy_accepting": "نستقبل الطلبات",
  "shell.busy_paused": "الطلبات متوقفة",
  "shell.busy_until": "متوقف حتى {time}",
  "shell.busy_short_open": "مفتوح",
  "shell.busy_short_paused": "متوقف",
  "shell.busy_pause_hint": "إيقاف الطلبات الجديدة مؤقتًا",
  "shell.busy_resume_hint": "استئناف استقبال الطلبات الآن",
  "shell.busy_dialog_title": "إيقاف الطلبات الجديدة",
  "shell.busy_dialog_body":
    "سيظهر مطعمك للزبائن كغير متاح مؤقتًا ولن يتمكنوا من تقديم طلبات جديدة. الطلبات الجارية لا تتأثر، وتبقى أوقات العمل كما هي.",
  "shell.busy_for": "مدة الإيقاف",
  "shell.busy_15m": "١٥ دقيقة",
  "shell.busy_30m": "٣٠ دقيقة",
  "shell.busy_1h": "ساعة",
  "shell.busy_2h": "ساعتان",
  "shell.busy_manual": "حتى أستأنف",
  "shell.busy_reason": "السبب",
  "shell.busy_reason_placeholder": "مثلًا: المطبخ مزدحم",
  "shell.busy_confirm": "إيقاف الطلبات",
  "shell.busy_paused_toast": "تم إيقاف الطلبات الجديدة.",
  "shell.busy_resumed": "عدت لاستقبال الطلبات.",
  "shell.status_suspended":
    "مطعمك موقوف. لا يظهر للزبائن، وتعديل الملف الشخصي غير متاح. تواصل مع دعم نَولني لإعادة تفعيله.",
  "shell.status_inactive":
    "مطعمك غير نشط، لذلك لا يظهر للزبائن. لا يزال بإمكانك تعديل القائمة والإعدادات.",
  "shell.status_rejected":
    "لم تتم الموافقة على مطعمك. تواصل مع دعم نَولني لمعرفة التفاصيل.",
};
