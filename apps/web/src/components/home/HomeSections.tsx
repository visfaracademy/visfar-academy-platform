// Cac section tinh cua trang chu — noi dung NGUYEN VAN tu file HTML goc.
// Thu tu DOM giong goc: #lo-trinh long trong #triet-ly (chua muc 4-6 +
// Tuyen ngon triet ly), #su-kien la <div> nam trong #blog.
import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ConsultationForm from '@/components/ConsultationForm';
import TriangleDiagram from '@/components/home/TriangleDiagram';
import CourseExplorer from '@/components/home/CourseExplorer';
import {
  BIZ_CARDS,
  BLOG_POSTS,
  DESTINATION,
  EQUATION_NOTE,
  FACETS,
  FAQS,
  FIELDS,
  FOUNDER_PARAGRAPHS,
  GOALS,
  HERO_PARAGRAPHS,
  HOME_EVENTS,
  HOUSE_LEGEND,
  JOURNEY_LINKS,
  MISSION,
  PHILOSOPHY_CORE,
  PHILOSOPHY_VIEW,
  PRINCIPLES,
  ROADMAP_STEPS,
  TESTIMONIALS,
  UPDATE_CARDS,
  VISION_BODY,
  VISION_FOOT,
  VISION_LEAD,
} from '@/lib/homepage-data';

function Chapter({ children }: { children: React.ReactNode }) {
  return <p className="chapter">{children}</p>;
}

function SecHead({
  chapter,
  kicker,
  title,
  titleId,
  lead,
}: {
  chapter?: string;
  kicker?: string;
  title: string;
  titleId?: string;
  lead?: string;
}) {
  return (
    <div className="sec-head reveal">
      {chapter ? <Chapter>{chapter}</Chapter> : null}
      {kicker ? <p className="kicker">{kicker}</p> : null}
      <h2 className="title gold-title" id={titleId}>
        {title}
      </h2>
      {lead ? <p className="lead">{lead}</p> : null}
    </div>
  );
}

