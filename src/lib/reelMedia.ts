/* ---------------------------------------------------------------------------
   Getting a reel's video onto our Cloudinary, from wherever the owner has it:
   a file on their computer, a direct video link, or an Instagram reel link.

   Uploads are unsigned with the `ml_default` preset — the same cloud and
   preset the admin portal and the mobile apps use, so every reel on the
   platform sits under `res.cloudinary.com/dtm5iglra`.
--------------------------------------------------------------------------- */

import { getAccessToken } from "@/services/api/session";
import { isInstagramLink } from "@/lib/instagram";

export const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "dtm5iglra";
export const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "ml_default";

/** Cloudinary's cap on a single (non-chunked) video upload. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Cloudinary's per-image cap on the free plan; larger files are rejected after the upload. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Bytes → whole megabytes, for the "too large" messages. */
export const toMegabytes = (bytes: number) => Math.round(bytes / 1048576);

export type ResourceType = "image" | "video";

type UploadResponse = { secure_url?: string; url?: string; error?: { message?: string } };

function hostedUrl(payload: UploadResponse): string {
  const url = payload.secure_url || payload.url;
  if (!url) throw new Error(payload.error?.message || "Upload failed.");
  return url;
}

/**
 * Uploads a picked file. XHR rather than `fetch` because a video is tens of
 * megabytes and `fetch` has no upload progress.
 */
export function uploadFile(
  file: File,
  resourceType: ResourceType,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      try {
        resolve(hostedUrl(JSON.parse(xhr.responseText)));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Upload failed."));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed."));
    xhr.send(body);
  });
}

/** Has Cloudinary fetch a public link itself and keep a copy. */
export async function uploadFromUrl(remoteUrl: string, resourceType: ResourceType): Promise<string> {
  const body = new FormData();
  body.append("file", remoteUrl);
  body.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
    method: "POST",
    body,
  });
  return hostedUrl(await res.json());
}

/** True for links already served by our own Cloudinary cloud. */
export function isHostedMedia(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "res.cloudinary.com" && parsed.pathname.startsWith(`/${CLOUD_NAME}/`);
  } catch {
    return false;
  }
}

/**
 * A poster frame for a video on our cloud: Cloudinary renders any video as a
 * still when asked for it with an image extension.
 */
export function videoPosterUrl(videoUrl: string): string | null {
  if (!isHostedMedia(videoUrl)) return null;
  const url = new URL(videoUrl);
  if (!url.pathname.includes("/video/upload/")) return null;
  url.pathname = url.pathname.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
  return url.toString();
}

/**
 * Best guess at whether a link is a video. Older stories stored the clip in
 * `imageUrl`, so the URL itself is the only signal for those.
 */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().split("?")[0];
  return /\.(mp4|mov|webm|m4v)$/.test(lower) || lower.includes("/video/upload/");
}

export interface ImportedReel {
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
}

/**
 * Turns a pasted link into a hosted video. An Instagram link is a web page the
 * browser can't read cross-origin, so it goes through `/api/instagram-reel`;
 * any other link is handed to Cloudinary to copy.
 */
export async function importFromLink(link: string): Promise<ImportedReel> {
  const trimmed = link.trim();
  if (!/^https?:\/\//i.test(trimmed)) throw new Error("not_a_link");

  if (!isInstagramLink(trimmed)) {
    const videoUrl = await uploadFromUrl(trimmed, "video");
    return { videoUrl, thumbnailUrl: videoPosterUrl(videoUrl), caption: null };
  }

  const token = getAccessToken();
  const res = await fetch("/api/instagram-reel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ url: trimmed }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.videoUrl) throw new Error(payload?.error || "instagram_failed");
  return payload as ImportedReel;
}
