// RLS policy audit — Task 06. Kiem tra TINH file migration SQL (khong can DB that):
//   - 0001 con 3 policy lo (lich su — khong sua file cu, chi ghi nhan de doi chieu);
//   - 0009 phai dong ca 3 lo + khong mo them duong ghi nao cho client.
// Live tren staging (ap 0009 + chay kiem chung § cuoi file 0009): CHUA CHAY
// (can SUPABASE_ACCESS_TOKEN — cung blocker nhu Task 05 C-05-01).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
);

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS, name), 'utf8');
}

describe('RLS audit — lo trong 0001 (ghi nhan, khong sua lich su)', () => {
  it('H1: profiles_update_own (0001) khong co WITH CHECK ve role', () => {
    const sql = readMigration('0001_init_schema.sql');
    const m = sql.match(/create policy "profiles_update_own"[\s\S]*?;/i);
    expect(m).not.toBeNull();
    expect(m![0].toLowerCase()).not.toContain('with check');
    expect(m![0]).toContain('id = auth.uid()');
  });

  it('H2: enrollments_insert_own (0001) chi kiem tra user_id', () => {
    const sql = readMigration('0001_init_schema.sql');
    const m = sql.match(/create policy "enrollments_insert_own"[\s\S]*?;/i);
    expect(m).not.toBeNull();
    expect(m![0]).toContain('user_id = auth.uid()');
    expect(m![0].toLowerCase()).not.toContain('status');
    expect(m![0].toLowerCase()).not.toContain('order_id');
  });

  it('H3: progress_own (0001) la FOR ALL cho chinh minh (ghi tien do tuy y)', () => {
    const sql = readMigration('0001_init_schema.sql');
    const m = sql.match(/create policy "progress_own"[\s\S]*?;/i);
    expect(m).not.toBeNull();
    expect(m![0].toLowerCase()).toContain('for all');
  });

  it('0006/0007 khong drop/sua 3 policy tren', () => {
    for (const f of ['0006_rls_task03.sql', '0007_fix_blockers.sql']) {
      const sql = readMigration(f);
      expect(sql).not.toContain('"profiles_update_own"');
      expect(sql).not.toContain('"enrollments_insert_own"');
      expect(sql).not.toContain('"progress_own"');
    }
  });
});

describe('RLS audit — danh so migration', () => {
  it('0008 thuoc ve fix F-12 da phe duyet; file sua bao mat la 0009', () => {
    expect(readMigration('0008_fix_fk_answers.sql')).toContain('da duoc user phe duyet');
    expect(readMigration('0009_security_fixes.sql')).toContain('Migration 0009');
  });
});

describe('RLS audit — 0009 dong 3 lo', () => {
  const sql = readMigration('0009_security_fixes.sql');

  it('H1a: trigger chan tu doi role (chi admin JWT hoac service-role duoc doi)', () => {
    expect(sql).toContain('trg_profiles_block_role_change');
    expect(sql).toContain('before update of role on public.profiles');
    expect(sql).toContain('raise exception');
    expect(sql).toContain('auth.uid() is not null');
    expect(sql).toContain("current_role() is distinct from 'admin'");
  });

  it('H1b: thu hoi UPDATE cot role doi voi authenticated', () => {
    expect(sql).toMatch(/revoke update \(role\) on public\.profiles from authenticated/i);
  });

  it('H2: drop enrollments_insert_own, khong tao policy INSERT enrollments moi', () => {
    expect(sql).toContain('drop policy if exists "enrollments_insert_own"');
    expect(sql.toLowerCase()).not.toContain('create policy "enrollments_insert');
    expect(sql.toLowerCase()).not.toMatch(/create policy[^;]*on public\.enrollments[^;]*for insert/s);
  });

  it('H3: drop progress_own, thay bang SELECT-only cho chinh minh', () => {
    expect(sql).toContain('drop policy if exists "progress_own"');
    expect(sql).toContain('create policy "progress_select_own"');
    expect(sql).toMatch(/create policy "progress_select_own"[\s\S]*?for select/i);
    expect(sql.toLowerCase()).not.toMatch(
      /create policy "progress_select_own"[\s\S]*?for (all|insert|update)/i,
    );
  });

  it('H4: profiles_insert_own moi chi cho role = student', () => {
    expect(sql).toContain('create policy "profiles_insert_own"');
    expect(sql).toContain("role = 'student'");
  });

  it('0009 khong mo them duong ghi client cho orders/payments/leads', () => {
    const lower = sql.toLowerCase();
    for (const t of ['orders', 'payments', 'leads']) {
      expect(lower).not.toMatch(
        new RegExp(`create policy[^;]*on public\\.${t}[^;]*for (insert|update|delete)`, 's'),
      );
    }
  });
});
