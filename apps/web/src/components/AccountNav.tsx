// Cum cong cu ben phai header — theo anh mau user gui: o tim kiem bo tron
// vien manh + icon gio hang + icon tai khoan hinh tron (menu tha xuong).
// - Tim kiem: go tu khoa, Enter -> /chuong-trinh?q=... (trang khoa hoc doc
//   tham so q de loc that, khong phai tim kiem gia).
// - Gio hang: -> /hoc-vien/giao-dich (don hang / giao dich cua hoc vien).
// - Tai khoan: chua dang nhap -> menu Dang nhap / Dang ky; da dang nhap ->
//   menu "Xin chao, [ten]" + Dashboard + Dang xuat.
// Trang thai: loading (dang kiem tra phien) / signed-out / signed-in / error.
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { signOut } from '@/lib/auth';
import { getSupabaseBrowserClient as getClient, isSupabaseConfigured } from '@/lib/supabase';

type NavState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; displayName: string; email: string; role: string | null }
  | { status: 'signing-out' }
  | { status: 'error'; message: string };

// Chu cai dau ho ten lam avatar tron do (vd "LQ" cho Le Dang Quyet).
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'V';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M2.5 3.5h2l2.5 11.5h9.5l2-8H6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.4-3.2 4.2-4.8 7.5-4.8s6.1 1.6 7.5 4.8" />
    </svg>
  );
}

// Menu tai khoan hoc vien — theo anh mau user gui. "Quan tri" chi hien
// khi profiles.role = 'admin' (visibleAccountMenuItems), chen sau
// "Doi mat khau", truoc nut "Dang xuat" o duoi danh sach.
import { visibleAccountMenuItems } from './account-menu-items';

export default function AccountNav() {
  const router = useRouter();
  const [state, setState] = useState<NavState>({ status: 'loading' });
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState({ status: 'not-configured' });
      return;
    }
    const supabase = getClient();
    if (!supabase) {
      setState({ status: 'not-configured' });
      return;
    }
    const client = supabase;
    let cancelled = false;
    async function refresh() {
      const { data } = await client.auth.getUser();
      if (cancelled) return;
      const user = data.user;
      if (!user) {
        setState({ status: 'signed-out' });
        return;
      }
      const { data: profile } = await client
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const displayName =
        (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
        user.user_metadata?.full_name ||
        user.email ||
        'Học viên';
      setState({
        status: 'signed-in',
        displayName,
        email: user.email ?? '',
        role: (profile as { role?: string | null } | null)?.role ?? null,
      });
    }
    void refresh();
    const { data: listener } = client.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/chuong-trinh?q=${encodeURIComponent(q)}` : '/chuong-trinh');
  }

  const pathname = usePathname();
  const signedIn = state.status === 'signed-in';
  const displayName = signedIn ? state.displayName : '';
  const email = signedIn ? state.email : '';

  // Menu tai khoan da dang nhap — theo anh mau user gui (xem
  // account-menu-items.ts). "Quan tri" chi hien cho admin; hoc vien
  // khong thay muc nay. Nut "Dang xuat" render sau danh sach menu.
  const MENU_ITEMS = visibleAccountMenuItems(signedIn ? state.role : null);

  function menuIcon(kind: string) {
    const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
    switch (kind) {
      case 'grid':
        return (<svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>);
      case 'book':
        return (<svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5V5.5" /><path d="M20 18H6.5" /></svg>);
      case 'calendar':
        return (<svg {...common}><rect x="3.5" y="5" width="17" height="16" rx="2" /><line x1="3.5" y1="10" x2="20.5" y2="10" /><line x1="8" y1="2.5" x2="8" y2="6.5" /><line x1="16" y1="2.5" x2="16" y2="6.5" /></svg>);
      case 'receipt':
        return (<svg {...common}><path d="M6 3.5h12V20l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 20Z" /><line x1="9.5" y1="8" x2="14.5" y2="8" /><line x1="9.5" y1="12" x2="14.5" y2="12" /></svg>);
      case 'history':
        return (<svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /><path d="M4 4.5v3h3" /></svg>);
      case 'wallet':
        return (<svg {...common}><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18" /><circle cx="17" cy="15" r="1.2" /></svg>);
      case 'shield':
        return (<svg {...common}><path d="M12 3l7 3v5.5c0 4.5-3 7.7-7 9.5-4-1.8-7-5-7-9.5V6Z" /><path d="M9 11.5l2.2 2.2L15.5 9.5" /></svg>);
      case 'key':
        return (<svg {...common}><circle cx="8" cy="15.5" r="4" /><path d="M11 12.5 20 3.5" /><path d="M16 7.5l2.5 2.5" /><path d="M13.5 10l2 2" /></svg>);
      case 'sparkles':
        return (<svg {...common}><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3Z" /><path d="M18.5 15l0.9 2.3 2.3 0.9-2.3 0.9-0.9 2.3-0.9-2.3-2.3-0.9 2.3-0.9Z" /></svg>);
      default:
        return <UserIcon />;
    }
  }

  return (
    <span className="account-nav">
      <form className="header-search" role="search" onSubmit={submitSearch}>
        <SearchIcon />
        <input
          type="search"
          placeholder="Tìm kiếm..."
          aria-label="Tìm khóa học"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      <Link href="/hoc-vien/giao-dich" className="header-icon-btn" aria-label="Giỏ hàng và giao dịch của tôi">
        <CartIcon />
      </Link>
      <span className="account-menu" ref={menuRef}>
        {signedIn ? (
          <button
            type="button"
            className="account-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Tài khoản — ${displayName}`}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="account-avatar" aria-hidden="true">{initialsOf(displayName)}</span>
            <span className="account-trigger-name">{displayName}</span>
            <ChevronIcon open={menuOpen} />
          </button>
        ) : (
          <button
            type="button"
            className="header-icon-btn account-circle"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Tài khoản"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <UserIcon />
          </button>
        )}
        {menuOpen && (
          <span className="account-dropdown" role="menu">
            {signedIn ? (
              <>
                <span className="account-dropdown-head">
                  <span className="account-dropdown-avatar" aria-hidden="true">
                    {initialsOf(displayName)}
                  </span>
                  <span className="account-dropdown-id">
                    <span className="account-dropdown-name">{displayName}</span>
                    {email && <span className="account-dropdown-email">{email}</span>}
                  </span>
                </span>
                {MENU_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    aria-current={pathname === item.href || (item.href !== '/hoc-vien' && pathname.startsWith(item.href)) ? 'page' : undefined}
                    className={pathname === item.href || (item.href !== '/hoc-vien' && pathname.startsWith(item.href)) ? 'active' : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {menuIcon(item.icon)}
                    {item.label}
                  </Link>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  className="account-signout"
                  onClick={() => {
                    setMenuOpen(false);
                    setState({ status: 'signing-out' });
                    void signOut().then(() => setState({ status: 'signed-out' }));
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h5.5v16H14" /><path d="M3.5 12h12" /><path d="M12.5 8l4 4-4 4" /></svg>
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link href="/dang-nhap" role="menuitem" onClick={() => setMenuOpen(false)}>
                  Đăng nhập
                </Link>
                <Link href="/dang-ky" role="menuitem" onClick={() => setMenuOpen(false)}>
                  Đăng ký
                </Link>
              </>
            )}
          </span>
        )}
      </span>
    </span>
  );
}
