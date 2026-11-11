// Danh gia dau vao 11 phuong dien — Thap Nhat Vien Man (Prompt 11).
// - 11 phuong dien theo dung thu tu/tên da chot tren trang chu:
//   01 Tam thuc, 02 Tam thai, 03 Tam dao, 04 Tri tue, 05 Nghi luc,
//   06 The chat, 07 Tinh than, 08 Pham chat, 09 Nhan cach, 10 Nang luc,
//   11 Vat chat. KHONG sua triet ly goc.
// - Moi phuong dien 3 cau, thang 1–5, cau hoi mo ta hanh vi cu the,
//   khong dan dat, khong phan xet. Diem so CHI de tu nhan dien huong
//   phat trien, KHONG dung de dinh gia nhan pham; day KHONG phai chan
//   doan tam ly hay danh gia lam sang da duoc chuan hoa.
// - Luu that vao Supabase (bang assessments_11d, migration 0027);
//   lam bai khong can dang nhap (luu nhap localStorage), luu ket qua
//   + xem lai thi can dang nhap.
import { getSupabaseBrowserClient, isSupabaseConfigured } from './supabase';
import { HOME_COURSES } from './homepage-data';

export const ASSESSMENT_DISCLAIMER =
  'Công cụ tự đánh giá tham khảo, không thay thế chẩn đoán chuyên môn.';

export interface Dimension {
  key: string;
  num: string;
  name: string;
  description: string;
  /** Muc tieu goi y ngan cho phuong dien nay. */
  goal: string;
}

export const DIMENSIONS: Dimension[] = [
  { key: 'tam-thuc', num: '01', name: 'Tâm thức', description: 'Nhận thức nội tâm — gốc rễ của suy nghĩ, cảm xúc và hành vi.', goal: 'Thực hành quan sát nội tâm 10 phút mỗi ngày trong 2 tuần.' },
  { key: 'tam-thai', num: '02', name: 'Tâm thái', description: 'Trạng thái cảm xúc nội tâm: an vui, bao dung, trân trọng biết ơn.', goal: 'Mỗi tối ghi lại 3 điều khiến mình biết ơn trong ngày.' },
  { key: 'tam-dao', num: '03', name: 'Tâm đạo', description: 'Sống theo đạo lý và chuẩn mực làm người, nhất quán giữa lời nói và việc làm.', goal: 'Chọn một chuẩn mực sống và thực hành nhất quán trong 30 ngày.' },
  { key: 'tri-tue', num: '04', name: 'Trí tuệ', description: 'Biết – hiểu – thấu suốt – chuyển hóa; nhìn đa chiều trước khi kết luận.', goal: 'Mỗi tuần phân tích một vấn đề từ 3 góc nhìn khác nhau.' },
  { key: 'nghi-luc', num: '05', name: 'Nghị lực', description: 'Kiên trì, kỷ luật và giữ cam kết với bản thân, kể cả khi gặp khó.', goal: 'Chọn một thói quen nhỏ và duy trì liên tục 21 ngày.' },
  { key: 'the-chat', num: '06', name: 'Thể chất', description: 'Sức khỏe thân thể, năng lượng và thói quen chăm sóc thân mỗi ngày.', goal: 'Vận động 30 phút, 4 buổi mỗi tuần; ngủ trước 23 giờ.' },
  { key: 'tinh-than', num: '07', name: 'Tinh thần', description: 'Đời sống tinh thần, ý nghĩa sống và sự bình an bên trong.', goal: 'Dành 15 phút lặng yên mỗi sáng, không điện thoại.' },
  { key: 'pham-chat', num: '08', name: 'Phẩm chất', description: 'Nhân – Nghĩa – Lễ – Trí – Tín trong ứng xử hằng ngày.', goal: 'Thực hành một hành động tử tế cụ thể mỗi ngày.' },
  { key: 'nhan-cach', num: '09', name: 'Nhân cách', description: 'Vui vẻ, hy vọng, niềm tin, trí tuệ, trân trọng biết ơn, yêu thương, bao dung, khiêm tốn, chân thật.', goal: 'Mỗi ngày ghi nhận một điểm tốt ở một người xung quanh.' },
  { key: 'nang-luc', num: '10', name: 'Năng lực', description: 'Quan niệm, quan hệ xã hội và chuyên môn — học rồi áp dụng.', goal: 'Hoàn thành một kỹ năng nhỏ và áp dụng ngay trong tuần này.' },
  { key: 'vat-chat', num: '11', name: 'Vật chất', description: 'Làm chủ tiền bạc và nhu cầu vật chất một cách đủ đầy, cân bằng.', goal: 'Lập bảng thu – chi tháng này và đặt mục tiêu tiết kiệm cụ thể.' },
];

