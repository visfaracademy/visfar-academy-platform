// Trang chu Visfar Academy — chuyen tu file HTML goc
// (workspace/user/files/Visfar_Academy.html, chot 10/11/2026).
// Du 13 section dung thu tu DOM goc: #lo-trinh long trong #triet-ly,
// #su-kien la <div> trong #blog. Giu <h1> that (Visfar Academy, dang
// chapter o hero) va luong form Worker API (xem ConsultationForm).
import { FloatingButtons, RevealInit } from '@/components/home/HomeClient';
import { faqJsonLd } from '@/lib/seo';
import {
  BlogSection,
  BusinessSection,
  ConsultSection,
  CoursesSection,
  FaqSection,
  FieldsSection,
  FounderSection,
  HeroSection,
  JourneyNav,
  MissionSection,
  PhilosophySection,
  TestimonialsSection,
  UpdatingSection,
} from '@/components/home/HomeSections';

export default function HomePage() {
  return (
    <>
      {/* JSON-LD FAQPage: 9 cau FAQ that tren trang chu, nguyen van. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
      <RevealInit />
      <HeroSection />
      <JourneyNav />
      <MissionSection />
      <FounderSection />
      <PhilosophySection />
      <FieldsSection />
      <CoursesSection />
      <BusinessSection />
      <TestimonialsSection />
      <BlogSection />
      <FaqSection />
      <UpdatingSection />
      <ConsultSection />
      <FloatingButtons />
    </>
  );
}
