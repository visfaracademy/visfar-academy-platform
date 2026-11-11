// LessonPlayer — Task 07 (2/4). Phat video YouTube (unlisted, QĐ 16),
// theo doi vi tri, luu debounced, tu hoan thanh khi >= 90% (QĐ 17).
// Bai text/file/audio: nut "Da hoan thanh" (khong tu hoan thanh khi mo).
// Ghi tien do qua Workers API (lib/progress.ts) — Workers chua deploy
// thi hien loi ro, khong bao "ok" gia, video van xem duoc.
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  VIDEO_COMPLETION_THRESHOLD,
  VIDEO_POLL_INTERVAL_MS,
  extractYouTubeVideoId,
  formatPosition,
  markLessonComplete,
  markLessonOpened,
  ProgressSaver,
  saveLessonProgress,
  videoProgressPercent,
  type LessonProgressRow,
  type LessonType,
  type SaveProgressResult,
} from '@/lib/progress';

export interface PlayerLesson {
  id: string;
  courseId: string;
  title: string;
  type: string;
  videoUrl: string | null;
  videoDurationSec: number | null;
  fileUrl: string | null;
  content: string | null;
  isFreePreview: boolean;
}

interface LessonPlayerProps {
  lesson: PlayerLesson;
  initialProgress: LessonProgressRow | null;
  onProgressSaved?: (progress: LessonProgressRow) => void;
  onCompleted?: (lessonId: string) => void;
}

// --- YouTube IFrame API (khong dung lib ngoai) ------------------------------
type YTPlayerStateValue = -1 | 0 | 1 | 2 | 3 | 5;

interface YTPlayer {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => YTPlayerStateValue;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
}

interface YTPlayerOptions {
  videoId: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: () => void;
    onStateChange?: (event: { data: YTPlayerStateValue }) => void;
    onError?: () => void;
  };
}

interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('YouTube API chỉ chạy trên trình duyệt.'));
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previous) previous();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.onerror = () => {
      ytApiPromise = null;
      reject(new Error('Không tải được YouTube. Vui lòng kiểm tra mạng và thử lại.'));
    };
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

