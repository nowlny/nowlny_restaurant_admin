"use client";

import React, { useId, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Busy, useFeedback } from '@/components/ui/Feedback';
import { StoriesService, type Story, type StoryPayload } from '@/services/api/stories';
import { getApiErrorMessage } from '@/services/api/errors';
import { useI18n } from '@/lib/i18n';
import {
  isVideoUrl,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  toMegabytes,
  uploadFile,
  videoPosterUrl,
} from '@/lib/reelMedia';
import styles from '@/components/media/media.module.css';

const CAPTION_MAX = 300;

type MediaKind = 'image' | 'video';

interface StoryModalProps {
  /** Mounted only while open, keyed by story, so the form starts from `story` every time. */
  story: Story | null;
  onClose: () => void;
  onSave: () => void;
}

export default function StoryModal({ story, onClose, onSave }: StoryModalProps) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const formId = useId();
  const mediaId = useId();
  const captionId = useId();

  // One field for "the media": the clip for a video story, the picture
  // otherwise. Old video stories kept the clip in `imageUrl`.
  const [mediaUrl, setMediaUrl] = useState(story?.videoUrl || story?.imageUrl || '');
  const [mediaKind, setMediaKind] = useState<MediaKind>(
    story?.videoUrl || isVideoUrl(story?.imageUrl) ? 'video' : 'image',
  );
  const [caption, setCaption] = useState(story?.caption || '');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = saving || isUploading;

  const uploadMedia = async (file: File) => {
    const kind: MediaKind = file.type.startsWith('video/') ? 'video' : 'image';
    const limit = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > limit) {
      const vars = { size: toMegabytes(file.size), limit: toMegabytes(limit) };
      toast.error(kind === 'video' ? t('reel.video_too_large', vars) : t('media.image_too_large', vars));
      return;
    }
    setIsUploading(true);
    setProgress(0);
    try {
      const uploadedUrl = await uploadFile(file, kind, setProgress);
      setMediaUrl(uploadedUrl);
      setMediaKind(kind);
    } catch (err) {
      console.error('Failed to upload story media', err);
      toast.error(t('stories.upload_failed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear so re-picking the same file still fires `change`.
    e.target.value = '';
    if (file) void uploadMedia(file);
  };

  /** The still the apps show before a video story loads — `imageUrl` is required by the API. */
  const posterFor = (videoUrl: string) => {
    // Unchanged clip: keep whatever poster it already had.
    if (story?.videoUrl === videoUrl && story.imageUrl && !isVideoUrl(story.imageUrl)) {
      return story.imageUrl;
    }
    // A clip from elsewhere has no poster we can derive; the legacy shape
    // (video in imageUrl) is what older stories already look like.
    return videoPosterUrl(videoUrl) ?? videoUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = mediaUrl.trim();
    if (!url || busy) return;

    const payload: StoryPayload =
      mediaKind === 'video'
        ? { imageUrl: posterFor(url), videoUrl: url, caption: caption.trim() }
        : {
            imageUrl: url,
            caption: caption.trim(),
            // Swapping a video story's clip for a photo has to clear the clip.
            ...(story?.videoUrl ? { videoUrl: null } : {}),
          };

    setSaving(true);
    try {
      if (story) await StoriesService.updateStory(story.id, payload);
      else await StoriesService.createStory(payload);
      toast.success(t('media.story_saved'));
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save story', err);
      toast.error(getApiErrorMessage(err, t('stories.save_failed')));
    } finally {
      setSaving(false);
    }
  };

  const pickFile = () => fileInputRef.current?.click();

  return (
    <Modal
      open
      onClose={onClose}
      title={story ? t('stories.edit_title') : t('stories.new_title')}
      maxWidth={440}
      dismissible={!saving}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" form={formId} className="btn-primary" disabled={busy || !mediaUrl.trim()}>
            <Busy busy={saving} label={t('stories.save')} busyLabel={t('common.saving')} />
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div className="field">
          <label className="field-label" htmlFor={mediaId}>
            {t('stories.media_label')} <span className={styles.required} aria-hidden="true">*</span>
          </label>

          {mediaUrl ? (
            <div className={styles.preview} style={{ height: '260px' }}>
              {mediaKind === 'video' ? (
                <video
                  src={mediaUrl}
                  poster={videoPosterUrl(mediaUrl) ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary Cloudinary/pasted URLs; next/image has no remotePatterns for them
                <img src={mediaUrl} alt={t('stories.preview_alt')} decoding="async" />
              )}
              {isUploading && (
                <div className={styles.previewBusy} role="status">
                  {t('stories.uploading')} {Math.round(progress * 100)}%
                  <div className={styles.progress}><span style={{ width: `${progress * 100}%` }} /></div>
                </div>
              )}
              <button id={mediaId} type="button" className={styles.replace} onClick={pickFile} disabled={busy}>
                {t('stories.change_media')}
              </button>
            </div>
          ) : (
            <button
              id={mediaId}
              type="button"
              className={`${styles.tile}${isDragging ? ` ${styles.tileActive}` : ''}`}
              onClick={pickFile}
              disabled={busy}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes('Files')) return;
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (!file || busy) return;
                e.preventDefault();
                void uploadMedia(file);
              }}
            >
              {isUploading ? (
                <>
                  <span className={styles.tileTitle} role="status">
                    {t('stories.uploading')} {Math.round(progress * 100)}%
                  </span>
                  <span className={styles.progress}><span style={{ width: `${progress * 100}%` }} /></span>
                </>
              ) : (
                <>
                  <span className={styles.tileIcon}><Upload size={24} /></span>
                  <span>
                    <span className={styles.tileTitle}>{t('stories.upload_prompt')}</span>
                    <span className={styles.tileHint}>{t('media.media_formats')}</span>
                  </span>
                </>
              )}
            </button>
          )}

          <p className="field-hint">
            {t('media.story_media_hint', {
              image: toMegabytes(MAX_IMAGE_BYTES),
              video: toMegabytes(MAX_VIDEO_BYTES),
            })}
          </p>

          {/* Fallback for media that already lives online. */}
          <input
            type="url"
            inputMode="url"
            dir="ltr"
            className="form-input"
            aria-label={t('stories.url_placeholder')}
            placeholder={t('stories.url_placeholder')}
            value={mediaUrl}
            onChange={(e) => {
              setMediaUrl(e.target.value);
              setMediaKind(isVideoUrl(e.target.value) ? 'video' : 'image');
            }}
            disabled={busy}
          />
        </div>

        <div className="field">
          <div className={styles.labelRow}>
            <label className="field-label" htmlFor={captionId}>{t('stories.caption')}</label>
            <span className={styles.optional}>{t('common.optional')}</span>
          </div>
          <textarea
            id={captionId}
            className="form-input"
            rows={3}
            maxLength={CAPTION_MAX}
            placeholder={t('stories.caption_placeholder')}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <span className={styles.counter} aria-live="polite">
            {t('media.caption_count', { count: caption.length, max: CAPTION_MAX })}
          </span>
        </div>

        {/* Last in the form: Modal focuses the first input on open, and a
            hidden file input can't take focus. */}
        <input
          type="file"
          ref={fileInputRef}
          hidden
          tabIndex={-1}
          accept="image/*,video/mp4,video/quicktime,video/webm"
          onChange={handleFileChange}
        />
      </form>
    </Modal>
  );
}
