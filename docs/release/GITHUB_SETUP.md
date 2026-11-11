# GitHub Setup — Visfar Academy (repo + secrets + branch protection)

> **Muc dich:** dua code local len GitHub va bat CI/CD (deploy Pages + Workers,
> backup DB hang ngay, keep-warm). **Chi user lam duoc cac buoc duoi day** —
> agent khong co quyen tao repo / cap quyen App / them secret.
> Trang thai hien tai (11/11/2026): code local o commit `8df367a`, cay lam viec
> sach, **chua co remote** (push dang bi chan 403 do App `meta-muse-ai` chua co
> quyen ghi — xem QĐ 24 trong `docs/DECISIONS.md`).

## Checklist tong

- [ ] 1. Tao repo PRIVATE moi
- [ ] 2. Cap quyen ghi cho App `meta-muse-ai` (hoac push bang credential cua user)
- [ ] 3. Them GitHub Secrets (5 deploy + 1 backup)
- [ ] 4. Bat branch protection cho `main`
- [ ] 5. Push lan dau + xac nhan CI chay xanh

## 1. Tao repo PRIVATE moi

1. Vao GitHub → **+** → **New repository**.
2. Ten goi y: `visfar-academy-platform` (trung ten thu muc local).
3. Chon **Private** (bat buoc — repo chua PII hoc vien trong tuong lai qua
   backup, va chua code + tai lieu noi bo).
4. **Khong** tick "Add a README / .gitignore / license" (repo local da co day du).
5. Bam **Create repository**. Ghi lai URL repo, dang:
   `https://github.com/<ten-user>/visfar-academy-platform.git`

## 2. Cap quyen ghi cho App `meta-muse-ai`

Chon **1 trong 2 cach** (lam cach A truoc; neu khong duoc thi dung cach B):

**Cach A — cap quyen cho App (de agent push/CI ve sau):**
1. Vao repo moi → **Settings → Integrations → GitHub Apps**
   (hoac **Settings → Installations**).
2. Tim App **`meta-muse-ai`** → **Configure**.
3. O muc **Repository access**: chon repo `visfar-academy-platform`
   (neu chon "All repositories" thi ap dung cho moi repo — chi lam neu user muon).
4. O muc **Permissions**: dat **Contents → Read and write**
   (hien tai App dang thieu quyen nay nen push bi 403).
5. **Save**. Sau do bao agent thu lai push.

**Cach B — user tu push bang credential cua minh:**
```bash
cd ~/workspace/visfar-academy-platform
git remote add origin https://github.com/<ten-user>/visfar-academy-platform.git
git push -u origin main
```
(Dang nhap GitHub bang trinh duyet / token cua user khi duoc hoi.)

## 3. Them GitHub Secrets

Vao repo → **Settings → Secrets and variables → Actions → New repository secret**.
Them tung secret (chi ghi **ten** o day — gia tri lay tu dashboard tuong ung,
**khong gui / khong dan gia tri that vao chat hay file**):

| Secret | Dung cho | Lay o dau |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Deploy Pages + Workers | Cloudflare Dashboard → My Profile → API Tokens (quyen: Workers Scripts Edit, Workers Routes Edit, Pages Edit, User Details Read, Memberships Read) |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy Pages + Workers | Cloudflare Dashboard → Account Home (cot phai) |
| `NEXT_PUBLIC_SUPABASE_URL` | Build web (Pages) | Supabase Dashboard → Project Settings → API → Project URL (project **PROD**) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build web (Pages) | Supabase Dashboard → Project Settings → API → anon public key (project **PROD**) |
| `NEXT_PUBLIC_API_BASE_URL` | Build web (Pages) | `https://api.visfaracademy.workers.dev/api/v1` |
| `DATABASE_URL` | Backup DB hang ngay | Supabase Dashboard → Project Settings → Database → Connection string, che do **Session pooler** (cong **6543**), project **PROD**. Khong dung host truc tiep cong 5432. |

Luu y:
- 5 secret deploy phuc vu `.github/workflows/deploy.yml`; thieu 1 trong 5
  thi deploy fail (xem log trong tab Actions).
- `DATABASE_URL` phuc vu `.github/workflows/backup.yml`. Workflow backup
  **chi chay duoc tren GitHub Actions** — VM dev chan cong 5432.
- Cac secret khac (Supabase service-role key, SePay/Resend webhook secret)
  **khong** them vao GitHub — chi set bang `wrangler secret put` cho Worker.
- Sau nay moi them (chua can ngay): secret R2 de day backup len R2, va
  `RESEND_API_KEY` de gui canh bao email (khi user chot kenh canh bao).

## 4. Bat branch protection cho `main`

Vao repo → **Settings → Branches → Add branch protection rule**:
1. **Branch name pattern:** `main`.
2. Tick **Require a pull request before merging**.
3. Tick **Require status checks to pass before merging** → chon check **`ci`**
   (workflow `.github/workflows/ci.yml`).
4. Tick **Do not allow bypassing the above settings** (khuyen nghi).
5. **Create**. Tu nay khong push truc tiep len `main`; moi doi qua PR + CI xanh.

## 5. Kiem tra lan push dau + CI chay xanh

1. Push code len (xem buoc 2, cach A hoac B).
2. Vao repo → tab **Actions**: phai thay 3 workflow chay:
   - **CI** — chay tren moi push/PR (khong can secret).
   - **Deploy** — chay khi push len `main` (can du 5 secret deploy).
   - **Backup** — chay theo lich 00:00 UTC hang ngay (can `DATABASE_URL`).
   - **Keep-warm** — chay theo lich 17:00 UTC hang ngay (khong can secret).
   Co the chay tay ngay de kiem tra: vao tung workflow → **Run workflow**.
3. Kiem tra ket qua:
   - [ ] CI xanh (typecheck + lint + test + check migrations).
   - [ ] Deploy xanh + smoke test pass (Worker + Web health tra 200).
   - [ ] Backup chay tay 1 lan thanh cong, artifact `backup-YYYY-MM-DD`
         xuat hien, file `.sql.gz` dung luong > 0.
   - [ ] Keep-warm chay tay 1 lan thanh cong (2 health endpoint tra 200).
4. Neu workflow nao do: mo lan chay loi → doc log → sua thieu secret
   (loi thuong gap nhat) theo bang o buoc 3, roi chay lai (Re-run jobs).

## Tai lieu lien quan

- `docs/release/DEPLOYMENT_GUIDE.md` — quy trinh deploy, rollback, smoke test.
- `docs/release/BACKUP_RESTORE_GUIDE.md` — backup/restore, RPO/RTO, restore thu.
- `.github/workflows/ci.yml`, `deploy.yml`, `backup.yml`, `keep-warm.yml`.
