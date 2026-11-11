// Test lib cong dong (Prompt 13) — chay local, khong can Supabase that.
// Fake client mo phong chuoi query cua supabase-js (thenable).
import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_PAGE_SIZE,
  REACTION_TYPES,
  createCommunityPost,
  fetchCommunityPostDetail,
  fetchCommunityPosts,
  groupReactions,
  toggleReaction,
  validateComment,
  validatePost,
  validateReport,
} from './community';

type Row = Record<string, unknown>;

class FakeQuery {
  constructor(
    private result: { data: unknown; error: { message: string } | null },
    private onWrite?: (kind: string, values?: Row) => void,
  ) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  in() {
    return this;
  }
  order() {
    return this;
  }
  range() {
    return this;
  }
  limit() {
    return this;
  }
  insert(values?: Row) {
    this.onWrite?.('insert', values);
    return this;
  }
  update(values?: Row) {
    this.onWrite?.('update', values);
    return this;
  }
  delete() {
    this.onWrite?.('delete');
    return this;
  }
  maybeSingle() {
    return Promise.resolve(this.result);
  }
  single() {
    return Promise.resolve(this.result);
  }
  then(onF: (v: { data: unknown; error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
    return Promise.resolve(this.result).then(onF, onR);
  }
}

interface FakeOpts {
  tables?: Record<string, { data: unknown; error: { message: string } | null }>;
  userId?: string | null;
}

function makeFakeClient(opts: FakeOpts = {}) {
  const writes: Array<{ table: string; kind: string; values?: Row }> = [];
  const client = {
    writes,
    auth: {
      getUser: async () =>
        opts.userId === undefined || opts.userId
          ? { data: { user: { id: opts.userId ?? 'user-1', email: 'a@b.co' } } }
          : { data: { user: null } },
    },
    from(table: string) {
      const res = opts.tables?.[table] ?? { data: [], error: null };
      return new FakeQuery(res, (kind, values) => writes.push({ table, kind, values }));
    },
  };
  return client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (c: unknown) => c as any;

const POST_A = {
  id: 'p1',
  author_id: 'user-1',
  course_id: null,
  title: 'Chia se cach duy tri thoi quen hoc',
  body: 'Minh hoc 30 phut moi sang.',
  author_name: 'An',
  created_at: '2026-11-11T00:00:00Z',
  updated_at: '2026-11-11T00:00:00Z',
  is_pinned: false,
  status: 'visible',
};
const POST_B = { ...POST_A, id: 'p2', title: 'Hoi ve bai tap tuan 2', author_id: 'user-2', author_name: 'Binh' };

describe('validatePost / validateComment / validateReport', () => {
  it('tieu de < 3 ky tu, noi dung rong, qua dai deu bao loi', () => {
    expect(validatePost({ title: 'Hi', body: 'ok' })).toContain('Tiêu đề cần ít nhất 3 ký tự.');
    expect(validatePost({ title: 'Duoc roi', body: '' })).toContain('Nội dung không được để trống.');
    expect(validatePost({ title: 'x'.repeat(201), body: 'ok' })).toContain('Tiêu đề tối đa 200 ký tự.');
    expect(validatePost({ title: 'Tieu de tot', body: 'Noi dung tot' })).toEqual([]);
  });

  it('binh luan rong / qua 2000 ky tu bao loi', () => {
    expect(validateComment('')).toContain('Bình luận không được để trống.');
    expect(validateComment('x'.repeat(2001))).toContain('Bình luận tối đa 2000 ký tự.');
    expect(validateComment('Cam on ban!')).toEqual([]);
  });

  it('ly do bao cao < 3 ky tu bao loi', () => {
    expect(validateReport('ab')).toContain('Lý do báo cáo cần ít nhất 3 ký tự.');
    expect(validateReport('Noi dung spam quang cao')).toEqual([]);
  });
});

describe('REACTION_TYPES', () => {
  it('du 3 loai cam xuc, khong co video / tuong tac gay nghien', () => {
    expect(REACTION_TYPES.map((r) => r.type)).toEqual(['like', 'helpful', 'celebrate']);
  });
});

describe('groupReactions', () => {
  it('gom dung so luot theo bai, bo loai la', () => {
    const rows = [
      { post_id: 'p1', type: 'like', user_id: 'u1' },
      { post_id: 'p1', type: 'like', user_id: 'u2' },
      { post_id: 'p1', type: 'helpful', user_id: 'u3' },
      { post_id: 'p2', type: 'like', user_id: 'u1' },
      { post_id: 'p1', type: 'laugh', user_id: 'u4' },
    ];
    const g = groupReactions(rows, 'p1', 'post');
    expect(g.counts).toEqual({ like: 2, helpful: 1, celebrate: 0 });
    expect(g.total).toBe(3);
  });
});

describe('fetchCommunityPosts', () => {
  it('chua dang nhap -> signed-out', async () => {
    const res = await fetchCommunityPosts({}, asClient(makeFakeClient({ userId: null })));
    expect(res.status).toBe('signed-out');
  });

  it('tra danh sach + so binh luan + so cam xuc, hasMore sai khi it hon limit', async () => {
    const client = makeFakeClient({
      tables: {
        community_posts: { data: [POST_A, POST_B], error: null },
        community_reactions: {
          data: [
            { post_id: 'p1', type: 'like', user_id: 'u1' },
            { post_id: 'p1', type: 'helpful', user_id: 'u2' },
          ],
          error: null,
        },
        community_comments: { data: [{ post_id: 'p1' }, { post_id: 'p1' }], error: null },
      },
    });
    const res = await fetchCommunityPosts({}, asClient(client));
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;
    expect(res.items).toHaveLength(2);
    expect(res.items[0].counts).toEqual({ like: 1, helpful: 1, celebrate: 0 });
    expect(res.items[0].commentCount).toBe(2);
    expect(res.items[1].commentCount).toBe(0);
    expect(res.hasMore).toBe(false);
    expect(COMMUNITY_PAGE_SIZE).toBe(20);
  });

  it('loi DB -> error ro rang', async () => {
    const client = makeFakeClient({
      tables: { community_posts: { data: null, error: { message: 'boom' } } },
    });
    const res = await fetchCommunityPosts({}, asClient(client));
    expect(res.status).toBe('error');
  });
});

describe('fetchCommunityPostDetail', () => {
  it('tra bai + binh luan + cam xuc cua minh', async () => {
    const client = makeFakeClient({
      tables: {
        community_posts: { data: POST_A, error: null },
        community_comments: {
          data: [{ id: 'c1', post_id: 'p1', author_id: 'user-2', body: 'Hay qua', author_name: 'Binh', created_at: '2026-11-11T01:00:00Z' }],
          error: null,
        },
        community_reactions: {
          data: [
            { post_id: 'p1', comment_id: null, type: 'like', user_id: 'user-1' },
            { post_id: 'p1', comment_id: null, type: 'helpful', user_id: 'user-2' },
          ],
          error: null,
        },
      },
    });
    const res = await fetchCommunityPostDetail('p1', asClient(client));
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;
    expect(res.post.title).toContain('thoi quen');
    expect(res.comments).toHaveLength(1);
    expect(res.counts).toEqual({ like: 1, helpful: 1, celebrate: 0 });
    expect(res.myReactions).toEqual(['like']);
  });
});

describe('createCommunityPost', () => {
  it('khong gui khi tieu de qua ngan', async () => {
    const client = makeFakeClient();
    const res = await createCommunityPost({ title: 'Hi', body: 'ok' }, asClient(client));
    expect(res.status).toBe('error');
    expect(client.writes).toHaveLength(0);
  });

  it('gui dung author_id + author_name lay tu ho so cua minh', async () => {
    const client = makeFakeClient({
      tables: {
        profiles: { data: { full_name: 'Nguyen Van An' }, error: null },
        community_posts: { data: { id: 'new-1' }, error: null },
      },
    });
    const res = await createCommunityPost(
      { title: 'Tieu de tot', body: 'Noi dung tot', courseId: null },
      asClient(client),
    );
    expect(res).toEqual({ status: 'ok', id: 'new-1' });
    const insert = client.writes.find((w) => w.table === 'community_posts' && w.kind === 'insert');
    expect(insert?.values?.author_id).toBe('user-1');
    expect(insert?.values?.author_name).toBe('Nguyen Van An');
  });
});

describe('toggleReaction', () => {
  it('chua tha -> insert; da tha -> delete (toggle)', async () => {
    const clientNew = makeFakeClient({
      tables: { community_reactions: { data: null, error: null } },
    });
    const resNew = await toggleReaction({ postId: 'p1' }, 'like', asClient(clientNew));
    expect(resNew.status).toBe('ok');
    expect(clientNew.writes.some((w) => w.kind === 'insert')).toBe(true);

    const clientOld = makeFakeClient({
      tables: { community_reactions: { data: { id: 'r1' }, error: null } },
    });
    const resOld = await toggleReaction({ postId: 'p1' }, 'like', asClient(clientOld));
    expect(resOld.status).toBe('ok');
    expect(clientOld.writes.some((w) => w.kind === 'delete')).toBe(true);
  });
});
