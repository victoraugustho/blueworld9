import { HeroSection } from "@/components/hero-section"
import { AboutHomeSection } from "@/components/about-home-section"
import { SolutionsSection } from "@/components/solutions-section"
import { BenefitsSection } from "@/components/benefits-section"
import { ProjectsSection } from "@/components/projects-section"
import { ContactSection } from "@/components/contact-section"
import { Footer } from "@/components/footer"
import { SectionDivider } from "@/components/section-divider"

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <AboutHomeSection />
      <SectionDivider variant="dots" />
      <SolutionsSection />
      <SectionDivider variant="gradient" />
      <BenefitsSection />
      <SectionDivider variant="dots" />
      <ProjectsSection />
      <SectionDivider variant="default" />
      <ContactSection />
      <Footer />
    </main>
  )
}
