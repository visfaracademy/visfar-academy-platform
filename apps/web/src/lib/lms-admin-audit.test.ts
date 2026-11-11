// Test Task 09 (phan 4/4): hoan tra don hang — thao tac quan tri
// quan trong duy nhat con thieu audit truoc phan nay (da kiem tra:
// doi role co o admin-users.ts, phan cong giang vien co o lms-admin.ts,
// xuat ban/an khoa di qua course.update, cham bai co o route reviews).
// Chay local, khong can Supabase that.
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { refundOrder } from './lms-admin';

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(r: Row) => boolean> = [];
  private pendingUpdate: Row | null = null;
  private pendingInsert: Row | null = null;
  private applied = false;
  constructor(
    private store: Record<string, Row[]>,
    private table: string,
  ) {}
  select() {
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  in(col: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[col]));
    return this;
  }
  order() {
    return this;
  }
  private rows(): Row[] {
    return (this.store[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
  }
  private applyUpdate(): Row[] {
    if (this.applied) return this.rows();
    this.applied = true;
    if (!this.pendingUpdate) return this.rows();
    const targets = this.rows();
    for (const row of targets) Object.assign(row, this.pendingUpdate);
    return targets;
  }
  async maybeSingle() {
    if (this.pendingInsert) return { data: this.pendingInsert, error: null };
    return { data: this.applyUpdate()[0] ?? null, error: null };
  }
  async single() {
    if (this.pendingInsert) return { data: this.pendingInsert, error: null };
    const rows = this.applyUpdate();
    if (rows.length === 0) return { data: null, error: { message: 'No rows found' } };
    return { data: rows[0], error: null };
  }
  update(values: Row) {
    this.pendingUpdate = values;
    return this;
  }
  insert(values: Row) {
    const row: Row = { id: `gen-${Math.random().toString(36).slice(2, 10)}`, ...values };
    (this.store[this.table] ??= []).push(row);
    this.pendingInsert = row;
    return this;
  }
  then(onF: (v: { data: unknown; error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
    let data: unknown;
    if (this.pendingInsert) data = [this.pendingInsert];
    else if (this.pendingUpdate) data = this.applyUpdate();
    else data = this.rows();
    return Promise.resolve({ data, error: null }).then(onF, onR);
  }
}

function makeClient(store: Record<string, Row[]>): SupabaseClient {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } }, error: null }) },
    from(table: string) {
      return new FakeQuery(store, table);
    },
  } as unknown as SupabaseClient;
}

function baseStore(): Record<string, Row[]> {
  return {
    orders: [
      {
        id: 'ord-1',
        user_id: 'user-1',
        course_id: 'c1',
        amount_vnd: 1999000,
        status: 'paid',
        created_at: '2026-11-05T00:00:00+07:00',
      },
    ],
    audit_logs: [],
  };
}

describe('refundOrder — hoan tra don da thanh toan + audit order.refund', () => {
  it('paid -> refunded + audit ghi ly do + so tien + trang thai cu', async () => {
    const store = baseStore();
    const res = await refundOrder(makeClient(store), {
      adminId: 'admin-1',
      orderId: 'ord-1',
      reason: 'Học viên yêu cầu trong hạn 15 ngày làm việc',
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.previousStatus).toBe('paid');
    expect(store.orders[0].status).toBe('refunded');
    expect(store.audit_logs).toHaveLength(1);
    expect(store.audit_logs[0].action).toBe('order.refund');
    expect(store.audit_logs[0].actor_id).toBe('admin-1');
    expect(store.audit_logs[0].target_type).toBe('order');
    expect(store.audit_logs[0].target_id).toBe('ord-1');
    const details = store.audit_logs[0].details as Row;
    expect(details.amount_vnd).toBe(1999000);
    expect(details.previous_status).toBe('paid');
    expect(details.reason).toBe('Học viên yêu cầu trong hạn 15 ngày làm việc');
  });
  it('thieu ly do / ly do qua dai -> loi, don giu nguyen', async () => {
    const store = baseStore();
    const noReason = await refundOrder(makeClient(store), { adminId: 'admin-1', orderId: 'ord-1', reason: '   ' });
    expect(noReason.status).toBe('error');
    const tooLong = await refundOrder(makeClient(store), { adminId: 'admin-1', orderId: 'ord-1', reason: 'a'.repeat(501) });
    expect(tooLong.status).toBe('error');
    expect(store.orders[0].status).toBe('paid');
    expect(store.audit_logs).toHaveLength(0);
  });
  it('don chua thanh toan / da hoan tra / khong ton tai -> loi, khong ghi audit', async () => {
    const store = baseStore();
    store.orders.push(
      { id: 'ord-2', user_id: 'user-1', course_id: 'c1', amount_vnd: 0, status: 'pending', created_at: '2026-11-09T00:00:00+07:00' },
      { id: 'ord-3', user_id: 'user-1', course_id: 'c1', amount_vnd: 500000, status: 'refunded', created_at: '2026-11-01T00:00:00+07:00' },
    );
    expect((await refundOrder(makeClient(store), { adminId: 'admin-1', orderId: 'ord-2', reason: 'Hoàn' })).status).toBe('error');
    expect((await refundOrder(makeClient(store), { adminId: 'admin-1', orderId: 'ord-3', reason: 'Hoàn lại' })).status).toBe('error');
    expect((await refundOrder(makeClient(store), { adminId: 'admin-1', orderId: 'khong-co', reason: 'Hoàn' })).status).toBe('error');
    expect(store.audit_logs).toHaveLength(0);
    expect(store.orders.find((o) => o.id === 'ord-2')?.status).toBe('pending');
  });
});
