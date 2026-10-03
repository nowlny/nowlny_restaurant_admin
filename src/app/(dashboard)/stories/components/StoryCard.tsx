"use client";

import { Edit2, Eye, Loader2, Trash2, Video } from 'lucide-react';
import type { Story } from '@/services/api/stories';
import { isVideoUrl, videoPosterUrl } from '@/lib/reelMedia';
import { useI18n } from '@/lib/i18n';
import { usePreviewPlayback } from '@/components/media/usePreviewPlayback';
import styles from '@/components/media/media.module.css';

interface StoryCardProps {
  story: Story;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onShowViewers: () => void;
}

/** Where a story's clip and poster live — new stories use `videoUrl`, old ones put the clip in `imageUrl`. */
function storyMedia(story: Story) {
  if (story.videoUrl) {
    const poster = story.imageUrl && !isVideoUrl(story.imageUrl) ? story.imageUrl : videoPosterUrl(story.videoUrl);
    return { video: story.videoUrl, image: poster };
  }
  if (isVideoUrl(story.imageUrl)) return { video: story.imageUrl, image: videoPosterUrl(story.imageUrl) };
  return { video: null, image: story.imageUrl || null };
}

export default function StoryCard({ story, deleting, onEdit, onDelete, onShowViewers }: StoryCardProps) {
  const { t } = useI18n();
  const { video, image } = storyMedia(story);
  const { videoRef, handlers } = usePreviewPlayback(Boolean(video));

  return (
    <article className={`card ${styles.card}`} aria-busy={deleting}>
      <div className={styles.frame} {...handlers}>
        {video ? (
          <video
            ref={videoRef}
            src={video}
            poster={image ?? undefined}
            muted
            loop
            playsInline
            // With a poster nothing has to load until it plays; without one
            // the first frame (metadata) is the cheapest thing to show.
            preload={image ? 'none' : 'metadata'}
            aria-label={story.caption || t('stories.preview_alt')}
          />
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary Cloudinary URLs; next/image has no remotePatterns for them
          <img
            src={image}
            alt={story.caption || t('stories.preview_alt')}
            loading="lazy"
            decoding="async"
            width={360}
            height={640}
          />
        ) : null}

        <div className={styles.overlay}>
          <span className={styles.chip}>
            {video ? <Video size={12} aria-hidden="true" /> : <span className={styles.chipDot} aria-hidden="true" />}
            {video ? t('media.video_badge') : t('stories.active')}
          </span>
          <button type="button" className={styles.chip} onClick={onShowViewers}>
            <Eye size={13} aria-hidden="true" /> {t('stories.views')}
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <p className={`${styles.caption}${story.caption ? '' : ` ${styles.captionMuted}`}`}>
          {story.caption || t('stories.no_caption')}
        </p>
        <div className={styles.actions}>
          <button type="button" className="btn-outline btn-sm" onClick={onEdit} disabled={deleting}>
            <Edit2 size={15} /> {t('common.edit')}
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-danger"
            onClick={onDelete}
            disabled={deleting}
            aria-label={deleting ? t('common.deleting') : t('common.delete')}
            style={{ border: '1px solid var(--border-color)' }}
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>
    </article>
  );
}
