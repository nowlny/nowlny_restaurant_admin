/** English strings for the menu area. Every key here needs a twin in menu.ar.ts. */
export const menuEn = {
  // ── Menu page ──
  "menu.load_failed": "We couldn't load your menu.",
  "menu.empty_title": "Your menu is empty",
  "menu.section_empty": "No dishes in this section yet.",
  "menu.search_label": "Search dishes",
  "menu.search_placeholder": "Search dishes and sections…",
  "menu.search_clear": "Clear search",
  "menu.search_empty": "Nothing on the menu matches “{query}”.",
  "menu.badge_hidden": "Hidden",
  "menu.popular": "Popular",
  "menu.edit_section_aria": "Edit section {name}",
  "menu.delete_section_aria": "Delete section {name}",
  "menu.delete_section_with_items":
    "“{name}” and the {count} dishes in it will be permanently deleted.",
  "menu.edit_item_aria": "Edit {name}",
  "menu.delete_item_aria": "Delete {name}",
  "menu.options_aria": "Option groups for {name}",
  "menu.section_saved": "Section saved.",
  "menu.section_save_failed": "Couldn't save the section.",
  "menu.section_deleted": "Section deleted.",
  "menu.item_saved": "Dish saved.",
  "menu.item_deleted": "Dish deleted.",
  "menu.delete_failed": "Couldn't delete it. Please try again.",

  // ── Section form ──
  "menu.section_name": "Section name",
  "menu.section_active_hint": "Hidden sections and their dishes don't appear to customers.",

  // ── Dish form ──
  "menu.error_name_required": "Enter a name.",
  "menu.error_price_invalid": "Enter a price of 0 or more.",
  "menu.error_discount_not_lower": "The sale price must be lower than the regular price.",
  "menu.discount_hint": "Leave empty when the dish isn't on sale.",
  "menu.visibility_legend": "Visibility",
  "menu.active_hint": "Shown on your menu. Turn off to hide the dish without deleting it.",
  "menu.available_hint": "Customers can order it right now.",
  "menu.popular_hint": "Highlighted to customers as a favourite.",

  // ── Stock ──
  "menu.in_stock": "In stock",
  "menu.out_of_stock": "Out of stock",
  "menu.stock_toggle_aria": "{name} in stock",
  "menu.stock_failed": "Couldn't change the stock status.",
  "menu.stock_scheduled":
    "This dish follows a stock schedule, so its availability can't be changed this way right now.",

  // ── Sorting ──
  "menu.sort_handle_aria": "Reorder {name}. Drag, or use the up and down arrow keys.",
  "menu.sort_handle_title": "Drag to reorder",
  "menu.sort_hint": "Drag the handles to reorder — or drop a dish on another section to move it.",
  "menu.sort_blocked_search": "Clear the search to reorder.",
  "menu.sort_failed": "Couldn't save the new order.",
  "menu.item_moved": "Moved “{name}” to {section}.",

  // ── Option groups ──
  "menu.group_type": "Selection type",
  "menu.options_load_failed": "Couldn't load the option groups.",
  "menu.options_save_failed": "Couldn't save. Please try again.",
  "menu.options_delete_failed": "Couldn't delete it. Please try again.",

  // ── Dish photo ──
  "menu.image_label": "Photo",
  "menu.image_hint": "Drop, paste or upload a JPEG, PNG, WebP or AVIF up to 5 MB.",
  "menu.image_use_url": "Use a URL",
  "menu.image_hide_url": "Hide URL",
  "menu.image_upload": "Upload photo",
  "menu.image_replace": "Replace photo",
  "menu.image_uploading": "Uploading…",
  "menu.image_remove": "Remove",
  "menu.image_preview_failed": "That URL didn't load as an image.",
  "menu.image_upload_failed": "The upload failed. Please try again.",
  "menu.image_bad_type": "Choose a JPEG, PNG, WebP or AVIF image.",
  "menu.image_too_large": "That image is {size} MB. The limit is {max} MB.",

  // ── AI import ──
  "menu.import_hint": "PDF, CSV, PNG, JPG or WebP — up to 3 MB.",
  "menu.import_too_large":
    "That file is {size} MB. The scanner accepts up to 3 MB — try a photo or a smaller PDF.",
  "menu.import_failed_title": "The scan didn't work",
  "menu.import_missing_key":
    "The AI scanner isn't set up on this server yet. You can paste your own Gemini API key below and try again.",
  "menu.import_nothing_found": "No dishes were found in that file. Try a clearer photo or another file.",
  "menu.import_own_key": "Use my own Gemini API key",
  "menu.import_own_key_hint": "Used only for scans in this session — it isn't saved.",
  "menu.import_step_upload": "Uploading your menu…",
  "menu.import_step_reading": "Reading the menu…",
  "menu.import_step_dishes": "Finding dishes, prices and add-ons…",
  "menu.import_step_structuring": "Organising sections…",
  "menu.import_summary": "{dishes} dishes · {sections} sections",
  "menu.import_progress": "Adding dishes… {done} of {total}",
  "menu.import_done": "{count} dishes added to your menu.",
  "menu.import_partial": "{items} dishes and {groups} option groups couldn't be added. Check your menu.",
} as const;
