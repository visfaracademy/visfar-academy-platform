export const runtime = 'edge';
// Trang lam quiz: /hoc-vien/khoa-hoc/[courseSlug]/quiz/[quizId]
// De thi + nop bai + lich su do QuizPlayer xu ly (client): lay de qua
// GET /api/v1/quizzes/[quizId] (khong co dap an dung), nop qua POST
// .../submit (cham o server), lich su qua GET .../attempts.
import type { Metadata } from 'next';
import QuizPlayer from '@/components/quiz/QuizPlayer';

export const metadata: Metadata = {
  title: 'Làm bài kiểm tra | Visfar Academy',
};

export default async function QuizPage({
  params,
}: {
  params: Promise<{ courseSlug: string; quizId: string }>;
}) {
  const { courseSlug, quizId } = await params;
  return (
    <main className="wrap">
      <QuizPlayer quizId={quizId} courseSlug={courseSlug} />
    </main>
  );
}
