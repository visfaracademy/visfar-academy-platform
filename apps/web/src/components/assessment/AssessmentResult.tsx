// Bao cao ca nhan sau danh gia 11D — dung chung cho trang cong khai
// /danh-gia-11d va trang lich su /hoc-vien/danh-gia-11d.
// Gom: diem tong, radar, diem tung phuong dien, 3 manh nhat, 3 can
// cham soc them, muc tieu goi y, lo trinh de xuat (khoa that), disclaimer.
'use client';

import Link from 'next/link';
import RadarChart from './RadarChart';
import {
  ASSESSMENT_DISCLAIMER,
  DIMENSIONS,
  buildRoadmap,
  formatScore,
  scoreBand,
  type Scores,
} from '@/lib/assessment-11d';

export default function AssessmentResult({
  scores,
  overall,
  previousScores,
  completedLabel,
  actions,
}: {
  scores: Scores;
  overall: number | null;
  previousScores?: Scores | null;
  completedLabel?: string;
  actions?: React.ReactNode;
}) {
  const { steps, keepStrong } = buildRoadmap(scores);

  return (
    <div className="assessment-result">
      <section className="card assessment-summary" aria-labelledby="ket-qua-title">
        <h2 id="ket-qua-title" className="gold-title">
          Báo cáo đánh giá của bạn
        </h2>
        {completedLabel && <p className="muted">{completedLabel}</p>}
        {overall !== null && (
          <p className="assessment-overall">
            Điểm trung bình 11 phương diện: <strong>{formatScore(overall)} / 5</strong>{' '}
            <span className="pill">{scoreBand(overall)}</span>
          </p>
        )}
        <p>
          Đây là bức tranh tự đánh giá của chính bạn tại thời điểm làm bài — không phải
          xếp loại, càng không phải thước đo giá trị con người.
        </p>
        <RadarChart scores={scores} previous={previousScores ?? null} />
      </section>

      <section className="assessment-scores" aria-labelledby="diem-tung-title">
        <h2 id="diem-tung-title" className="gold-title">
          Điểm từng phương diện
        </h2>
        <ul className="assessment-score-list">
          {DIMENSIONS.map((d) => {
            const s = scores[d.key];
            if (typeof s !== 'number') return null;
            return (
              <li key={d.key} className="assessment-score-row">
                <div className="assessment-score-head">
                  <span>
                    <strong>{d.num} · {d.name}</strong>{' '}
                    <span className="muted">— {d.description}</span>
                  </span>
                  <span className="assessment-score-value">
                    {formatScore(s)} / 5 · {scoreBand(s)}
                  </span>
                </div>
                <div
                  className="assessment-bar"
                  role="img"
                  aria-label={`${d.name}: ${formatScore(s)} trên 5`}
                >
                  <span style={{ width: `${(s / 5) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="assessment-two-col">
        <section className="card" aria-labelledby="manh-title">
          <h2 id="manh-title">Điểm mạnh tự nhận diện</h2>
          <p className="muted">3 phương diện bạn tự đánh giá cao nhất — nền để tiếp tục phát huy.</p>
          <ul>
            {keepStrong.map((r) => (
              <li key={r.dimension.key}>
                <strong>{r.dimension.num} · {r.dimension.name}</strong> — {formatScore(r.score)}/5
              </li>
            ))}
          </ul>
        </section>
        <section className="card" aria-labelledby="cai-thien-title">
          <h2 id="cai-thien-title">Điểm cần chăm sóc thêm</h2>
          <p className="muted">3 phương diện thấp nhất — không phải điểm yếu, mà là hướng ưu tiên tiếp theo.</p>
          <ul>
            {steps.map((s) => (
              <li key={s.dimension.key}>
                <strong>{s.dimension.num} · {s.dimension.name}</strong> — {formatScore(s.score)}/5
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="lo-trinh-title">
        <h2 id="lo-trinh-title" className="gold-title">
          Lộ trình đề xuất
        </h2>
        <p>
          Bắt đầu từ 3 phương diện cần chăm sóc thêm. Mỗi bước gồm một mục tiêu nhỏ
          và khóa học gợi ý — làm từng bước, đánh giá lại sau một chu kỳ để thấy thay đổi.
        </p>
        <ol className="assessment-roadmap">
          {steps.map((s, i) => (
            <li key={s.dimension.key} className="card">
              <h3>
                Bước {i + 1} · {s.dimension.num} {s.dimension.name} ({formatScore(s.score)}/5)
              </h3>
              <p>
                <strong>Mục tiêu gợi ý:</strong> {s.goal}
              </p>
              <p>
                <strong>Khóa học gợi ý:</strong>{' '}
                {s.courses.map((c, ci) => (
                  <span key={c.slug}>
                    {ci > 0 && ' · '}
                    <Link href={`/chuong-trinh/${c.slug}`}>{c.title}</Link>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {actions && <div className="assessment-actions">{actions}</div>}

      <p className="notice assessment-disclaimer" role="note">
        {ASSESSMENT_DISCLAIMER}
      </p>
    </div>
  );
}
