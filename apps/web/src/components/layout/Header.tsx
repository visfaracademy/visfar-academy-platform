// Header — giong file HTML goc: topbar hotline+email (an <=920px nhu goc),
// logo anh, menu 6 muc dung dich anchor, CTA "Nhan lo trinh phu hop",
// cum ben phai theo anh mau: o tim kiem + icon gio hang + icon tai khoan
// (AccountNav — menu tha xuong Dang nhap/Dang ky hoac Xin chao/Dashboard/
// Dang xuat). Nut menu mobile, active-section theo cuon, thanh tien trinh doc.
// Anchor dung "/#..." de link dung ca khi dang o trang khac.
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import AccountNav from '@/components/AccountNav';

const NAV = [
  { href: '/#trang-chu', label: 'TRANG CHỦ', id: 'trang-chu' },
  { href: '/#gioi-thieu', label: 'GIỚI THIỆU', id: 'gioi-thieu' },
  { href: '/#chuong-trinh', label: 'KHÓA HỌC', id: 'chuong-trinh' },
  { href: '/#su-kien', label: 'SỰ KIỆN', id: 'su-kien' },
  { href: '/blog', label: 'BLOG', id: 'blog' },
  { href: '/#tu-van', label: 'KẾT NỐI', id: 'tu-van' },
  { href: '/thu-vien-master', label: 'THƯ VIỆN MASTER', id: 'thu-vien-master' },
];

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('trang-chu');
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // Trang rieng (/blog, /thu-vien-master, /chuong-trinh...): muc menu tuong
  // ung sang chu khong de TRANG CHU sang; chi trang chu moi theo doi cuon.
  useEffect(() => {
    if (pathname === '/blog' || pathname.startsWith('/blog/')) {
      setActive('blog');
      return;
    }
    if (pathname === '/thu-vien-master') {
      setActive('thu-vien-master');
      return;
    }
    if (pathname === '/chuong-trinh' || pathname.startsWith('/chuong-trinh/')) {
      setActive('chuong-trinh');
      return;
    }
    if (pathname !== '/') {
      setActive('');
      return;
    }
    setActive('trang-chu');
  }, [pathname]);

  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? (doc.scrollTop / max) * 100 : 0);
      setScrolled(window.scrollY > 10);
      if (pathname === '/' && window.scrollY < 120) setActive('trang-chu');
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    for (const item of NAV) {
      const el = document.getElementById(item.id);
      if (el) io.observe(el);
    }
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      io.disconnect();
    };
  }, [pathname]);

  return (
    <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
      <div className="topbar">
        <div className="wrap">
          <span>
            Hotline: <a href="tel:+84347897868">034 7897 868</a>
          </span>
          <span aria-hidden="true"> · </span>
          <a href="mailto:visfaracademy@gmail.com">visfaracademy@gmail.com</a>
        </div>
      </div>
      <div className="wrap header-main">
        <Link className="brand" href="/" aria-label="Visfar Academy — Trang chủ">
          <Image
            src="/images/logo.png"
            alt="Logo Visfar Academy — chữ V vàng kim và 5 ngôi sao, dòng chữ VISFAR ACADEMY"
            width={2411}
            height={2411}
            priority
          />
        </Link>
        <button
          type="button"
          id="menuBtn"
          className="menu-btn"
          aria-expanded={menuOpen}
          aria-controls="mainNav"
          aria-label="Mở menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          ☰
        </button>
        <nav
          id="mainNav"
          className={`main-nav${menuOpen ? ' open' : ''}`}
          aria-label="Menu chính"
        >
          {NAV.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active === item.id ? 'true' : undefined}
              className={active === item.id ? 'active' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <AccountNav />
      </div>
      <div id="progressBar" className="progress-bar" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}
