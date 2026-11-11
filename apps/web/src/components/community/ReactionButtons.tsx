// Nut tha cam xuc cho bai viet cong dong (Prompt 13).
// Bam lai cam xuc da tha = bo cam xuc (toggle o lib).
'use client';

import { useState } from 'react';
import {
  REACTION_TYPES,
  toggleReaction,
  type ReactionCounts,
  type ReactionType,
} from '@/lib/community';

const REACTION_ICON: Record<ReactionType, string> = {
  like: '👍',
  helpful: '💡',
  celebrate: '🎉',
};

export default function ReactionButtons({
  postId,
  counts,
  myReactions,
  onChanged,
}: {
  postId: string;
  counts: ReactionCounts;
  myReactions: ReactionType[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<ReactionType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(type: ReactionType) {
    setBusy(type);
    setError(null);
    const res = await toggleReaction({ postId }, type);
    setBusy(null);
    if (res.status !== 'ok') {
      setError(res.status === 'signed-out' ? 'Bạn cần đăng nhập để thả cảm xúc.' : res.message);
      return;
    }
    onChanged();
  }

  return (
    <div>
      <div className="reaction-row" role="group" aria-label="Thả cảm xúc">
        {REACTION_TYPES.map((r) => {
          const active = myReactions.includes(r.type);
          return (
            <button
              key={r.type}
              type="button"
              className={`btn btn-small reaction-btn${active ? ' active' : ''}`}
              disabled={busy !== null}
              aria-pressed={active}
              onClick={() => void handle(r.type)}
            >
              {REACTION_ICON[r.type]} {r.label} ({counts[r.type]})
            </button>
          );
        })}
      </div>
      {busy && (
        <p role="status" aria-live="polite">
          Đang lưu cảm xúc…
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
