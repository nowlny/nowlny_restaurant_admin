/** English strings for the dashboard shell. Every key here needs a twin in shell.ar.ts. */
export const shellEn = {
  "shell.busy_accepting": "Accepting orders",
  "shell.busy_paused": "Orders paused",
  "shell.busy_until": "Paused until {time}",
  "shell.busy_short_open": "Open",
  "shell.busy_short_paused": "Paused",
  "shell.busy_pause_hint": "Pause new orders for a while",
  "shell.busy_resume_hint": "Resume taking orders now",
  "shell.busy_dialog_title": "Pause new orders",
  "shell.busy_dialog_body":
    "Customers will see you as temporarily unavailable and can't place new orders. Orders already in progress are not affected, and your opening hours stay as they are.",
  "shell.busy_for": "Pause for",
  "shell.busy_15m": "15 min",
  "shell.busy_30m": "30 min",
  "shell.busy_1h": "1 hour",
  "shell.busy_2h": "2 hours",
  "shell.busy_manual": "Until I resume",
  "shell.busy_reason": "Reason",
  "shell.busy_reason_placeholder": "e.g. Kitchen is backed up",
  "shell.busy_confirm": "Pause orders",
  "shell.busy_paused_toast": "New orders are paused.",
  "shell.busy_resumed": "You're accepting orders again.",
  "shell.status_suspended":
    "Your restaurant is suspended. Customers can't see it and changes to your profile are blocked. Contact Nowlny support to restore it.",
  "shell.status_inactive":
    "Your restaurant is inactive, so customers can't see it. You can still update your menu and settings.",
  "shell.status_rejected":
    "Your restaurant was not approved. Contact Nowlny support for details.",
} as const;
