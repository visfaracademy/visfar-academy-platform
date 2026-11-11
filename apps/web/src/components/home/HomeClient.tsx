// Hanh vi client dung chung cho trang chu: reveal khi cuon + nut noi.
// Reveal giong goc: IntersectionObserver threshold 0.08, stagger toi da
// 320ms tren man hinh >640px, fallback them .in sau 2000ms; tat khi
// prefers-reduced-motion. Nut noi Zalo + ve dau trang hien khi cuon >240
// va form tu van khong nam trong viewport (nhu updateFloats() goc).
'use client';

import { useEffect, useState } from 'react';

export function RevealInit() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (els.length === 0) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wide = window.innerWidth > 640;
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const idx = els.indexOf(el);
          const delay = wide ? Math.min(idx * 80, 320) : 0;
          window.setTimeout(() => el.classList.add('in'), delay);
          io.unobserve(el);
        }
      },
      { threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    const fallback = window.setTimeout(() => els.forEach((el) => el.classList.add('in')), 2000);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);
  return null;
}

export function FloatingButtons() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const form = document.getElementById('tu-van');
    function update() {
      const past = window.scrollY > 240;
      let formVisible = false;
      if (form) {
        const r = form.getBoundingClientRect();
        formVisible = r.top < window.innerHeight && r.bottom > 0;
      }
      setShow(past && !formVisible);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  if (!show) return null;
  return (
    <>
      <a
        id="floatZalo"
        className="float-zalo"
        href="https://zalo.me/0347897868/"
        target="_blank"
        rel="noopener"
        aria-label="Zalo hỗ trợ"
      >
        <span aria-hidden="true" className="float-zalo-z">
          Z
        </span>
        Zalo hỗ trợ
      </a>
      <a
        id="floatCta"
        className="float-cta"
        href="/#tu-van"
        aria-label="Đăng kí ngay"
      >
        Đăng kí ngay
      </a>
      <a
        id="floatTop"
        className="float-top"
        href="#trang-chu"
        aria-label="Về đầu trang"
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        ↑
      </a>
    </>
  );
}
