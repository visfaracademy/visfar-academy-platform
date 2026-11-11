// Kiem tra migration OFFLINE bang regex (khong can Supabase that).
// Kiem tra: moi bang §3 co CREATE TABLE + created_at + updated_at,
// RLS bat tren moi bang, index §3.3, ham current_role(), view
// quiz_options_public (khong is_correct), trigger tao profiles,
// seed 10 khoa dung thu tu/slug/pillar.
// Them: 0014 (quiz bank: ham submit_quiz_attempt, view khong is_correct,
// pass_score_percent mac dinh 70, them loai fill_blank/essay),
// 0015 (assignments: bang submission_files, bucket submissions private,
// CHECK status moi), 0016 (certificates: generate_certificate_code,
// verification_code, verify_certificate, UNIQUE rieng phan),
// 0017-email (email_logs error_message/sent_at/attempts/next_retry_at +
// status complained/skipped; newsletter unsubscribed_at/
// unsubscribe_reason/hard_bounced_at), 0018-email (email_logs.user_id;
// automation_events trigger/counts/started_at/finished_at + status
// running/succeeded), 0019 (commerce/payment Task 10).
// Chay: npm run check:migrations  (exit 1 neu co loi)
// LUU Y: day la kiem tra TINH, khong thay the viec chay migration
// that tren Supabase va test RLS bang 2 tai khoan (xem tests/rls-manual.md).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migDir = join(root, 'supabase', 'migrations');
const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
const sql0001 = readFileSync(join(migDir, '0001_init_schema.sql'), 'utf8');
const sql0002 = readFileSync(join(migDir, '0002_seed_courses.sql'), 'utf8');
const sql0003 = readFileSync(join(migDir, '0003_seed_content.sql'), 'utf8');
const sql0014 = readFileSync(join(migDir, '0014_quiz_bank.sql'), 'utf8');
const sql0015 = readFileSync(join(migDir, '0015_assignments.sql'), 'utf8');
const sql0016 = readFileSync(join(migDir, '0016_certificates.sql'), 'utf8');
const sql0017 = readFileSync(join(migDir, '0017_email_unsubscribe_logs.sql'), 'utf8');
const sql0018 = readFileSync(join(migDir, '0018_email_task11.sql'), 'utf8');
const sql0019 = readFileSync(join(migDir, '0019_commerce_payment.sql'), 'utf8');

const TABLES = [
  'profiles', 'courses', 'modules', 'lessons', 'quiz_questions',
  'quiz_options', 'enrollments', 'lesson_progress', 'quiz_attempts',
  'certificates', 'leads', 'orders', 'payments', 'events',
  'event_registrations', 'posts', 'policies', 'email_logs',
  'newsletter_subscribers', 'audit_logs',
];

const INDEXES = [
  'idx_courses_display_order', 'idx_courses_slug', 'idx_modules_course',
  'idx_lessons_module', 'idx_enrollments_user', 'idx_enrollments_course',
  'idx_progress_user_lesson', 'idx_leads_status_created', 'idx_leads_phone',
  'idx_leads_reference', 'idx_orders_user_status', 'idx_orders_reference',
  'idx_payments_order', 'idx_email_logs_to_template', 'idx_posts_slug_status',
  'idx_events_starts',
];

const EXPECTED_COURSES = [
  ['thau-hieu-noi-tam', 1, 'tam-thuc'],
  ['thau-hieu-tam-thuc', 2, 'tam-thuc'],
  ['thau-hieu-tri-tue', 3, 'tri-tue'],
  ['thau-hieu-suc-khoe', 4, 'tam-thuc'],
  ['thau-hieu-moi-quan-he', 5, 'tam-thuc'],
  ['thau-hieu-tai-chinh', 6, 'tam-thuc'],
  ['chuyen-gia-tu-van', 7, 'tam-thuc'],
  ['master-tam-thuc-nhan-hieu', 8, 'nhan-hieu'],
  ['coaching-90-ngay', 9, 'nhan-hieu'],
  ['cong-dong-visfar', 10, 'cong-dong'],
];

let failures = 0;
function check(ok, label) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures += 1;
}