function isAudioUrl(url: string | null): boolean {
  if (!url) return false;
  return /\.(mp3|m4a|wav|ogg|aac)(\?|#|$)/i.test(url);
}

export default function LessonPlayer({
  lesson,
  initialProgress,
  onProgressSaved,
  onCompleted,
}: LessonPlayerProps) {
  const videoId = extractYouTubeVideoId(lesson.videoUrl);
  const initialPositionSec = initialProgress?.video_position ?? initialProgress?.last_position_sec ?? 0;
  const initialCompleted =
    initialProgress?.completion_status === 'completed' || initialProgress?.status === 'completed';
  const initialPercent = initialProgress?.progress_percent ?? 0;

  const [playerStatus, setPlayerStatus] = useState<'loading' | 'ready' | 'error'>(
    lesson.type === 'video' ? 'loading' : 'ready',
  );
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [positionSec, setPositionSec] = useState<number>(initialPositionSec);
  const [durationSec, setDurationSec] = useState<number | null>(lesson.videoDurationSec);
  const [progressPercent, setProgressPercent] = useState<number>(initialPercent);
  const [completed, setCompleted] = useState<boolean>(initialCompleted);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saverRef = useRef<ProgressSaver | null>(null);
  const completedRef = useRef<boolean>(initialCompleted);
  const durationSecRef = useRef<number | null>(lesson.videoDurationSec);
  durationSecRef.current = durationSec;
  const onProgressSavedRef = useRef(onProgressSaved);
  const onCompletedRef = useRef(onCompleted);
  onProgressSavedRef.current = onProgressSaved;
  onCompletedRef.current = onCompleted;

  const lessonType = lesson.type as LessonType;
  const isVideo = lesson.type === 'video';
  const isAudio = lesson.type === 'file' && isAudioUrl(lesson.fileUrl);

  // Mo bai: cap nhat last_accessed (+ started_at lan dau). Chi mo bai
  // KHONG doi completion_status — server tra ve progress cu neu chua
  // du dieu kien hoan thanh (xem lib/progress.ts).
  useEffect(() => {
    let alive = true;
    void markLessonOpened(lesson.id, lesson.courseId, lessonType).then((res) => {
      if (!alive) return;
      if (res.status === 'error') {
        setSaveMessage(`Chưa ghi nhận được lần mở bài: ${res.message}`);
      } else if (res.status === 'ok') {
        onProgressSavedRef.current?.(res.progress);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  // Tao ProgressSaver (debounce 5s) cho video / audio.
  useEffect(() => {
    if (!isVideo && !isAudio) return;
    const saver = new ProgressSaver(
      async (pos): Promise<SaveProgressResult> => {
        const res = await saveLessonProgress({
          lessonId: lesson.id,
          courseId: lesson.courseId,
          lessonType,
          positionSec: pos,
          durationSec: durationSecRef.current,
        });
        if (res.status === 'ok') {
          onProgressSavedRef.current?.(res.progress);
          const done =
            res.progress.completion_status === 'completed' || res.progress.status === 'completed';
          if (done && !completedRef.current) {
            completedRef.current = true;
            setCompleted(true);
            onCompletedRef.current?.(lesson.id);
          }
        } else if (res.status === 'error') {
          setSaveMessage(`Chưa lưu được tiến độ: ${res.message}`);
        }
        return res;
      },
      { initialPositionSec },
    );
    saverRef.current = saver;
    return () => {
      saver.dispose();
      saverRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, isVideo, isAudio]);

  // YouTube player: tao 1 lan theo bai hoc.
  useEffect(() => {
    if (!isVideo || !videoId || !containerRef.current) return;
    let alive = true;
    let player: YTPlayer | null = null;
    setPlayerStatus('loading');
    setPlayerError(null);
    loadYouTubeApi()
      .then(() => {
        if (!alive || !containerRef.current || !window.YT) return;
        player = new window.YT.Player(containerRef.current, {
          videoId,
          playerVars: {
            start: initialPositionSec > 0 ? initialPositionSec : 0,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => {
              if (!alive || !player) return;
              setPlayerStatus('ready');
              const dur = player.getDuration();
              if (Number.isFinite(dur) && dur > 0) {
                durationSecRef.current = Math.floor(dur);
                setDurationSec(Math.floor(dur));
              }
              if (initialPositionSec > 0) player.seekTo(initialPositionSec, true);
            },
            onStateChange: (event) => {
              if (!alive || !player) return;
              if (event.data === 1) {
                // PLAYING: poll vi tri moi 5 giay.
                if (pollRef.current !== null) clearInterval(pollRef.current);
                pollRef.current = setInterval(() => {
                  if (!player) return;
                  const pos = Math.floor(player.getCurrentTime());
                  const dur = player.getDuration();
                  const durSec =
                    Number.isFinite(dur) && dur > 0 ? Math.floor(dur) : durationSecRef.current;
                  if (durSec) durationSecRef.current = durSec;
                  const pct = videoProgressPercent(pos, durSec);
                  setPositionSec(pos);
                  setDurationSec(durSec);
                  setProgressPercent(pct);
                  saverRef.current?.update(pos, durSec);
                  if (pct >= VIDEO_COMPLETION_THRESHOLD && !completedRef.current) {
                    void saverRef.current?.flush();
                  }
                }, VIDEO_POLL_INTERVAL_MS);
              } else {
                // PAUSED / ENDED / khac: dung poll + luu ngay.
                if (pollRef.current !== null) {
                  clearInterval(pollRef.current);
                  pollRef.current = null;
                }
                void saverRef.current?.flush();
              }
            },
            onError: () => {
              if (!alive) return;
              setPlayerStatus('error');
              setPlayerError('Không phát được video này. Vui lòng thử lại sau.');
            },
          },
        });
        playerRef.current = player;
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setPlayerStatus('error');
        setPlayerError(err instanceof Error ? err.message : 'Không tải được YouTube.');
      });
    return () => {
      alive = false;
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      void saverRef.current?.flush();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, videoId, isVideo]);

  // Luu khi roi trang / an tab (best-effort — duong chinh van la
  // luu khi tam dung + debounce khi dang phat).
  useEffect(() => {
    const flush = () => {
      void saverRef.current?.flush();
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const handleAudioTimeUpdate = (event: React.SyntheticEvent<HTMLAudioElement>) => {
    const el = event.currentTarget;
    const pos = Math.floor(el.currentTime);
    const dur = Number.isFinite(el.duration) && el.duration > 0 ? Math.floor(el.duration) : null;
    if (dur) {
      durationSecRef.current = dur;
      setDurationSec(dur);
    }
    setPositionSec(pos);
    setProgressPercent(videoProgressPercent(pos, dur));
    saverRef.current?.update(pos, dur);
  };

  const handleCompleteClick = async () => {
    setSaving(true);
    setSaveMessage(null);
    const audioPos = isAudio ? positionSec : null;
    const res = await markLessonComplete(
      lesson.id,
      lesson.courseId,
      lessonType,
      audioPos,
      durationSec,
    );
    setSaving(false);
    if (res.status === 'blocked') {
      setSaveMessage(res.reason);
    } else if (res.status === 'error') {
      setSaveMessage(`Chưa lưu được: ${res.message}`);
    } else if (res.status === 'signed-out') {
      setSaveMessage('Bạn chưa đăng nhập.');
    } else if (res.status === 'not-configured') {
      setSaveMessage('Chưa cấu hình Supabase.');
    } else if (res.status === 'ok') {
      completedRef.current = true;
      setCompleted(true);
      setProgressPercent(res.progress.progress_percent);
      onProgressSavedRef.current?.(res.progress);
      onCompletedRef.current?.(lesson.id);
    }
  };

  return (
    <section className="card lesson-player" aria-labelledby="lesson-player-title">
      <h2 id="lesson-player-title">{lesson.title}</h2>
      <p>
        {completed ? (
          <strong>✓ Đã hoàn thành</strong>
        ) : (
          <>
            Đã học {progressPercent}%{' '}
            {initialPositionSec > 0 && !completed && positionSec <= initialPositionSec
              ? `— tiếp tục từ ${formatPosition(initialPositionSec)}`
              : positionSec > 0
                ? `— đang ở ${formatPosition(positionSec)}`
                : ''}
          </>
        )}
      </p>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Tiến độ ${lesson.title}`}
      >
        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {isVideo && !videoId && (
        <div className="notice error" role="alert">
          <p>Bài học chưa có link video YouTube.</p>
        </div>
      )}
      {isVideo && videoId && (
        <div className="video-wrap">
          {playerStatus === 'loading' && (
            <p role="status" aria-live="polite">
              Đang tải video…
            </p>
          )}
          {playerStatus === 'error' && playerError && (
            <div className="notice error" role="alert">
              <p>{playerError}</p>
            </div>
          )}
          <div ref={containerRef} aria-label={`Video bài ${lesson.title}`} />
        </div>
      )}
      {isVideo && (
        <p className="muted">
          Video tự động hoàn thành khi bạn xem đủ {VIDEO_COMPLETION_THRESHOLD}%. Vị trí xem được
          lưu khi bạn tạm dừng hoặc rời trang.
        </p>
      )}

      {lesson.type === 'text' && lesson.content && <p>{lesson.content}</p>}
      {lesson.type === 'text' && !lesson.content && (
        <p className="muted">Bài đọc chưa có nội dung.</p>
      )}

      {lesson.type === 'file' && (
        <div>
          {isAudio && lesson.fileUrl ? (
            <audio
              controls
              src={lesson.fileUrl}
              onTimeUpdate={handleAudioTimeUpdate}
              onPause={() => void saverRef.current?.flush()}
              style={{ width: '100%' }}
            >
              Trình duyệt của bạn không hỗ trợ phát audio.
            </audio>
          ) : lesson.fileUrl ? (
            <p>
              <a className="btn btn-ghost" href={lesson.fileUrl} target="_blank" rel="noreferrer">
                Mở / tải tài liệu (PDF)
              </a>
            </p>
          ) : (
            <p className="muted">Bài học chưa có file đính kèm.</p>
          )}
        </div>
      )}

      {lesson.type === 'quiz' && (
        <p className="muted">Bài quiz được hoàn thành khi bạn nộp bài làm (phần Quiz).</p>
      )}

      {(lesson.type === 'text' || lesson.type === 'file') && !completed && (
        <p>
          <button type="button" className="btn" disabled={saving} onClick={() => void handleCompleteClick()}>
            {saving ? 'Đang lưu…' : 'Đã hoàn thành'}
          </button>
        </p>
      )}
      {completed && (lesson.type === 'text' || lesson.type === 'file') && (
        <p>
          <strong>✓ Bạn đã hoàn thành bài này.</strong>
        </p>
      )}

      {saveMessage && (
        <div className="notice" role="status">
          <p>{saveMessage}</p>
        </div>
      )}
    </section>
  );
}