export const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key);
export const DIMENSION_BY_KEY: Record<string, Dimension> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.key, d]),
);

export interface AssessmentQuestion {
  id: string;
  dimensionKey: string;
  text: string;
  /** Giai thich ngan: cau nay dang soi vao dau. */
  hint: string;
}

export const SCALE_LABELS: { value: number; label: string }[] = [
  { value: 1, label: 'Rất ít' },
  { value: 2, label: 'Ít' },
  { value: 3, label: 'Vừa phải' },
  { value: 4, label: 'Thường xuyên' },
  { value: 5, label: 'Rất thường xuyên' },
];

export const QUESTIONS: AssessmentQuestion[] = [
  // 01 Tam thuc
  { id: 'tam-thuc-1', dimensionKey: 'tam-thuc', text: 'Tôi nhận ra suy nghĩ của mình đang diễn ra như thế nào trong ngày.', hint: 'Quan sát suy nghĩ là bước đầu làm chủ nhận thức.' },
  { id: 'tam-thuc-2', dimensionKey: 'tam-thuc', text: 'Tôi hiểu vì sao mình phản ứng như vậy trước một tình huống khó.', hint: 'Hiểu gốc rễ phản ứng giúp mình lựa chọn thay vì phản ứng tự động.' },
  { id: 'tam-thuc-3', dimensionKey: 'tam-thuc', text: 'Tôi có thể dừng lại một nhịp trước khi nói hoặc hành động khi đang xúc động.', hint: 'Khoảng dừng giữa cảm xúc và hành động là nơi mình làm chủ.' },
  // 02 Tam thai
  { id: 'tam-thai-1', dimensionKey: 'tam-thai', text: 'Tôi giữ được sự bình thản khi gặp chuyện không như ý.', hint: 'Bình thản không có nghĩa là không cảm xúc, mà là không bị cảm xúc cuốn đi.' },
  { id: 'tam-thai-2', dimensionKey: 'tam-thai', text: 'Tôi dễ dàng cảm thấy biết ơn với những điều nhỏ trong ngày.', hint: 'Trân trọng biết ơn nuôi dưỡng tâm thái an vui.' },
  { id: 'tam-thai-3', dimensionKey: 'tam-thai', text: 'Tôi bao dung với lỗi lầm của người khác thay vì giữ trong lòng.', hint: 'Bao dung là trạng thái nội tâm không dính mắc với lỗi của người khác.' },
  // 03 Tam dao
  { id: 'tam-dao-1', dimensionKey: 'tam-dao', text: 'Tôi hành xử theo những chuẩn mực mà mình tin là đúng, kể cả khi không ai nhìn thấy.', hint: 'Nhất quán khi không có ai chứng kiến mới cho thấy chuẩn mực đã thành của mình.' },
  { id: 'tam-dao-2', dimensionKey: 'tam-dao', text: 'Lời nói của tôi nhất quán với việc tôi làm.', hint: 'Nói những gì mình làm và làm những gì mình nói.' },
  { id: 'tam-dao-3', dimensionKey: 'tam-dao', text: 'Tôi cân nhắc điều đúng và ảnh hưởng tới người khác trước khi quyết định.', hint: 'Quyết định có đạo lý là quyết định thấy được cả mình và người.' },
  // 04 Tri tue
  { id: 'tri-tue-1', dimensionKey: 'tri-tue', text: 'Tôi nhìn một vấn đề từ nhiều góc khác nhau trước khi kết luận.', hint: 'Đa góc nhìn giúp mình tránh kết luận vội từ một phía.' },
  { id: 'tri-tue-2', dimensionKey: 'tri-tue', text: 'Tôi phân biệt được đâu là sự thật, đâu là suy đoán của mình.', hint: 'Tách sự thật khỏi suy đoán là nền của tư duy sáng suốt.' },
  { id: 'tri-tue-3', dimensionKey: 'tri-tue', text: 'Tôi rút ra được bài học cụ thể sau mỗi trải nghiệm.', hint: 'Trải nghiệm chỉ thành trí tuệ khi được rút ra bài học.' },
  // 05 Nghi luc
  { id: 'nghi-luc-1', dimensionKey: 'nghi-luc', text: 'Tôi duy trì được một thói quen tốt dù bận rộn.', hint: 'Nghị lực thể hiện ở những ngày bận, không chỉ những ngày rảnh.' },
  { id: 'nghi-luc-2', dimensionKey: 'nghi-luc', text: 'Tôi quay lại mục tiêu của mình sau khi bị gián đoạn.', hint: 'Gián đoạn là bình thường; quay lại mới là nghị lực.' },
  { id: 'nghi-luc-3', dimensionKey: 'nghi-luc', text: 'Tôi hoàn thành những việc đã cam kết với bản thân.', hint: 'Giữ lời hứa với chính mình xây dựng niềm tin nội tâm.' },
  // 06 The chat
  { id: 'the-chat-1', dimensionKey: 'the-chat', text: 'Tôi ngủ đủ và thức dậy thấy cơ thể được hồi phục.', hint: 'Giấc ngủ là nền hồi phục của thân thể.' },
  { id: 'the-chat-2', dimensionKey: 'the-chat', text: 'Tôi vận động cơ thể đều đặn trong tuần.', hint: 'Vận động đều, dù ít, hơn một đợt lớn rồi bỏ.' },
  { id: 'the-chat-3', dimensionKey: 'the-chat', text: 'Tôi ăn uống điều độ và lắng nghe cơ thể mình.', hint: 'Chăm sóc thân bắt đầu từ việc lắng nghe thân.' },
  // 07 Tinh than
  { id: 'tinh-than-1', dimensionKey: 'tinh-than', text: 'Tôi thấy cuộc sống của mình có ý nghĩa và hướng đi rõ ràng.', hint: 'Ý nghĩa sống là la bàn cho những lựa chọn hằng ngày.' },
  { id: 'tinh-than-2', dimensionKey: 'tinh-than', text: 'Tôi có những khoảng lặng để kết nối với chính mình.', hint: 'Khoảng lặng giúp mình nghe được tiếng nói bên trong.' },
  { id: 'tinh-than-3', dimensionKey: 'tinh-than', text: 'Tôi giữ được niềm tin khi đối mặt với khó khăn.', hint: 'Niềm tin là trạng thái cảm nhận mình đủ nguồn lực để đi tiếp.' },
  // 08 Pham chat
  { id: 'pham-chat-1', dimensionKey: 'pham-chat', text: 'Tôi đối xử với người khác bằng sự tôn trọng và chân thành.', hint: 'Tôn trọng và chân thành là nền của mọi mối quan hệ.' },
  { id: 'pham-chat-2', dimensionKey: 'pham-chat', text: 'Tôi giữ lời hứa của mình.', hint: 'Chữ tín xây dựng qua từng lời hứa nhỏ được giữ.' },
  { id: 'pham-chat-3', dimensionKey: 'pham-chat', text: 'Tôi chủ động giúp đỡ người khác khi có thể.', hint: 'Giúp đỡ khi có thể, không đợi đến khi hoàn hảo mới cho đi.' },
  // 09 Nhan cach
  { id: 'nhan-cach-1', dimensionKey: 'nhan-cach', text: 'Tôi vui vẻ và cởi mở khi gặp gỡ người khác.', hint: 'Sự vui vẻ, cởi mở mở ra kết nối với con người.' },
  { id: 'nhan-cach-2', dimensionKey: 'nhan-cach', text: 'Tôi nhìn thấy điểm tốt ở người khác trước khi nhìn thấy điểm chưa tốt.', hint: 'Góc nhìn về con người quyết định cách mình đối đãi.' },
  { id: 'nhan-cach-3', dimensionKey: 'nhan-cach', text: 'Tôi khiêm tốn nhận rằng thành tựu của mình có phần đóng góp của người khác.', hint: 'Khiêm tốn là cảm nhận thành tựu của mình do người khác mang lại.' },
  // 10 Nang luc
  { id: 'nang-luc-1', dimensionKey: 'nang-luc', text: 'Tôi học được điều mới và áp dụng vào công việc hoặc cuộc sống.', hint: 'Năng lực lớn lên khi điều học được đưa vào thực tiễn.' },
  { id: 'nang-luc-2', dimensionKey: 'nang-luc', text: 'Tôi giao tiếp rõ ràng và lắng nghe người khác.', hint: 'Giao tiếp tốt là nói rõ và nghe trọn vẹn.' },
  { id: 'nang-luc-3', dimensionKey: 'nang-luc', text: 'Tôi sắp xếp công việc theo thứ tự ưu tiên và hoàn thành đúng hẹn.', hint: 'Ưu tiên và đúng hẹn là năng lực tổ chức của bản thân.' },
  // 11 Vat chat
  { id: 'vat-chat-1', dimensionKey: 'vat-chat', text: 'Tôi biết rõ thu – chi của mình trong tháng.', hint: 'Biết rõ dòng tiền là bước đầu làm chủ vật chất.' },
  { id: 'vat-chat-2', dimensionKey: 'vat-chat', text: 'Tôi dành một phần thu nhập để tiết kiệm hoặc đầu tư trước khi chi tiêu.', hint: 'Tiết kiệm trước, chi tiêu sau — thứ tự tạo ra sự đủ đầy.' },
  { id: 'vat-chat-3', dimensionKey: 'vat-chat', text: 'Tôi hài lòng với những gì mình đang có mà vẫn có kế hoạch cải thiện.', hint: 'Đủ đầy là hài lòng với hiện tại và vẫn hướng tới tốt hơn.' },
];