// Dem DONG (GĐ2, 11/11/2026 — thay danh sach cung: so migration phai
// lien tuc 0001..NNNN theo dung thu tu file, khong trung so. File moi
// chi can dat dung so tiep theo; khong can sua script nay nua.
check(
  files.length > 0 &&
    files.every((f, i) => {
      const m = /^(\d{4})_.+\.sql$/.exec(f);
      return m !== null && Number(m[1]) === i + 1;
    }) &&
    new Set(files.map((f) => f.slice(0, 4))).size === files.length,
  `du ${files.length} migration theo thu tu, so lien tuc 0001-${String(files.length).padStart(4, '0')}, khong trung so (${files.join(', ')})`,
);

for (const t of TABLES) {
  const block = sql0001.match(new RegExp(`create table if not exists public\\.${t} \\([\\s\\S]*?\\);`, 'i'));
  check(Boolean(block), `bang ${t}: co CREATE TABLE`);
  if (block) {
    check(/created_at timestamptz/i.test(block[0]), `bang ${t}: co created_at`);
    check(/updated_at timestamptz/i.test(block[0]), `bang ${t}: co updated_at`);
    check(new RegExp(`alter table public\\.${t} enable row level security`, 'i').test(sql0001),
      `bang ${t}: RLS enabled`);
  }
}

for (const idx of INDEXES) {
  check(new RegExp(`create index if not exists ${idx}`, 'i').test(sql0001), `index ${idx}`);
}

check(/create or replace function public\.current_role\(\)/i.test(sql0001), 'ham current_role()');
check(/create or replace function public\.handle_new_user\(\)/i.test(sql0001), 'trigger function handle_new_user()');
check(/create trigger on_auth_user_created/i.test(sql0001), 'trigger on_auth_user_created tren auth.users');
check(/create or replace view public\.quiz_options_public as/i.test(sql0001), 'view quiz_options_public');
{
  const view = sql0001.match(/create or replace view public\.quiz_options_public as[\s\S]*?;/i)?.[0] ?? '';
  check(!/is_correct/i.test(view), 'view quiz_options_public KHONG chua is_correct');
}
check(/unique \(slug, version\)/i.test(sql0001), 'policies: UNIQUE(slug, version)');
check(/unique \(user_id, course_id\)/i.test(sql0001), 'enrollments: UNIQUE(user_id, course_id)');
check(/unique \(user_id, lesson_id\)/i.test(sql0001), 'lesson_progress: UNIQUE(user_id, lesson_id)');

for (const [slug, order, pillar] of EXPECTED_COURSES) {
  const re = new RegExp(`'${slug}', ${order},[\\s\\S]*?'${pillar}'`, 'i');
  check(re.test(sql0002), `seed khoa ${order} ${slug} (${pillar})`);
}
check(/NOI DUNG TAM/i.test(sql0002), 'seed ghi ro noi dung tam cho 3 khoa 04/05/06');
check((sql0002.match(/on conflict \(slug\) do update/i) ?? []).length === 1, 'seed khoa idempotent (ON CONFLICT slug)');
for (const slug of ['bao-mat', 'dieu-khoan-tham-gia', 'hoan-tra-huy-dang-ky', 'giai-quyet-khieu-nai']) {
  check(sql0003.includes(`'${slug}'`), `seed chinh sach ${slug}`);
}
check(!/mã số thuế|Mã số thuế/i.test(sql0003), 'seed chinh sach KHONG bia ma so thue');
check(!/địa chỉ trụ sở|Địa chỉ trụ sở/i.test(sql0003), 'seed chinh sach KHONG bia dia chi tru so');

