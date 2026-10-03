"use client";

import { useEffect, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { StoriesService } from '@/services/api/stories';
import { getApiErrorMessage } from '@/services/api/errors';
import { intlLocale, useI18n } from '@/lib/i18n';

type ViewersState =
  | { status: 'loading' }
  | { status: 'ready'; count: number }
  | { status: 'error'; message: string };

/**
 * How many customers saw a story. The API only returns a unique count
 * (`{ storyId, count }`), not who they were, so this shows the number rather
 * than a list. Mounted only while open, keyed by story.
 */
export default function StoryViewersModal({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [state, setState] = useState<ViewersState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    StoriesService.getStoryViewers(storyId)
      .then(({ count }) => {
        if (!cancelled) setState({ status: 'ready', count });
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch story viewers', err);
        // Fallback copy is resolved at render, so `t` stays out of the deps.
        if (!cancelled) setState({ status: 'error', message: getApiErrorMessage(err, '') });
      });
    return () => {
      cancelled = true;
    };
  }, [storyId, attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('media.viewers_title')}
      maxWidth={380}
      footer={
        <button type="button" className="btn-outline" onClick={onClose}>
          {t('common.close')}
        </button>
      }
    >
      {state.status === 'error' ? (
        <div className="notice notice-error" role="alert" style={{ alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{state.message || t('stories.view_count_failed')}</span>
          <button type="button" className="btn-outline btn-sm" onClick={retry}>
            <RefreshCw size={14} /> {t('common.retry')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center', padding: '8px 0' }}>
          <span
            aria-hidden="true"
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent-light)',
              color: 'var(--accent-primary)',
            }}
          >
            <Eye size={26} />
          </span>
          {state.status === 'loading' ? (
            <div className="skeleton" style={{ width: '96px', height: '48px' }} aria-label={t('common.loading')} />
          ) : (
            <strong className="force-ltr" style={{ fontSize: '44px', lineHeight: 1.1, fontWeight: 700 }}>
              {state.count.toLocaleString(intlLocale(locale))}
            </strong>
          )}
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{t('media.viewers_label')}</span>
          <p className="field-hint" style={{ maxWidth: '280px' }}>{t('media.viewers_hint')}</p>
        </div>
      )}
    </Modal>
  );
}
