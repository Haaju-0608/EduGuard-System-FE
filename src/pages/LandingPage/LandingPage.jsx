import { useEffect } from 'react'
import { setupScrollReveal } from '../../utils/helpers'
import Navbar from '../../components/layout/Navbar'
import HeroSection from './sections/HeroSection'
import StatsBanner from './sections/StatsBanner'
import FeaturesSection from './sections/FeaturesSection'
import StudentFeatureSection from './sections/StudentFeatureSection'
import AdminFeatureSection from './sections/AdminFeatureSection'
import HowItWorksSection from './sections/HowItWorksSection'
import RolesSection from './sections/RolesSection'
import PricingSection from './sections/PricingSection'
import StudentSection from './sections/StudentSection'
import CTABanner from './sections/CTABanner'
import Footer from './sections/Footer'

export default function LandingPage() {
  useEffect(() => {
    const cleanup = setupScrollReveal()
    return cleanup
  }, [])

  return (
    <>
      <Navbar />
      <HeroSection />
      <StatsBanner />
      <FeaturesSection />
      <StudentFeatureSection />
      <AdminFeatureSection />
      <HowItWorksSection />
      <RolesSection />
      <PricingSection />
      <StudentSection />
      <CTABanner />
      <Footer />
    </>
  )
}