// --- 0022: S-01 — chan hoc vien tu doi is_disabled / disabled_at / disabled_reason ---
const sql0022 = readFileSync(join(migDir, '0022_block_student_self_disable.sql'), 'utf8');
check(/create or replace function public\.prevent_profiles_disable_change\(\)/i.test(sql0022), '0022: ham prevent_profiles_disable_change()');
check(/before update of is_disabled, disabled_at, disabled_reason/i.test(sql0022), '0022: trigger BEFORE UPDATE OF is_disabled, disabled_at, disabled_reason');
check(/trg_profiles_block_disable_change/i.test(sql0022), '0022: trigger trg_profiles_block_disable_change');
check(/raise exception/i.test(sql0022), '0022: RAISE EXCEPTION khi non-admin doi cot disable');
check(/current_role\(\) is distinct from 'admin'/i.test(sql0022), '0022: cho admin JWT qua');
check(/auth\.uid\(\) is not null/i.test(sql0022), '0022: cho service-role (uid NULL) qua');
check(!/^revoke update \(is_disabled/im.test(sql0022), '0022: KHONG REVOKE cot is_disabled (admin doi truc tiep bang JWT)');

// --- 0023: lich hen + tiep thi lien ket + vi (Task 12) ---
const sql0023 = readFileSync(join(migDir, '0023_appointments_referrals_wallet.sql'), 'utf8');
check(/create table if not exists public\.appointments \(/i.test(sql0023), '0023: bang appointments');
check(/create table if not exists public\.referral_codes \(/i.test(sql0023), '0023: bang referral_codes');
check(/create table if not exists public\.referrals \(/i.test(sql0023), '0023: bang referrals');
check(/create table if not exists public\.wallet_transactions \(/i.test(sql0023), '0023: bang wallet_transactions');
check(/check \(mode in \('zoom', 'truc-tiep'\)\)/i.test(sql0023), '0023: appointments CHECK mode zoom/truc-tiep');
check(/check \(status in \('pending', 'confirmed', 'cancelled', 'completed'\)\)/i.test(sql0023), '0023: appointments CHECK status 4 gia tri');
check(/check \(code ~ '\^VISFAR-\[A-Z0-9\]\{6\}\$'\)/i.test(sql0023), '0023: referral_codes CHECK dang VISFAR-XXXXXX');
check(/referred_user_id uuid unique/i.test(sql0023), '0023: referrals referred_user_id UNIQUE (1 nguoi 1 referrer)');
check(/check \(type in \('commission', 'withdrawal', 'adjustment'\)\)/i.test(sql0023), '0023: wallet CHECK type 3 gia tri');
check(/check \(status in \('pending', 'completed', 'rejected'\)\)/i.test(sql0023), '0023: wallet CHECK status 3 gia tri');
check(/uq_wallet_one_commission_per_order/i.test(sql0023), '0023: unique index 1 commission / don');
check(/alter table public\.appointments enable row level security/i.test(sql0023), '0023: RLS appointments');
check(/alter table public\.referral_codes enable row level security/i.test(sql0023), '0023: RLS referral_codes');
check(/alter table public\.referrals enable row level security/i.test(sql0023), '0023: RLS referrals');
check(/alter table public\.wallet_transactions enable row level security/i.test(sql0023), '0023: RLS wallet_transactions');
check(/create policy "appointments_select_own" on public\.appointments/i.test(sql0023), '0023: policy appointments_select_own');
check(/create policy "appointments_insert_own" on public\.appointments/i.test(sql0023), '0023: policy appointments_insert_own');
check(/create policy "appointments_update_own" on public\.appointments/i.test(sql0023), '0023: policy appointments_update_own');
check(/create policy "referral_codes_select_own" on public\.referral_codes/i.test(sql0023), '0023: policy referral_codes_select_own');
check(/create policy "referral_codes_insert_own" on public\.referral_codes/i.test(sql0023), '0023: policy referral_codes_insert_own');
check(/create policy "referrals_select_referrer" on public\.referrals/i.test(sql0023), '0023: policy referrals_select_referrer');
check(/create policy "wallet_select_own" on public\.wallet_transactions/i.test(sql0023), '0023: policy wallet_select_own');
check(/create policy "wallet_update_admin" on public\.wallet_transactions/i.test(sql0023), '0023: policy wallet_update_admin');
check(!/create policy "[^"]*" on public\.(referrals|wallet_transactions)\s*\n\s*for insert/i.test(sql0023), '0023: KHONG co policy INSERT tren referrals / wallet_transactions (chi service-role ghi)');
check(/current_role\(\) = 'admin'/i.test(sql0023), '0023: dung helper current_role() co san (khong is_admin)');
check(/idx_appointments_student/i.test(sql0023), '0023: index appointments student_id');
check(/idx_appointments_scheduled/i.test(sql0023), '0023: index appointments scheduled_at');
check(/idx_wallet_user/i.test(sql0023), '0023: index wallet user_id');

// --- 0024: 3 tru cot Than – Tam – Tue (11/11/2026) ---
const sql0024 = readFileSync(join(migDir, '0024_pillars_than_tam_tue.sql'), 'utf8');
check(/drop constraint if exists courses_pillar_check/i.test(sql0024), '0024: drop CHECK cu courses_pillar_check');
check(/check \(pillar in \('than', 'tam', 'tue', 'tich-hop', 'cong-dong'\)\)/i.test(sql0024), '0024: CHECK moi 5 gia tri than/tam/tue/tich-hop/cong-dong');
check(/set pillar = 'than' where slug = 'thau-hieu-suc-khoe'/i.test(sql0024), '0024: 04 suc khoe -> than');
check(/set pillar = 'than' where slug = 'thau-hieu-tai-chinh'/i.test(sql0024), '0024: 06 tai chinh -> than');
check(/set pillar = 'tam' where slug = 'thau-hieu-moi-quan-he'/i.test(sql0024), '0024: 05 moi quan he -> tam');
check(/set pillar = 'tich-hop' where slug = 'chuyen-gia-tu-van'/i.test(sql0024), '0024: 07 chuyen gia -> tich-hop');
check(/set pillar = 'tich-hop' where slug = 'master-tam-thuc-nhan-hieu'/i.test(sql0024), '0024: 08 master -> tich-hop');
check(/set pillar = 'tich-hop' where slug = 'coaching-90-ngay'/i.test(sql0024), '0024: 09 coaching -> tich-hop');
check(/details = details - 'noi_dung_tam'/i.test(sql0024), '0024: xoa co noi_dung_tam 04/05/06');
check(!/description = '[^']*NOI DUNG TAM/i.test(sql0024), '0024: mo ta moi khong con chu NOI DUNG TAM');

// --- 0014: quiz bank (Task 08) ---
check(/create or replace function public\.submit_quiz_attempt\(/i.test(sql0014), '0014: ham submit_quiz_attempt');
check(/security definer/i.test(sql0014), '0014: submit_quiz_attempt la SECURITY DEFINER');
check(/create or replace view public\.question_options_public as/i.test(sql0014), '0014: view question_options_public');
{
  const view = sql0014.match(/create or replace view public\.question_options_public as[\s\S]*?;/i)?.[0] ?? '';
  check(!/is_correct/i.test(view), '0014: view question_options_public KHONG chua is_correct');
}
check(/pass_score_percent set default 70/i.test(sql0014), '0014: pass_score_percent mac dinh 70');
check(/'fill_blank', 'essay'/i.test(sql0014), '0014: question_type them fill_blank + essay');
check(/add column if not exists shuffle_questions/i.test(sql0014), '0014: quizzes.shuffle_questions');
check(/add column if not exists quiz_id uuid references public\.quizzes/i.test(sql0014), '0014: quiz_attempts.quiz_id');

// --- 0015: assignments (Task 08) ---
check(/create table if not exists public\.submission_files/i.test(sql0015), '0015: bang submission_files');
check(/insert into storage\.buckets[\s\S]{0,400}''submissions'', ''submissions'', false/i.test(sql0015), '0015: bucket submissions private');
check(/check \(status in \('draft', 'submitted', 'graded', 'returned'\)\)/i.test(sql0015), '0015: submissions CHECK draft/submitted/graded/returned');
check(/check \(status in \('graded', 'returned'\)\)/i.test(sql0015), '0015: submission_reviews CHECK graded/returned');
check(/assignment_overdue/i.test(sql0015), '0015: trigger chan nop muon (assignment_overdue)');
check(/add column if not exists assignment_type/i.test(sql0015), '0015: assignments.assignment_type');

// --- 0016: certificates (Task 08) ---
check(/create or replace function public\.generate_certificate_code\(\)/i.test(sql0016), '0016: ham generate_certificate_code()');
check(/'VISFAR-CERT-'/i.test(sql0016), '0016: ma chung chi dang VISFAR-CERT-YYYY-NNNNNN');
check(/add column if not exists verification_code/i.test(sql0016), '0016: certificates.verification_code');
check(/create or replace function public\.verify_certificate\(p_code text\)/i.test(sql0016), '0016: ham verify_certificate');
check(/uniq_certificates_one_valid_per_user_course/i.test(sql0016), '0016: UNIQUE rieng phan 1 chung chi valid / user+khoa');
check(/add column if not exists revoked_at/i.test(sql0016), '0016: certificates.revoked_at');
check(/add column if not exists revoked_by/i.test(sql0016), '0016: certificates.revoked_by');
check(/add column if not exists revoked_reason/i.test(sql0016), '0016: certificates.revoked_reason');
check(/add column if not exists eligibility_snapshot/i.test(sql0016), '0016: certificates.eligibility_snapshot');
{
  const ret = sql0016.match(/returns table \([\s\S]*?\)/i)?.[0] ?? '';
  check(/certificate_code/i.test(ret) && /recipient_name/i.test(ret) && /course_title/i.test(ret)
    && /course_slug/i.test(ret) && /issued_at/i.test(ret) && /status/i.test(ret),
    '0016: verify_certificate tra dung 6 truong an toan');
  check(!/email|phone|user_id|verification_code|revoked/i.test(ret), '0016: verify_certificate KHONG tra PII');
}

// --- 0019: commerce / payment (Task 10) ---
check(/create or replace function public\.generate_order_reference\(\)/i.test(sql0019), '0019: ham generate_order_reference()');
  check(/'DH-'/i.test(sql0019), '0019: ma don dang DH-YYYY-NNNNNN');
  check(/add column if not exists coupon_id/i.test(sql0019), '0019: orders.coupon_id');
  check(/add column if not exists original_amount_vnd/i.test(sql0019), '0019: orders.original_amount_vnd');
  check(/add column if not exists discount_vnd/i.test(sql0019), '0019: orders.discount_vnd');
  check(/add column if not exists paid_at/i.test(sql0019), '0019: orders.paid_at');
  check(/add column if not exists idempotency_key/i.test(sql0019), '0019: orders.idempotency_key');
  check(/add column if not exists idempotency_body_hash/i.test(sql0019), '0019: orders.idempotency_body_hash');
  check(/create or replace function public\.apply_coupon_use\(p_coupon_id uuid\)/i.test(sql0019), '0019: ham apply_coupon_use()');
  check(/create or replace function public\.release_coupon_use\(p_coupon_id uuid\)/i.test(sql0019), '0019: ham release_coupon_use()');
  check(/add column if not exists refund_reason/i.test(sql0019), '0019: orders.refund_reason');
  check(/add column if not exists refund_bank_reference/i.test(sql0019), '0019: orders.refund_bank_reference');
  check(/on delete set null/i.test(sql0019), '0019: orders.user_id SET NULL (Task 03 QĐ 9)');
  check(/add column if not exists item_type/i.test(sql0019), '0019: order_items.item_type');
  check(/add column if not exists item_name/i.test(sql0019), '0019: order_items.item_name');
  check(/add column if not exists unit_price_vnd/i.test(sql0019), '0019: order_items.unit_price_vnd');
  check(/add column if not exists total_vnd/i.test(sql0019), '0019: order_items.total_vnd');
  check(/order_items_single_item_type_check/i.test(sql0019), '0019: order_items CHECK 1 loai hang / dong');
  check(/add column if not exists min_order_vnd/i.test(sql0019), '0019: coupons.min_order_vnd');
  check(/add column if not exists max_discount_vnd/i.test(sql0019), '0019: coupons.max_discount_vnd');
  check(/add column if not exists course_id uuid references public\.courses/i.test(sql0019), '0019: membership_plans.course_id');
  check(/'active', 'expired', 'cancelled', 'pending'/i.test(sql0019), '0019: memberships status them pending');
  check(/generated always as \(ends_at\) stored/i.test(sql0019), '0019: memberships.expires_at GENERATED tu ends_at');
  check(/add column if not exists is_pay_what_you_want/i.test(sql0019), '0019: courses.is_pay_what_you_want');
  check(/'refund\.working_days', '15'/i.test(sql0019), '0019: seed refund.working_days = 15');
  check(/'complaint\.response_days', '3'/i.test(sql0019), '0019: seed complaint.response_days = 3');
  check(/'payment\.provider', '"sepay"'/i.test(sql0019), '0019: seed payment.provider = sepay');
  check(/'payment\.bank_name', '"MB Bank"'/i.test(sql0019), '0019: seed payment.bank_name = MB Bank');
  check(!/\b\d{9,}\b/.test(sql0019), '0019: KHONG ghi so tai khoan that vao migration (khong co day so >= 9 chu so)');
  check(/create policy "payments_insert_admin" on public\.payments/i.test(sql0019), '0019: RLS payments_insert_admin');
  check(/create policy "orders_update_admin" on public\.orders/i.test(sql0019), '0019: RLS orders_update_admin');

// --- 0017: email unsubscribe/logs (Task 11) ---
check(/add column if not exists error_message/i.test(sql0017), '0017-email: email_logs.error_message');
check(/add column if not exists sent_at/i.test(sql0017), '0017-email: email_logs.sent_at');
check(/add column if not exists attempts/i.test(sql0017), '0017-email: email_logs.attempts');
check(/add column if not exists next_retry_at/i.test(sql0017), '0017-email: email_logs.next_retry_at');
check(/'complained', 'skipped'/i.test(sql0017), '0017-email: email_logs status them complained/skipped');
check(/idx_email_logs_resend_id/i.test(sql0017), '0017-email: unique index resend_id');
check(/add column if not exists unsubscribed_at/i.test(sql0017), '0017-email: newsletter.unsubscribed_at');
check(/add column if not exists unsubscribe_reason/i.test(sql0017), '0017-email: newsletter.unsubscribe_reason');
check(/add column if not exists hard_bounced_at/i.test(sql0017), '0017-email: newsletter.hard_bounced_at');

// --- 0018: email Task 11 — phan bo sung (chi nhung gi 0017 chua co) ---
// Kiem tra am chi nham vao DDL (add column ...) de comment giai thich
// trong file khong lam sai ket qua.
const noCol = (sql, col) => !new RegExp(`add column if not exists ${col}\\b`, 'i').test(sql);
check(/add column if not exists user_id uuid references public\.profiles/i.test(sql0018), '0018-email: email_logs.user_id FK profiles');
check(/idx_email_logs_user/i.test(sql0018), '0018-email: index email_logs_user');
check(/add column if not exists trigger/i.test(sql0018), '0018-email: automation_events.trigger');
check(/add column if not exists target_count/i.test(sql0018), '0018-email: automation_events.target_count');
check(/add column if not exists success_count/i.test(sql0018), '0018-email: automation_events.success_count');
check(/add column if not exists failure_count/i.test(sql0018), '0018-email: automation_events.failure_count');
check(/add column if not exists started_at/i.test(sql0018), '0018-email: automation_events.started_at');
check(/add column if not exists finished_at/i.test(sql0018), '0018-email: automation_events.finished_at');
check(/'running', 'succeeded'/i.test(sql0018), '0018-email: automation_events status them running/succeeded');
check(/automation_events_trigger_check/i.test(sql0018), '0018-email: automation_events CHECK trigger cron/manual/webhook');
check(noCol(sql0018, 'error_message'), '0018-email: KHONG lap lai error_message (da co o 0017)');
check(noCol(sql0018, 'attempts'), '0018-email: KHONG lap lai attempts (da co o 0017)');
check(noCol(sql0018, 'unsubscribed_at'), '0018-email: KHONG lap lai unsubscribed_at (da co o 0017)');
check(noCol(sql0018, 'retry_count'), '0018-email: KHONG co cot retry_count (dung attempts)');
check(noCol(sql0018, 'provider_message_id'), '0018-email: KHONG co cot provider_message_id (dung resend_id)');
check(noCol(sql0018, 'unsubscribe_token'), '0018-email: KHONG co cot unsubscribe_token (dung HMAC token — token.ts)');
check(noCol(sql0018, 'details'), '0018-email: KHONG co cot details (dung payload)');

// --- 0027: danh gia 11D (Prompt 11) — 1 bang + view tong hop khong PII ---
const sql0027 = readFileSync(join(migDir, '0027_assessments_11d.sql'), 'utf8');
check(/create table if not exists public\.assessments_11d/i.test(sql0027), '0027: bang assessments_11d');
check(/alter table public\.assessments_11d enable row level security/i.test(sql0027), '0027: RLS assessments_11d');
check(/create policy "assessments_11d_select_own"/i.test(sql0027), '0027: policy select_own (chi minh + admin)');
check(/create policy "assessments_11d_insert_own"/i.test(sql0027), '0027: policy insert_own');
check(/create policy "assessments_11d_update_own"/i.test(sql0027), '0027: policy update_own');
check(/answers jsonb not null/i.test(sql0027), '0027: cot answers JSONB');
check(/scores jsonb not null/i.test(sql0027), '0027: cot scores JSONB');
check(/overall_score numeric\(4, 2\)/i.test(sql0027), '0027: cot overall_score numeric(4,2)');
check(/completed_at timestamptz not null default now\(\)/i.test(sql0027), '0027: cot completed_at');
check(/create or replace view public\.assessment_aggregates_11d/i.test(sql0027), '0027: view tong hop assessment_aggregates_11d');
{
  const view = sql0027.match(/create or replace view public\.assessment_aggregates_11d[\s\S]*?;/i)?.[0] ?? '';
  check(!/user_id|answers/i.test(view), '0027: view tong hop KHONG co user_id/answers (khong PII)');
}

// --- 0028: S-03 — siet RLS bang lessons (GĐ2, 11/11/2026) ---
const sql0028 = readFileSync(join(migDir, '0028_fix_s03_lessons_rls.sql'), 'utf8');
check(/drop policy if exists "lessons_select_public" on public\.lessons/i.test(sql0028), '0028: drop policy cu lessons_select_public');
check(/create policy "lessons_select_enrolled" on public\.lessons/i.test(sql0028), '0028: policy moi lessons_select_enrolled');
check(!/create policy "lessons_select_public"/i.test(sql0028), '0028: KHONG tao lai policy lessons_select_public');
check(/enrollments e[\s\S]{0,200}status in \('active', 'completed'\)/i.test(sql0028), '0028: chi enrollment active/completed moi doc bai tra phi');
check(/is_instructor_of\(c\.id\)/i.test(sql0028), '0028: instructor khoa phu trach duoc doc');
check(/create or replace view public\.lessons_preview_video as/i.test(sql0028), '0028: view lessons_preview_video');
{
  const view = sql0028.match(/create or replace view public\.lessons_preview_video as[\s\S]*?;/i)?.[0] ?? '';
  check(/is_free_preview = true/i.test(view), '0028: view preview chi bai is_free_preview=true');
  check(!/content|file_url/i.test(view), '0028: view preview KHONG co content/file_url');
}
check(/grant select on public\.lessons_preview_video to anon, authenticated/i.test(sql0028), '0028: grant view preview cho anon + authenticated');

// --- 0029: AI Mentor (Prompt 12, GĐ2, 11/11/2026) ---
const sql0029 = readFileSync(join(migDir, '0029_ai_mentor.sql'), 'utf8');
for (const t of ['ai_knowledge_chunks', 'ai_chat_sessions', 'ai_chat_messages']) {
  check(new RegExp(`create table if not exists public\\.${t}`, 'i').test(sql0029), `0029: bang ${t}`);
  check(new RegExp(`alter table public\\.${t} enable row level security`, 'i').test(sql0029), `0029: RLS ${t}`);
}
check(/create or replace function public\.search_ai_knowledge\(p_query text, p_limit integer/i.test(sql0029), '0029: ham search_ai_knowledge');
check(/create extension if not exists unaccent/i.test(sql0029), '0029: extension unaccent (tim khong dau)');
check(/check \(source_type in \('library', 'course', 'philosophy'\)\)/i.test(sql0029), '0029: source_type chi library/course/philosophy');
check(/from public\.master_library_items/i.test(sql0029), '0029: seed Thu vien tu master_library_items');
check(/from public\.courses/i.test(sql0029), '0029: seed mo ta khoa hoc tu courses');
check(/NOI DUNG TAM/i.test(sql0029), '0029: loai description tam NOI DUNG TAM cua 3 khoa');
check(/ai_chat_sessions_select_own/i.test(sql0029), '0029: policy select_own sessions (chi chu so huu)');
check(/ai_chat_messages_select_own/i.test(sql0029), '0029: policy select_own messages (chi chu so huu)');
check(/ai_knowledge_chunks_select_public/i.test(sql0029), '0029: policy select public kho tri thuc');
check(!/from public\.lessons/i.test(sql0029), '0029: seed KHONG doc tu bang lessons (khong index bai tra phi)');

// --- 0030: Cong dong VISFAR (Prompt 13, GĐ2, 11/11/2026) ---
const sql0030 = readFileSync(join(migDir, '0030_community.sql'), 'utf8');
for (const t of ['community_posts', 'community_comments', 'community_reactions', 'community_reports']) {
  check(new RegExp(`create table if not exists public\\.${t}`, 'i').test(sql0030), `0030: bang ${t}`);
  check(new RegExp(`alter table public\\.${t} enable row level security`, 'i').test(sql0030), `0030: RLS ${t}`);
  check(new RegExp(`revoke all on public\\.${t} from anon`, 'i').test(sql0030), `0030: anon khong quyen ${t}`);
}
check(/status in \('visible', 'hidden'\)/i.test(sql0030), '0030: posts status visible/hidden');
check(/community_posts_select/i.test(sql0030), '0030: policy select posts (chi bai hien + tac gia + kiem duyet)');
check(/community_posts_moderate/i.test(sql0030), '0030: policy kiem duyet posts');
check(/community_reports_moderate/i.test(sql0030), '0030: policy xu ly bao cao');
check(/author_name text not null/i.test(sql0030), '0030: author_name luu san (khong join profiles, khong lo PII)');

// --- 0031: Gamification (Prompt 14, GĐ2, 11/11/2026) ---
const sql0031 = readFileSync(join(migDir, '0031_gamification.sql'), 'utf8');
for (const t of ['learning_points', 'badges', 'user_badges', 'learning_streaks']) {
  check(new RegExp(`create table if not exists public\\.${t}`, 'i').test(sql0031), `0031: bang ${t}`);
  check(new RegExp(`alter table public\\.${t} enable row level security`, 'i').test(sql0031), `0031: RLS ${t}`);
}
check(/gamification_enabled boolean not null default true/i.test(sql0031), '0031: profiles.gamification_enabled');
check(/'khoi-dau'/.test(sql0031) && /'kien-tri-7-ngay'/.test(sql0031) && /'hoan-thanh-khoa-dau-tien'/.test(sql0031) && /'nguoi-chia-se'/.test(sql0031), '0031: seed du 4 huy hieu khoi dau');
check(/refresh_my_gamification\(\)/i.test(sql0031), '0031: RPC refresh_my_gamification');
check(/trg_lesson_progress_award/i.test(sql0031), '0031: trigger thuong +10 hoan thanh bai');
check(/trg_quiz_attempts_award/i.test(sql0031), '0031: trigger thuong +20 quiz dat');
check(/trg_enrollments_award/i.test(sql0031), '0031: trigger thuong +100 hoan thanh khoa');
check(/md5\(p_user_id::text \|\| p_reason \|\| current_date::text\)::uuid/i.test(sql0031), '0031: gioi han bai huu ich + streak 1 lan/ngay (related_id theo ngay)');
check(!/create policy "[^"]*" on public\.learning_points[\s\S]{0,120}for insert/i.test(sql0031), '0031: client KHONG co policy INSERT learning_points (chong tu ghi diem)');

console.log(failures === 0 ? '\nOK: tat ca kiem tra migration deu PASS.' : `\nFAIL: ${failures} kiem tra khong dat.`);
process.exit(failures === 0 ? 0 : 1);
