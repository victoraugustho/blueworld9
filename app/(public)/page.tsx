import dynamic from "next/dynamic"
import { HeroSection } from "@/components/hero-section"
import { AboutHomeSection } from "@/components/about-home-section"
import { SolutionsSection } from "@/components/solutions-section"
import { BenefitsSection } from "@/components/benefits-section"
import { Footer } from "@/components/footer"
import { SectionDivider } from "@/components/section-divider"

const SchoolsSectionUnits = dynamic(
  () => import("@/components/schools-section-units").then((mod) => mod.SchoolsSectionUnits),
  {
    loading: () => <SectionPlaceholder id="unidades" />,
  },
)

const ContactSection = dynamic(
  () => import("@/components/contact-section").then((mod) => mod.ContactSection),
  {
    loading: () => <SectionPlaceholder id="contato" />,
  },
)

function SectionPlaceholder({ id }: { id: string }) {
  return (
    <section id={id} className="relative py-20 md:py-32 cv-auto">
      <div className="container mx-auto px-6">
        <div className="h-40 rounded-2xl bg-white/5 border border-white/10 backdrop-blur animate-pulse" />
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <AboutHomeSection />
      <SectionDivider variant="gradient" />
      <SchoolsSectionUnits />
      <SectionDivider variant="default" />
      <SolutionsSection />
      <SectionDivider variant="gradient" />
      <BenefitsSection />
      <SectionDivider variant="default" />
      <ContactSection />
      <Footer />
    </main>
  )
}
