"use client";

import { Edit2, Loader2, Trash2, UtensilsCrossed } from 'lucide-react';
import type { Reel } from '@/services/api/reels';
import { videoPosterUrl } from '@/lib/reelMedia';
import { useI18n } from '@/lib/i18n';
import styles from '@/components/media/media.module.css';

interface ReelCardProps {
  reel: Reel;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ReelCard({ reel, deleting, onEdit, onDelete }: ReelCardProps) {
  const { t } = useI18n();
  const poster = reel.thumbnailUrl || videoPosterUrl(reel.videoUrl);
  const isActive = reel.status !== 'hidden';

  return (
    <article className={`card ${styles.card}`} aria-busy={deleting}>
      <div className={styles.frame}>
        <video
          src={reel.videoUrl}
          poster={poster ?? undefined}
          controls
          playsInline
          // Nothing downloads until the owner presses play; a grid of reels
          // used to fetch every clip's metadata on page load.
          preload={poster ? 'none' : 'metadata'}
          aria-label={reel.caption || t('reels.title')}
        />
        <div className={styles.overlay}>
          <span className={styles.chip}>
            <span className={`${styles.chipDot}${isActive ? '' : ` ${styles.chipDotMuted}`}`} aria-hidden="true" />
            {isActive ? t('reels.active') : t('reels.hidden')}
          </span>
        </div>
      </div>

      <div className={styles.body}>
        <p className={`${styles.caption}${reel.caption ? '' : ` ${styles.captionMuted}`}`}>
          {reel.caption || t('reels.no_caption')}
        </p>

        {reel.menuItemId && (
          <span className="badge badge-accent" style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
            <UtensilsCrossed size={12} aria-hidden="true" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('reels.linked_item')}</span>
          </span>
        )}

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
