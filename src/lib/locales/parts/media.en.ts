/** English strings for the media area. Every key here needs a twin in media.ar.ts. */
export const mediaEn = {
  // ── Stories & reels lists ──
  "media.stories_empty_title": "No active stories",
  "media.reels_empty_title": "No reels yet",
  "media.load_stories_failed": "Couldn't load your stories.",
  "media.load_reels_failed": "Couldn't load your reels.",
  "media.delete_failed": "Couldn't delete it. Please try again.",
  "media.story_deleted": "Story deleted",
  "media.reel_deleted": "Reel deleted",
  "media.story_saved": "Story saved",
  "media.reel_saved": "Reel saved",
  "media.video_badge": "Video",
  "media.delete_story_title": "Delete this story?",
  "media.delete_reel_title": "Delete this reel?",

  // ── Story order ──
  "media.story_sort_aria": "Story {position}",
  "media.story_move_earlier": "Move story earlier",
  "media.story_move_later": "Move story later",
  "media.story_position": "#{position}",
  "media.story_reorder_hint": "Drag a story, or use the arrows, to change the order customers see them in.",
  "media.story_reorder_failed": "Couldn't save the new order. Please try again.",
  "media.story_reorder_unavailable": "Reordering stories isn't available yet.",
  "media.story_reorder_saving": "Saving order…",

  // ── Editors ──
  "media.image_too_large": "That image is {size} MB, past the {limit} MB limit. Use a smaller one.",
  "media.story_media_hint": "Images up to {image} MB, videos up to {video} MB.",
  "media.media_formats": "JPG, PNG, MP4, MOV",
  "media.thumbnail_hint": "Leave it empty to use a frame from the video.",
  "media.caption_count": "{count}/{max}",

  // ── Story views ──
  "media.viewers_title": "Story views",
  "media.viewers_label": "unique viewers",
  "media.viewers_hint": "Each customer is counted once, however many times they watched.",

  // ── QR ──
  "media.qr_copy_failed": "Couldn't copy the link. Select it and copy it manually.",

  // ── Home dashboard ──
  "home.status_open": "Open · taking orders",
  "home.status_busy": "Busy · new orders paused",
  "home.status_busy_until": "Busy until {time}",
  "home.status_closed": "Closed right now",
  "home.chart_aria": "{metric} for the last 7 days",
} as const;