export function JourneyNav() {
  return (
    <nav className="journey-nav" aria-label="Mục lục hành trình">
      <div className="wrap">
        <span className="label">Hành trình</span>
        {JOURNEY_LINKS.map((l) => (
          <a key={l.href} href={l.href}>
            {l.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function HeroSection() {
  return (
    <section id="trang-chu" className="hero">
      <div className="wrap">
        <figure className="hero-group-photo reveal in">
          <Image
            src="/images/hero-group.jpg"
            alt="Đông đảo thành viên và học viên Visfar Academy đứng trên sân khấu trong một sự kiện của học viện"
            width={1334}
            height={889}
            priority
            fetchPriority="high"
          />
        </figure>
        <div className="hero-manifesto">
          <h1 className="chapter">Visfar Academy</h1>
          <h2>
            <span className="manifesto-line1a">
              KHAI MỞ TÂM THỨC <span className="manifesto-dot">•</span> TU DƯỠNG ĐẠO ĐỨC
            </span>
            <span className="manifesto-line1b">
              PHÁT TRIỂN TRÍ TUỆ <span className="manifesto-dot">•</span> HOÀN THIỆN CON NGƯỜI
            </span>
            <span className="manifesto-line2">KIẾN TẠO THỊNH VƯỢNG</span>
          </h2>
          <p className="lead">{HERO_PARAGRAPHS[0]}</p>
          <p>{HERO_PARAGRAPHS[1]}</p>
          <p>{HERO_PARAGRAPHS[2]}</p>
          <p>{HERO_PARAGRAPHS[3]}</p>
          <div className="hero-cta">
            <a className="btn btn-gold" href="#triet-ly">
              Khám phá triết lý Visfar
            </a>{' '}
            <a className="link-quiet" href="#chuong-trinh">
              Tìm hiểu các chương trình →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MissionSection() {
  return (
    <section id="su-menh-tam-nhin" aria-labelledby="missionTitle">
      <div className="wrap">
        <div className="sec-head reveal">
          <h2 className="title gold-title" id="missionTitle">
            Sứ mệnh <span className="mv-amp">&amp;</span> Tầm nhìn
          </h2>
        </div>
        <div className="mv-grid">
          <article className="mv-card reveal">
            <h3>Sứ mệnh</h3>
            <p>{MISSION}</p>
          </article>
          <article className="mv-card reveal">
            <h3>Tầm nhìn</h3>
            <p>
              <strong>{VISION_LEAD}</strong>
            </p>
            <p>{VISION_BODY}</p>
          </article>
        </div>
        <p className="mv-foot reveal">{VISION_FOOT}</p>
      </div>
    </section>
  );
}

export function FounderSection() {
  return (
    <section id="gioi-thieu" className="cream" aria-labelledby="founderTitle">
      <div className="wrap">
        <Chapter>Người sáng lập</Chapter>
        <div className="founder-grid">
          <figure className="reveal">
            <Image
              src="/images/founder.jpg"
              alt="Lê Đăng Quyết mặc vest xanh navy, áo sơ mi đen và cà vạt sọc, mỉm cười đứng trong không gian sự kiện"
              width={1200}
              height={1200}
              loading="lazy"
            />
          </figure>
          <div>
            <p id="founderTitle" className="founder-name gold-title">LÊ ĐĂNG QUYẾT</p>
            <p className="founder-role">
              Nhà sáng lập Visfar Academy. Người kiến tạo và lan tỏa triết lý giáo dục tận gốc
            </p>
            <p>{FOUNDER_PARAGRAPHS[0]}</p>
            <p>{FOUNDER_PARAGRAPHS[1]}</p>
            <p>{FOUNDER_PARAGRAPHS[2]}</p>
          </div>
        </div>
        <div className="founder-rest">
          <p>{FOUNDER_PARAGRAPHS[3]}</p>
          <p>{FOUNDER_PARAGRAPHS[4]}</p>
          <p>{FOUNDER_PARAGRAPHS[5]}</p>
        </div>
      </div>
    </section>
  );
}

export function PhilosophySection() {
  return (
    <section id="triet-ly" aria-labelledby="philosophyTitle">
      <div className="wrap">
        <div className="sec-head reveal">
          <h2 className="title gold-title" id="philosophyTitle">
            TRIẾT LÝ GIÁO DỤC TẬN GỐC
          </h2>
        </div>

        <div className="phil-block reveal">
          <h3>
            <span className="phil-num">1.</span> TƯ TƯỞNG CỐT LÕI
          </h3>
          {PHILOSOPHY_CORE.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <div className="phil-block reveal">
          <h3>
            <span className="phil-num">2.</span> QUAN NIỆM GIÁO DỤC
          </h3>
          {PHILOSOPHY_VIEW.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <div className="equation">
            <p className="eq">
              <span className="box">NHÂN TỐT</span>
              <span className="op">+</span>
              <span className="box">DUYÊN LÀNH</span>
              <span className="op">=</span>
              <span className="box">QUẢ NHƯ Ý</span>
            </p>
            <p className="equation-note">{EQUATION_NOTE}</p>
          </div>
        </div>

        <div className="phil-block reveal" id="bay-phuong-dien">
          <h3>
            <span className="phil-num">3.</span> HỆ THỐNG GIÁO DỤC
          </h3>
          <p className="phil-key">THẬP NHẤT VIÊN MÃN – 11 PHƯƠNG DIỆN PHÁT TRIỂN CON NGƯỜI</p>
          <p>
            Giáo dục Tận Gốc của VISFAR được phát triển thành hệ thống tri thức và phương pháp giáo
            dục hướng đến sự viên mãn trên 11 phương diện cốt lõi:
          </p>
          <figure className="house-figure">
            <Image
              src="/images/visfar-home.webp"
              alt="Đồ hình ngôi nhà viên mãn VISFAR HOME: Trí tuệ ở giữa, mười yếu tố Vật chất, Năng lực, Nhân cách, Phẩm chất, Tâm đạo, Tâm thức, Tâm thái, Nghị lực, Thể chất và Tinh thần; mái ghi Tài chính, viền mái ghi Cảnh giới cuộc sống và Giá trị – Di sản; tường ghi Nội tâm, Sức khỏe và Mối quan hệ"
              width={1696}
              height={1472}
              loading="lazy"
            />
            <figcaption className="house-caption gold-title">VISFAR HOME</figcaption>
          </figure>
          <p className="house-legend">
            <b>Đọc đồ hình:</b>{' '}
            {HOUSE_LEGEND.replace(
              'Đọc đồ hình: ',
              '',
            )}
          </p>
          <div className="lamps">
            {FACETS.map((f) => (
              <article key={f.num} className="lamp">
                <p className="lamp-num gold-title">
                  {f.num}. {f.name}
                </p>
                <p>{f.desc}</p>
              </article>
            ))}
          </div>
          <div className="triangle-diagram">
            <p className="triangle-sub">Tam giác hiện thực 8 lớp</p>
            <TriangleDiagram />
            <p className="triangle-caption gold-title">TAM GIÁC HIỆN THỰC</p>
          </div>
        </div>

        <section id="lo-trinh" aria-labelledby="roadmapTitle">
          <Chapter>Lộ trình phát triển</Chapter>
          <p className="kicker">Đi theo thứ tự nào</p>
          <h2 className="title gold-title" id="roadmapTitle">
            Lộ trình 6 bước: Biết - Tin - Hiểu - Thấu Suốt - Chuyển Hóa - Huân tập &amp; Quảng bá
          </h2>
          <p className="lead">
            Mỗi bước chuẩn bị cho bước sau. Nhìn lại hình trong đầu: điều mong muốn đã rõ tới mức
            kể lại được như đang thấy nó chưa?
          </p>
          <div className="steps">
            {ROADMAP_STEPS.map((s) => (
              <article key={s.n} className="step reveal">
                <h3>
                  <span className="n gold-title">{s.n}</span>
                  <span className="step-name">{s.name}</span>
                  {s.sub ? <span className="step-sub">{s.sub}</span> : null}
                </h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>

          <div className="phil-block reveal">
            <h3>
              <span className="phil-num">4.</span> MỤC TIÊU GIÁO DỤC
            </h3>
            <p>VISFAR hướng đến sự phát triển con người trên bốn phương diện:</p>
            <ul className="phil-list">
              {GOALS.map((g) => (
                <li key={g.label}>
                  <strong>{g.label}:</strong> {g.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="phil-block reveal">
            <h3>
              <span className="phil-num">5.</span> NGUYÊN TẮC GIÁO DỤC
            </h3>
            <p>VISFAR đề cao những nguyên tắc:</p>
            <ul className="phil-list">
              {PRINCIPLES.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>

          <div className="phil-block reveal">
            <h3>
              <span className="phil-num">6.</span> ĐÍCH ĐẾN GIÁO DỤC
            </h3>
            {DESTINATION.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          <div className="phil-manifesto reveal">
            <p className="chapter">TUYÊN NGÔN TRIẾT LÝ</p>
            <p className="phil-decl">
              <span className="phil-decl-line1a">KHAI MỞ TÂM THỨC • TU DƯỠNG ĐẠO ĐỨC</span>
              <span className="phil-decl-line1b">PHÁT TRIỂN TRÍ TUỆ • HOÀN THIỆN CON NGƯỜI</span>
              <span className="phil-decl-line2">KIẾN TẠO THỊNH VƯỢNG</span>
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}

export function FieldsSection() {
  return (
    <section id="linh-vuc" aria-labelledby="fieldsTitle">
      <div className="wrap">
        <SecHead
          chapter="Lĩnh vực ứng dụng"
          kicker="Cùng một gốc, sáu cách ứng dụng"
          title="Một khung chung, sáu lĩnh vực của đời sống"
          titleId="fieldsTitle"
          lead="Mỗi lĩnh vực một bộ khái niệm riêng, chung một khung. Thấu một lĩnh vực, các lĩnh vực khác sáng theo."
        />
        <div className="fields">
          {FIELDS.map((f) => (
            <article key={f.num} className="field-card reveal">
              <p className="field-num">Lĩnh vực {f.num}</p>
              <h3>{f.title}</h3>
              {f.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
              <p className="hint-line">{f.app}</p>
            </article>
          ))}
        </div>
        <p className="section-cta">
          <a className="btn btn-gold" href="#chuong-trinh">
            Tìm hiểu các chương trình →
          </a>
        </p>
      </div>
    </section>
  );
}

export function CoursesSection() {
  return (
    <section id="chuong-trinh" className="cream" aria-labelledby="coursesTitle">
      <div className="wrap">
        <SecHead
          title="MƯỜI CHƯƠNG TRÌNH – MỘT HÀNH TRÌNH PHÁT TRIỂN"
          titleId="coursesTitle"
          lead="Từ thấu hiểu bản thân đến phát triển trí tuệ, kiến tạo nhân hiệu và làm chủ cuộc sống. VISFAR thiết kế hệ thống chương trình theo từng cấp độ, giúp mỗi người lựa chọn điểm bắt đầu và từng bước phát triển theo năng lực, mục tiêu của mình."
        />
        <CourseExplorer />
      </div>
    </section>
  );
}

export function BusinessSection() {
  return (
    <section id="doanh-nghiep" className="cream" aria-labelledby="bizTitle">
      <div className="wrap">
        <SecHead
          chapter="Giải pháp doanh nghiệp"
          title="Khi đội ngũ cùng nhìn một hướng, văn hóa tự thành hình"
          titleId="bizTitle"
          lead="Doanh nghiệp bền không chỉ cần quy trình tốt — cần con người tốt: lãnh đạo sáng suốt, đội ngũ cùng gốc nhận thức, uy tín xây từ trong ra ngoài. Có nhận thức mới quản trị được, quản trị được mới đào tạo được, đào tạo được mới lãnh đạo được."
        />
        <figure className="biz-figure reveal">
          <Image
            src="/images/biz-group.jpg"
            alt="Cộng đồng Visfar Academy"
            width={1600}
            height={900}
            loading="lazy"
          />
        </figure>
        <div className="biz">
          {BIZ_CARDS.map((b) => (
            <article key={b.title} className="reveal">
              <h3>{b.title}</h3>
              <p>{b.desc}</p>
              <p className="who">{b.who}</p>
            </article>
          ))}
        </div>
        <p className="section-cta">
          <a className="btn btn-gold" href="#tu-van">
            Trao đổi giải pháp doanh nghiệp
          </a>
        </p>
      </div>
    </section>
  );
}
export function TestimonialsSection() {
  return (
    <section id="chia-se" aria-labelledby="voicesTitle">
      <div className="wrap">
        <SecHead
          chapter="Trải nghiệm học viên"
          kicker="Lời của những người đã đi cùng"
          title="Học viên nói bằng trải nghiệm của họ"
          titleId="voicesTitle"
          lead="Tám lời chia sẻ đăng nguyên văn, với sự đồng ý của từng học viên."
        />
        <div className="testimonial-grid">
          {TESTIMONIALS.map((t) => (
            <article key={t.name} className="voice-card reveal">
              <figure className="voice-head">
                <Image src={t.img} alt={`Chân dung ${t.name}`} width={150} height={150} loading="lazy" />
                <figcaption>
                  <p className="voice-name">{t.name}</p>
                  <p className="voice-role">{t.role}</p>
                </figcaption>
              </figure>
              <blockquote>
                <p>“{t.quote}</p>
              </blockquote>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BlogSection() {
  return (
    <section id="blog" className="cream" aria-labelledby="blogTitle">
      <div className="wrap">
        <SecHead
          chapter="Bài viết và tài nguyên"
          kicker="Đọc trước, cảm trước"
          title="Ba bài viết ngắn, cho sự thay đổi thật"
          titleId="blogTitle"
          lead="Mỗi bài đi thẳng vào khái niệm, hình trong đầu, trạng thái trong lòng."
        />
        <div className="blog-grid">
          {BLOG_POSTS.map((b) => (
            <article key={b.title} className="reveal">
              <p className="blog-pillar">{b.pillar}</p>
              <h3>
                <Link href={`/blog/${b.slug}`}>{b.title}</Link>
              </h3>
              <p>{b.body}</p>
              <p className="meta">{b.meta}</p>
            </article>
          ))}
        </div>
        <p>
          <Link href="/blog">Xem tất cả bài viết →</Link>
        </p>
        <ul className="resource-list">
          <li>
            <Link href="/tu-van?course=thau-hieu-noi-tam">
              <strong>Thấu Hiểu Nội Tâm</strong>
              <span>Miễn phí · Bắt đầu tại đây →</span>
            </Link>
          </li>
          <li>
            <Link href="/#triet-ly">
              <strong>Giải nghĩa thuật ngữ</strong>
              <span>Khái niệm nguồn, tam giác hiện thực, huân tập →</span>
            </Link>
          </li>
          <li>
            <Link href="/#faq">
              <strong>Câu hỏi thường gặp</strong>
              <span>Triết lý, chương trình, doanh nghiệp →</span>
            </Link>
          </li>
        </ul>

        <div id="su-kien">
          <Chapter>Gặp gỡ trực tiếp</Chapter>
          <p className="kicker">Sự kiện</p>
          <h2 className="title gold-title" id="eventsTitle">
            Lịch sự kiện sắp diễn ra
          </h2>
          <p className="lead">Ngày, địa điểm, tên chương trình đã xác nhận sẽ công bố tại đây.</p>
          <p className="lead">Live training, workshop và buổi hỏi đáp hàng tháng cùng founder.</p>
          <div className="event-cards">
            {HOME_EVENTS.map((e) => (
              <article key={e.title} className="event-card reveal">
                <Image src={e.img} alt={e.alt} width={1200} height={750} loading="lazy" />
                <p className="ev-tag">{e.tag}</p>
                <h3 className="ev-title">{e.title}</h3>
                <p className="ev-date">{e.date}</p>
                <p className="ev-meta">{e.meta}</p>
                <p>
                  <Link className="btn btn-ghost" href="/#tu-van">
                    Xem chi tiết
                  </Link>
                </p>
              </article>
            ))}
            <article className="event-card event-more reveal">
              <h3>Lịch sự kiện đang được cập nhật</h3>
              <p>Không công bố lịch khi chưa xác nhận. Mỗi lần gặp gỡ là một lần gặp thật.</p>
              <p>
                <Link className="btn btn-gold" href="/#tu-van">
                  Kết nối cùng Visfar →
                </Link>
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faqTitle">
      <div className="wrap">
        <SecHead
          chapter="Hỏi đáp"
          kicker="Giải đáp nhanh"
          title="Câu hỏi thường gặp"
          titleId="faqTitle"
          lead="Bấm vào từng câu hỏi để mở câu trả lời. Câu chưa có ở đây, hỏi trong buổi tư vấn."
        />
        <div className="faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <div className="ans">
                <p>{f.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function UpdatingSection() {
  return (
    <section id="dang-cap-nhat" aria-labelledby="updatingTitle">
      <div className="wrap">
        <SecHead
          chapter="Đang hoàn thiện"
          title="Những phần đang được chuẩn bị"
          titleId="updatingTitle"
          lead="Các phần dưới đây đang cập nhật. Trang này không công bố tên, học vị, thành tích, đối tác, chứng nhận hay ngày tháng nào khi chưa xác nhận. Muốn trao đổi trước, đăng ký tư vấn — Visfar Academy sẽ liên hệ lại."
        />
        <div className="update-grid">
          {UPDATE_CARDS.map((c) => (
            <article key={c.title} className="update-card reveal">
              <h3>{c.title}</h3>
              <p>
                <strong>Đang cập nhật.</strong>
              </p>
              <p>{c.body}</p>
            </article>
          ))}
        </div>
        <p className="muted">
          Chưa có cổng đăng nhập riêng trên trang này: khu vực học viên là cộng đồng và lời chia
          sẻ của học viên tại phần <a href="#chia-se">Học viên</a>. Đăng ký tư vấn vẫn qua form
          tại phần <a href="#tu-van">Kết nối</a>.
        </p>
      </div>
    </section>
  );
}

export function ConsultSection() {
  return (
    <section id="tu-van" className="form-section cream" aria-labelledby="formTitle">
      <div className="wrap">
        <div className="form-grid">
          <div>
            <p className="chapter">Đăng ký và kết nối</p>
            <h2 className="title gold-title" id="formTitle">
              Đăng ký tham gia
            </h2>
            <p className="lead">
              Để lại thông tin, Visfar Academy liên hệ, cùng tìm điểm bắt đầu phù hợp: từ Biết tới
              Chuyển hóa, theo thứ tự Tâm thức, Trí tuệ, Nhân hiệu. Năm ô thông tin.
            </p>
            <p className="contact-lines">
              <a href="tel:+84347897868">
                <b>Điện thoại</b> 034 7897 868
              </a>{' '}
              ·{' '}
              <a href="mailto:visfaracademy@gmail.com">
                <b>Email</b> visfaracademy@gmail.com
              </a>
            </p>
            <p>
              Nói thẳng: không có đường tắt thay cho huân tập từ gốc. Visfar cho khung, phương
              pháp, sự đồng hành. Đổi hay không, ở việc rõ khái niệm, rõ hình, giữ trạng thái trong
              lòng đều đặn.
            </p>
          </div>
          <Suspense fallback={<p role="status">Đang tải form đăng ký…</p>}>
            <ConsultationForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
