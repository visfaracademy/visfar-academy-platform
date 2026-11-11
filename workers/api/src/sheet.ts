// Ghi Sheet qua Apps Script Web App — ban sao doi soat (API_ARCHITECTURE §9.1).
// DB la nguon su that: Sheet loi SAU KHI DB da ghi xong thi API VAN tra 201
// (kem sheetSynced:false + log) — khong bao gio tra thanh cong gia, cung
// khong bien loi Sheet thanh loi cua lead.
//
// File .gs hien tai: workspace/visfar-academy/Code-hop-nhat-2-trang.gs,
// doPost nhan JSON { source, fullName, phone, email, province, course }
// va ghi tab 'DATA VISFAR ACADEMY' 6 cot (thoi gian, ho ten, SDT, email,
// tinh, khoa). Cac field thua (referenceCode, idempotencyKey) bi .gs bo
// qua — de them cot ma tham chieu vao Sheet can sua .gs + deploy lai
// (xem README.md § Viec con lai). Workers gui ca 2 dang key de tuong
// thich khi .gs duoc mo rong.
import { safeLog } from './env';

export interface SheetLeadPayload {
  source: string;
  fullName: string;
  phone: string;
  email: string;
  province: string;
  /** Ten khoa / lua chon hien tren form — .gs doc field `course`. */
  course: string;
  referenceCode: string;
  idempotencyKey: string;
}

export interface SheetResult {
  synced: boolean;
  reason?: string;
}

export async function postLeadToSheet(
  appsScriptUrl: string | undefined,
  payload: SheetLeadPayload,
): Promise<SheetResult> {
  if (!appsScriptUrl?.trim()) {
    return { synced: false, reason: 'apps-script-url-not-configured' };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(appsScriptUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: payload.source,
          fullName: payload.fullName,
          phone: payload.phone,
          email: payload.email,
          province: payload.province,
          course: payload.course,
          // Phong thu / tuong thich .gs mo rong sau nay:
          referenceCode: payload.referenceCode,
          reference_code: payload.referenceCode,
          idempotencyKey: payload.idempotencyKey,
          idempotency_key: payload.idempotencyKey,
        }),
        signal: controller.signal,
      });
      const text = await res.text();
      let data: { ok?: boolean; error?: string } | null = null;
      try {
        data = JSON.parse(text) as { ok?: boolean; error?: string };
      } catch {
        data = null;
      }
      if (data && data.ok === true) {
        return { synced: true };
      }
      safeLog('sheet sync failed', {
        referenceCode: payload.referenceCode,
        reason: data?.error ?? 'apps-script did not confirm ok:true',
      });
      return { synced: false, reason: data?.error ?? 'apps-script-no-confirmation' };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    safeLog('sheet sync error', {
      referenceCode: payload.referenceCode,
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return { synced: false, reason: 'apps-script-unreachable' };
  }
}