export type Answers = Record<string, number>;
export type Scores = Record<string, number>;

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Diem trung binh moi phuong dien (chi tinh khi du 3 cau). */
export function computeScores(answers: Answers): { scores: Scores; overall: number | null } {
  const scores: Scores = {};
  for (const dim of DIMENSIONS) {
    const qs = QUESTIONS.filter((q) => q.dimensionKey === dim.key);
    const vals = qs
      .map((q) => answers[q.id])
      .filter((v) => typeof v === 'number' && v >= 1 && v <= 5);
    if (vals.length === qs.length) {
      scores[dim.key] = round1(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }
  const done = Object.values(scores);
  const overall = done.length === DIMENSIONS.length ? round1(done.reduce((a, b) => a + b, 0) / done.length) : null;
  return { scores, overall };
}

export function isComplete(answers: Answers): boolean {
  return QUESTIONS.every((q) => typeof answers[q.id] === 'number' && answers[q.id] >= 1 && answers[q.id] <= 5);
}

export function answeredCount(answers: Answers): number {
  return QUESTIONS.filter((q) => typeof answers[q.id] === 'number').length;
}

/** Nhan diem: >= 4 dang vung, 3–<4 dang phat trien, < 3 can cham soc them. */
export function scoreBand(score: number): string {
  if (score >= 4) return 'Đang vững';
  if (score >= 3) return 'Đang phát triển';
  return 'Cần chăm sóc thêm';
}

export interface RankedDimension {
  dimension: Dimension;
  score: number;
}

export function rankDimensions(scores: Scores): RankedDimension[] {
  return DIMENSIONS.filter((d) => typeof scores[d.key] === 'number')
    .map((d) => ({ dimension: d, score: scores[d.key] }))
    .sort((a, b) => b.score - a.score);
}

export function strongestDimensions(scores: Scores, n = 3): RankedDimension[] {
  return rankDimensions(scores).slice(0, n);
}

export function weakestDimensions(scores: Scores, n = 3): RankedDimension[] {
  return rankDimensions(scores).slice(-n).reverse();
}

// --- Map phuong dien -> khoa hoc THAT trong 10 khoa hien co ---
export interface CourseSuggestion {
  slug: string;
  title: string;
}

const COURSE_BY_SLUG: Record<string, string> = Object.fromEntries(
  HOME_COURSES.map((c) => [c.slug, c.title]),
);

/** Map dung nhu yeu cau: Tam thuc -> 01/02, Tri tue -> 03, The chat -> 04,
    Moi quan he -> 05, Tai chinh (Vat chat) -> 06; cac phuong dien con lai
    map vao khoa tich hop / chuyen sau phu hop (07/08/09). */
export const DIMENSION_COURSES: Record<string, string[]> = {
  'tam-thuc': ['thau-hieu-tam-thuc', 'thau-hieu-noi-tam'],
  'tam-thai': ['thau-hieu-noi-tam', 'thau-hieu-moi-quan-he'],
  'tam-dao': ['chuyen-gia-tu-van', 'master-tam-thuc-nhan-hieu'],
  'tri-tue': ['thau-hieu-tri-tue'],
  'nghi-luc': ['coaching-90-ngay', 'chuyen-gia-tu-van'],
  'the-chat': ['thau-hieu-suc-khoe'],
  'tinh-than': ['thau-hieu-noi-tam', 'thau-hieu-suc-khoe'],
  'pham-chat': ['master-tam-thuc-nhan-hieu', 'chuyen-gia-tu-van'],
  'nhan-cach': ['master-tam-thuc-nhan-hieu', 'thau-hieu-moi-quan-he'],
  'nang-luc': ['master-tam-thuc-nhan-hieu', 'coaching-90-ngay'],
  'vat-chat': ['thau-hieu-tai-chinh', 'thau-hieu-suc-khoe'],
};

export function suggestedCourses(dimensionKey: string): CourseSuggestion[] {
  return (DIMENSION_COURSES[dimensionKey] ?? [])
    .filter((slug) => COURSE_BY_SLUG[slug])
    .map((slug) => ({ slug, title: COURSE_BY_SLUG[slug] }));
}

/** Lo trinh de xuat: bat dau tu 3 phuong dien thap nhat — moi phuong dien
    1 muc tieu + khoa hoc goi y; ket thuc bang buoc duy tri 3 manh nhat. */
export interface RoadmapStep {
  dimension: Dimension;
  score: number;
  goal: string;
  courses: CourseSuggestion[];
}

export function buildRoadmap(scores: Scores): { steps: RoadmapStep[]; keepStrong: RankedDimension[] } {
  const weakest = weakestDimensions(scores, 3);
  const steps: RoadmapStep[] = weakest.map((w) => ({
    dimension: w.dimension,
    score: w.score,
    goal: w.dimension.goal,
    courses: suggestedCourses(w.dimension.key),
  }));
  return { steps, keepStrong: strongestDimensions(scores, 3) };
}

// --- Toa do radar (SVG thuan, khong them lib) ---
export interface RadarPoint {
  x: number;
  y: number;
}

export function radarPoints(scores: Scores, size = 340, maxRadius = 120): RadarPoint[] {
  const cx = size / 2;
  const cy = size / 2;
  return DIMENSIONS.map((d, i) => {
    const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
    const v = typeof scores[d.key] === 'number' ? scores[d.key] : 0;
    const r = (v / 5) * maxRadius;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

export function radarPolygon(scores: Scores, size = 340, maxRadius = 120): string {
  return radarPoints(scores, size, maxRadius)
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
}

// --- Luu nhap tam (chua dang nhap) ---
export const DRAFT_KEY = 'visfar-11d-draft-v1';

export function loadDraft(): Answers {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Answers = {};
    for (const q of QUESTIONS) {
      const v = parsed[q.id];
      if (typeof v === 'number' && v >= 1 && v <= 5) out[q.id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDraft(answers: Answers): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
  } catch {
    // Bo qua — localStorage day/khong dung duoc thi bai van chay.
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Bo qua.
  }
}

// --- Supabase: luu / doc that ---
export interface AssessmentRow {
  id: string;
  user_id: string;
  answers: Answers;
  scores: Scores;
  overall_score: number | null;
  completed_at: string;
  created_at: string;
}

export type SaveAssessmentResult =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string };

export async function saveAssessment(answers: Answers): Promise<SaveAssessmentResult> {
  const { scores, overall } = computeScores(answers);
  if (overall === null) {
    return { status: 'error', message: 'Bạn chưa trả lời đủ 33 câu. Vui lòng hoàn thành hết bài trước khi lưu.' };
  }
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  }
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return { status: 'error', message: 'Bạn chưa đăng nhập. Vui lòng đăng nhập để lưu kết quả.' };
    const { data, error } = await supabase
      .from('assessments_11d')
      .insert({
        user_id: user.id,
        answers,
        scores,
        overall_score: overall,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) return { status: 'error', message: 'Không lưu được kết quả. Vui lòng thử lại.' };
    return { status: 'ok', id: String((data as { id: string }).id) };
  } catch {
    return { status: 'error', message: 'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.' };
  }
}

export type AssessmentsState =
  | { status: 'loading' }
  | { status: 'success'; items: AssessmentRow[] }
  | { status: 'error'; message: string; isOffline: boolean }
  | { status: 'signed-out' }
  | { status: 'not-configured' };

export async function fetchMyAssessments(): Promise<AssessmentsState> {
  if (!isSupabaseConfigured()) return { status: 'not-configured' };
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: 'not-configured' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const { data, error } = await supabase
      .from('assessments_11d')
      .select('id, user_id, answers, scores, overall_score, completed_at, created_at')
      .order('completed_at', { ascending: false });
    if (error) return { status: 'error', message: 'Không tải được lịch sử đánh giá.', isOffline: false };
    const items = ((data ?? []) as unknown as AssessmentRow[]).map((r) => ({
      ...r,
      answers: (r.answers ?? {}) as Answers,
      scores: (r.scores ?? {}) as Scores,
    }));
    return { status: 'success', items };
  } catch (err) {
    const isOffline =
      err instanceof TypeError || (err instanceof Error && /network|fetch|Failed to fetch/i.test(err.message));
    return {
      status: 'error',
      message: isOffline ? 'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.' : 'Không tải được lịch sử đánh giá.',
      isOffline,
    };
  }
}

export function formatAssessmentDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}
