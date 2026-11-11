// Tam giac hien thuc — SVG 8 vong / 24 nhan, lay NGUYEN VAN tu file HTML goc
// (workspace/user/files/Visfar_Academy.html, <svg class="triangle-svg">).
// Chuoi SVG giu nguyen thuoc tinh HTML goc vi render qua
// dangerouslySetInnerHTML. Tuong tac giong goc: tro/cham/focus vao 1 vong
// -> vong do noi, 7 vong con lai mo; roi chuot / bam ngoai / Escape ->
// khoi phuc thu tu goc. Nhan giu ~3,98px o 390px theo quyet dinh 2
// (user da chap nhan), khong them legend (user yeu cau bo ngay 10/11/2026).
'use client';

import { useEffect, useRef } from 'react';

const TRIANGLE_SVG = `<svg class="triangle-svg" viewBox="0 0 1024 891" role="group" aria-label="Tam giác hiện thực 8 lớp tương tác: trỏ chuột hoặc chạm vào từng dải màu để làm nổi dải đó. Lõi Năng lượng, Thông tin, Vật chất; các lớp Tin, Biết, Hiểu; Nghiệp thức, Nghiệp duyên, Nghiệp quả; Nhân, Duyên, Quả; Khái niệm nguồn, Trạng thái nội tâm, Hình ảnh tâm trí; Thân, Tâm, Tuệ; Đạo lý, Tôn giáo, Khoa học; ngoài cùng Nhân sinh quan, Vũ trụ quan, Thế giới quan.">
            <title>Tam giác hiện thực 8 lớp</title>
            <g class="tri-ring" data-ring="yellow" tabindex="0" role="img" aria-label="Lớp vàng ngoài cùng: Nhân sinh quan, Vũ trụ quan, Thế giới quan">
              <path class="band" fill="#ffff00" fill-rule="evenodd" d="M512,16 L16.06,875 L1007.94,875 Z M512,83.05 L74.12,841.48 L949.88,841.48 Z"/>
              <text class="lbl-navy" x="512" y="63.39">VŨ</text>
              <text class="lbl-navy" x="512" y="75.89">TRỤ QUAN</text>
              <text class="lbl-navy" x="123" y="858.24">NHÂN SINH QUAN</text>
              <text class="lbl-navy" x="901" y="858.24">THẾ GIỚI QUAN</text>
            </g>
            <g class="tri-ring" data-ring="orange" tabindex="0" role="img" aria-label="Lớp cam: Đạo lý, Tôn giáo, Khoa học">
              <path class="band" fill="#ff8000" fill-rule="evenodd" d="M512,83.05 L74.12,841.48 L949.88,841.48 Z M512,150.10 L132.19,807.95 L891.81,807.95 Z"/>
              <text class="lbl-navy" x="512" y="142.63">TÔN GIÁO</text>
              <text class="lbl-navy" x="182" y="824.71">ĐẠO LÝ</text>
              <text class="lbl-navy" x="842" y="824.71">KHOA HỌC</text>
            </g>
            <g class="tri-ring" data-ring="green" tabindex="0" role="img" aria-label="Lớp xanh lá: Thân, Tâm, Tuệ">
              <path class="band" fill="#00ff00" fill-rule="evenodd" d="M512,150.10 L132.19,807.95 L891.81,807.95 Z M512,217.14 L190.25,774.43 L833.75,774.43 Z"/>
              <text class="lbl-navy" x="512" y="210.16">TÂM</text>
              <text class="lbl-navy" x="238" y="791.19">THÂN</text>
              <text class="lbl-navy" x="786" y="791.19">TUỆ</text>
            </g>
            <g class="tri-ring" data-ring="cyan" tabindex="0" role="img" aria-label="Lớp cyan: Khái niệm nguồn, Trạng thái nội tâm, Hình ảnh tâm trí">
              <path class="band" fill="#00ffff" fill-rule="evenodd" d="M512,217.14 L190.25,774.43 L833.75,774.43 Z M512,284.19 L248.32,740.90 L775.68,740.90 Z"/>
              <text class="lbl-navy" x="512" y="258.10">TRẠNG</text>
              <text class="lbl-navy" x="512" y="270.60">THÁI</text>
              <text class="lbl-navy" x="512" y="283.10">NỘI TÂM</text>
              <text class="lbl-navy" x="294" y="757.67">KHÁI NIỆM NGUỒN</text>
              <text class="lbl-navy" x="730" y="757.67">HÌNH ẢNH TÂM TRÍ</text>
            </g>
            <g class="tri-ring" data-ring="steel" tabindex="0" role="img" aria-label="Lớp xanh thép: Nhân, Duyên, Quả">
              <path class="band" fill="#4a86e8" fill-rule="evenodd" d="M512,284.19 L248.32,740.90 L775.68,740.90 Z M512,351.24 L306.38,707.38 L717.62,707.38 Z"/>
              <text class="lbl-navy" x="512" y="344.26">DUYÊN</text>
              <text class="lbl-navy" x="335" y="724.14">NHÂN</text>
              <text class="lbl-navy" x="689" y="724.14">QUẢ</text>
            </g>
            <g class="tri-ring" data-ring="blue" tabindex="0" role="img" aria-label="Lớp xanh dương: Nghiệp thức, Nghiệp duyên, Nghiệp quả">
              <path class="band" fill="#0000ff" fill-rule="evenodd" d="M512,351.24 L306.38,707.38 L717.62,707.38 Z M512,418.29 L364.45,673.86 L659.55,673.86 Z"/>
              <text class="lbl-gold" x="512" y="397.79">NGHIỆP</text>
              <text class="lbl-gold" x="512" y="411.36">DUYÊN</text>
              <text class="lbl-gold" x="381" y="690.62">NGHIỆP THỨC</text>
              <text class="lbl-gold" x="643" y="690.62">NGHIỆP QUẢ</text>
            </g>
            <g class="tri-ring" data-ring="purple" tabindex="0" role="img" aria-label="Lớp tím: Tin, Biết, Hiểu">
              <path class="band" fill="#9900ff" fill-rule="evenodd" d="M512,418.29 L364.45,673.86 L659.55,673.86 Z M512,485.33 L422.51,640.33 L601.49,640.33 Z"/>
              <text class="lbl-gold" x="512" y="479.61">TIN</text>
              <text class="lbl-gold" x="422" y="657.10">BIẾT</text>
              <text class="lbl-gold" x="602" y="657.10">HIỂU</text>
            </g>
            <g class="tri-ring" data-ring="pink" tabindex="0" role="img" aria-label="Lõi hồng: Năng lượng, Thông tin, Vật chất">
              <path class="band" fill="#ff00ff" d="M512,485.33 L422.51,640.33 L601.49,640.33 Z"/>
              <path class="y-divider" d="M460.99,573.68 L512,588.67 M563.01,573.68 L512,588.67 M512,588.67 L512,640.33"/>
              <text class="lbl-navy" x="512" y="563.18">NĂNG LƯỢNG</text>
              <text class="lbl-navy" x="465" y="630.80">THÔNG TIN</text>
              <text class="lbl-navy" x="559" y="630.80">VẬT CHẤT</text>
            </g>
          </svg>`;

