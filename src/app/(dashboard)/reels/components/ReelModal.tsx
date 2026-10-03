"use client";

import React, { useId, useRef, useState } from 'react';
import { Loader2, Video, Image as ImageIcon, Link2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Busy, useFeedback } from '@/components/ui/Feedback';
import {
  ReelsService,
  type CreateReelPayload,
  type Reel,
  type ReelStatus,
  type UpdateReelPayload,
} from '@/services/api/reels';
import { getApiErrorMessage } from '@/services/api/errors';
import { useI18n } from '@/lib/i18n';
import {
  importFromLink,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  toMegabytes,
  uploadFile,
  videoPosterUrl,
} from '@/lib/reelMedia';
import styles from '@/components/media/media.module.css';

const CAPTION_MAX = 300;

interface ReelModalProps {
  /** Mounted only while open, keyed by reel, so the form starts from `reel` every time. */
  reel: Reel | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ReelModal({ reel, onClose, onSave }: ReelModalProps) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const formId = useId();
  const videoId = useId();
  const thumbnailId = useId();
  const captionId = useId();
  const statusId = useId();
  const linkHintId = useId();

  const [loading, setLoading] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);

  const [formData, setFormData] = useState({
    videoUrl: reel?.videoUrl || '',
    thumbnailUrl: reel?.thumbnailUrl || '',
    caption: reel?.caption || '',
    menuItemId: reel?.menuItemId || '',
    status: (reel?.status || 'active') as ReelStatus,
  });

  const [videoProgress, setVideoProgress] = useState(0);
  const [linkDraft, setLinkDraft] = useState('');
  const [isImportingLink, setIsImportingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  // The cover we filled in ourselves, so a replaced video can replace it too —
  // but never one the owner picked.
  const autoThumbRef = useRef('');

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const videoBusy = isUploadingVideo || isImportingLink;
  // The API needs only the video; without a cover the apps show its first frame.
  const isFormValid = Boolean(formData.videoUrl);
  const isBusy = loading || isUploadingVideo || isUploadingThumbnail || isImportingLink;

  /** Sets the video, and fills the cover and caption if they are still blank. */
  const applyVideo = (videoUrl: string, thumbnailUrl?: string | null, caption?: string | null) => {
    setFormData(prev => {
      const next = { ...prev, videoUrl };
      if (thumbnailUrl && (!prev.thumbnailUrl || prev.thumbnailUrl === autoThumbRef.current)) {
        autoThumbRef.current = thumbnailUrl;
        next.thumbnailUrl = thumbnailUrl;
      }
      if (caption && !prev.caption.trim()) next.caption = caption.slice(0, CAPTION_MAX);
      return next;
    });
  };

  const uploadVideo = async (file: File) => {
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(t('reel.video_too_large', { size: toMegabytes(file.size), limit: toMegabytes(MAX_VIDEO_BYTES) }));
      return;
    }
    setIsUploadingVideo(true);
    setVideoProgress(0);
    try {
      const uploadedUrl = await uploadFile(file, 'video', setVideoProgress);
      applyVideo(uploadedUrl, videoPosterUrl(uploadedUrl));
    } catch (err) {
      console.error('Failed to upload video', err);
      toast.error(t('reel.video_upload_failed'));
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear so re-picking the same file still fires `change`.
    e.target.value = '';
    if (file) void uploadVideo(file);
  };

  const handleImportLink = async () => {
    const link = linkDraft.trim();
    if (!link || isImportingLink) return;
    if (!/^https?:\/\//i.test(link)) {
      setLinkError(t('reel.link_invalid'));
      return;
    }
    setLinkError(null);
    setIsImportingLink(true);
    try {
      const imported = await importFromLink(link);
      applyVideo(imported.videoUrl, imported.thumbnailUrl, imported.caption);
      setLinkDraft('');
    } catch (err) {
      console.error('Failed to import video link', err);
      const message = err instanceof Error ? err.message : '';
      setLinkError(
        message && !['instagram_failed', 'not_a_link'].includes(message)
          ? message
          : t('reel.link_failed'),
      );
    } finally {
      setIsImportingLink(false);
    }
  };

  const handleThumbnailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t('media.image_too_large', { size: toMegabytes(file.size), limit: toMegabytes(MAX_IMAGE_BYTES) }));
      return;
    }
    setIsUploadingThumbnail(true);
    try {
      const uploadedUrl = await uploadFile(file, 'image');
      autoThumbRef.current = '';
      setFormData(prev => ({ ...prev, thumbnailUrl: uploadedUrl }));
    } catch (err) {
      console.error('Failed to upload thumbnail', err);
      toast.error(t('reel.thumbnail_upload_failed'));
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isBusy) return;
    // Only DTO fields, and no empty strings: `menuItemId: ''` isn't "no item"
    // to the API, and `status` isn't part of CreateReelDto.
    const base: CreateReelPayload = {
      videoUrl: formData.videoUrl,
      caption: formData.caption.trim(),
      ...(formData.thumbnailUrl ? { thumbnailUrl: formData.thumbnailUrl } : {}),
      ...(formData.menuItemId ? { menuItemId: formData.menuItemId } : {}),
    };
    setLoading(true);
    try {
      if (reel) {
        const update: UpdateReelPayload = { ...base, status: formData.status };
        await ReelsService.updateReel(reel.id, update);
      } else {
        await ReelsService.createReel(base);
      }
      toast.success(t('media.reel_saved'));
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save reel', err);
      toast.error(getApiErrorMessage(err, t('reel.save_failed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={reel ? t('reel.edit_title') : t('reel.new_title')}
      maxWidth={640}
      dismissible={!loading}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={loading}>
            {t('common.cancel')}
          </button>
          <button type="submit" form={formId} disabled={isBusy || !isFormValid} className="btn-primary">
            <Busy busy={loading} label={t('reel.publish')} busyLabel={t('reel.saving')} />
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <p className="page-subtitle" style={{ fontSize: '14px', marginTop: '-6px' }}>
          {reel ? t('reel.edit_subtitle') : t('reel.new_subtitle')}
        </p>

        {/* Media uploads — side by side, stacked on phones (media.module.css) */}
        <div className={styles.uploadGrid}>
          {/* Video */}
          <div className="field">
            <label className="field-label" htmlFor={videoId}>
              {t('reel.video')} <span className={styles.required} aria-hidden="true">*</span>
            </label>

            {formData.videoUrl ? (
              <div className={styles.preview}>
                <video
                  src={formData.videoUrl}
                  poster={formData.thumbnailUrl || undefined}
                  controls
                  playsInline
                  preload="metadata"
                />
                {isUploadingVideo && (
                  <div className={styles.previewBusy} role="status">
                    {t('reel.uploading')} {Math.round(videoProgress * 100)}%
                    <div className={styles.progress}><span style={{ width: `${videoProgress * 100}%` }} /></div>
                  </div>
                )}
                <button
                  id={videoId}
                  type="button"
                  className={styles.replace}
                  onClick={() => videoInputRef.current?.click()}
                  disabled={videoBusy}
                >
                  {t('reel.replace')}
                </button>
              </div>
            ) : (
              <button
                id={videoId}
                type="button"
                className={`${styles.tile}${isDraggingVideo ? ` ${styles.tileActive}` : ''}`}
                onClick={() => videoInputRef.current?.click()}
                disabled={videoBusy}
                onDragOver={e => {
                  if (!e.dataTransfer.types.includes('Files')) return;
                  e.preventDefault();
                  setIsDraggingVideo(true);
                }}
                onDragLeave={() => setIsDraggingVideo(false)}
                onDrop={e => {
                  setIsDraggingVideo(false);
                  const file = e.dataTransfer.files?.[0];
                  if (!file || videoBusy) return;
                  e.preventDefault();
                  void uploadVideo(file);
                }}
              >
                {isUploadingVideo ? (
                  <>
                    <span className={styles.tileTitle} role="status">
                      {t('reel.uploading')} {Math.round(videoProgress * 100)}%
                    </span>
                    <span className={styles.progress}><span style={{ width: `${videoProgress * 100}%` }} /></span>
                  </>
                ) : (
                  <>
                    <span className={styles.tileIcon}><Video size={26} /></span>
                    <span>
                      <span className={styles.tileTitle}>{t('reel.click_to_upload')}</span>
                      <span className={styles.tileHint}>{t('reel.video_formats')}</span>
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Thumbnail — optional per CreateReelDto */}
          <div className="field">
            <div className={styles.labelRow}>
              <label className="field-label" htmlFor={thumbnailId}>{t('reel.thumbnail')}</label>
              <span className={styles.optional}>{t('common.optional')}</span>
            </div>

            {formData.thumbnailUrl ? (
              <div className={styles.preview}>
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary Cloudinary/Instagram-copied URLs; next/image has no remotePatterns for them */}
                <img src={formData.thumbnailUrl} alt={t('reel.thumbnail_alt')} decoding="async" />
                {isUploadingThumbnail && (
                  <div className={styles.previewBusy} role="status">
                    <Loader2 className="animate-spin" size={28} />
                    {t('reel.uploading')}
                  </div>
                )}
                <button
                  id={thumbnailId}
                  type="button"
                  className={styles.replace}
                  onClick={() => thumbnailInputRef.current?.click()}
                  disabled={isUploadingThumbnail}
                >
                  {t('reel.replace')}
                </button>
              </div>
            ) : (
              <button
                id={thumbnailId}
                type="button"
                className={styles.tile}
                onClick={() => thumbnailInputRef.current?.click()}
                disabled={isUploadingThumbnail}
              >
                {isUploadingThumbnail ? (
                  <>
                    <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
                    <span className={styles.tileTitle} role="status">{t('reel.uploading')}</span>
                  </>
                ) : (
                  <>
                    <span className={styles.tileIcon}><ImageIcon size={26} /></span>
                    <span>
                      <span className={styles.tileTitle}>{t('reel.click_to_upload')}</span>
                      <span className={styles.tileHint}>{t('reel.image_formats')}</span>
                    </span>
                  </>
                )}
              </button>
            )}
            <p className="field-hint">{t('media.thumbnail_hint')}</p>
          </div>
        </div>

        {/* Link import — Instagram reel or a direct video link */}
        <div className="field">
          <label htmlFor="reel-link" className="field-label">
            {t('reel.link_label')}
          </label>
          <div className={styles.linkRow}>
            <div className={styles.linkInput}>
              <Link2 size={18} aria-hidden="true" />
              <input
                id="reel-link"
                type="url"
                inputMode="url"
                dir="ltr"
                className="form-input"
                placeholder={t('reel.link_placeholder')}
                value={linkDraft}
                disabled={videoBusy}
                onChange={e => { setLinkDraft(e.target.value); setLinkError(null); }}
                onKeyDown={e => {
                  // Enter would submit the whole form with no video yet.
                  if (e.key === 'Enter') { e.preventDefault(); handleImportLink(); }
                }}
                aria-invalid={!!linkError}
                aria-describedby={linkHintId}
              />
            </div>
            <button
              type="button"
              onClick={handleImportLink}
              disabled={!linkDraft.trim() || videoBusy}
              className="btn-outline"
            >
              <Busy busy={isImportingLink} label={t('reel.link_import')} busyLabel={t('reel.link_importing')} />
            </button>
          </div>
          <p
            id={linkHintId}
            role={linkError ? 'alert' : undefined}
            className={`field-hint${linkError ? ` ${styles.hintError}` : ''}`}
          >
            {linkError || t('reel.link_hint')}
          </p>
        </div>

        {/* Details */}
        <div className="field">
          <div className={styles.labelRow}>
            <label className="field-label" htmlFor={captionId}>{t('reel.caption')}</label>
            <span className={styles.optional}>{t('common.optional')}</span>
          </div>
          <textarea
            id={captionId}
            className="form-input"
            rows={4}
            placeholder={t('reel.caption_placeholder')}
            value={formData.caption}
            maxLength={CAPTION_MAX}
            onChange={e => setFormData({ ...formData, caption: e.target.value })}
          />
          <span className={styles.counter} aria-live="polite">
            {t('media.caption_count', { count: formData.caption.length, max: CAPTION_MAX })}
          </span>
        </div>

        {/* Status is an UpdateReelDto field only — a new reel always starts active. */}
        {reel && (
          <div className="field">
            <label className="field-label" htmlFor={statusId}>{t('reel.status')}</label>
            <select
              id={statusId}
              className="form-input"
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as ReelStatus })}
            >
              <option value="active">{t('reel.status_active')}</option>
              <option value="hidden">{t('reel.status_hidden')}</option>
            </select>
          </div>
        )}

        {/* Last in the form: Modal focuses the first input on open, and a
            hidden file input can't take focus. */}
        <input
          type="file"
          ref={videoInputRef}
          hidden
          tabIndex={-1}
          accept="video/mp4,video/quicktime,video/webm"
          onChange={handleVideoChange}
        />
        <input
          type="file"
          ref={thumbnailInputRef}
          hidden
          tabIndex={-1}
          accept="image/*"
          onChange={handleThumbnailChange}
        />
      </form>
    </Modal>
  );
}