export default function TriangleDiagram() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const svgEl = root.querySelector('svg.triangle-svg');
    if (!svgEl) return;
    const svg: Element = svgEl;
    const rings = Array.from(svg.querySelectorAll<SVGGElement>('.tri-ring'));
    const originalOrder = [...rings];
    let active: SVGGElement | null = null;

    function activate(ring: SVGGElement) {
      if (active === ring) return;
      deactivate();
      active = ring;
      svg.classList.add('has-active');
      ring.classList.add('is-active');
      svg.appendChild(ring);
    }
    function deactivate() {
      if (!active) return;
      active.classList.remove('is-active');
      svg.classList.remove('has-active');
      active = null;
      // Khoi phuc thu tu goc (nhu restoreOrder() trong file goc).
      for (const r of originalOrder) svg.appendChild(r);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') deactivate();
    }
    function onDocClick(e: MouseEvent) {
      if (active && !(e.target as Element).closest('.tri-ring')) deactivate();
    }
    const cleanups: Array<() => void> = [];
    for (const ring of rings) {
      const enter = () => activate(ring);
      const leave = () => deactivate();
      const click = (e: MouseEvent) => {
        e.stopPropagation();
        if (active === ring) deactivate();
        else activate(ring);
      };
      ring.addEventListener('mouseenter', enter);
      ring.addEventListener('mouseleave', leave);
      ring.addEventListener('focus', enter);
      ring.addEventListener('focusout', leave);
      ring.addEventListener('click', click);
      cleanups.push(() => {
        ring.removeEventListener('mouseenter', enter);
        ring.removeEventListener('mouseleave', leave);
        ring.removeEventListener('focus', enter);
        ring.removeEventListener('focusout', leave);
        ring.removeEventListener('click', click);
      });
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDocClick);
    return () => {
      cleanups.forEach((fn) => fn());
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick);
    };
  }, []);

  return <div ref={ref} className="triangle-interactive" dangerouslySetInnerHTML={{ __html: TRIANGLE_SVG }} />;
}
