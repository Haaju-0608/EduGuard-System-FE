import React, { useEffect, useState } from 'react';
import { setupScrollReveal } from '../../utils/helpers';
import Navbar from '../../components/layout/Navbar';
import HeroSection from './sections/HeroSection';
import FeaturesSection from './sections/FeaturesSection';
import StudentFeatureSection from './sections/StudentFeatureSection';
import AdminFeatureSection from './sections/AdminFeatureSection';
import HowItWorksSection from './sections/HowItWorksSection';
import RolesSection from './sections/RolesSection';
import PricingSection from './sections/PricingSection';
import StudentSection from './sections/StudentSection';
import CTABanner from './sections/CTABanner';
import Footer from './sections/Footer';
import ContactModal from './ContactModal';

export default function LandingPage() {
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    const cleanup = setupScrollReveal();
    return cleanup;
  }, []);

  return (
    <>
      <Navbar onContactClick={() => setContactOpen(true)} />
      <HeroSection onContactClick={() => setContactOpen(true)} />
      <FeaturesSection />
      <StudentFeatureSection />
      <AdminFeatureSection />
      <HowItWorksSection />
      <RolesSection />
      <PricingSection onContactClick={() => setContactOpen(true)} />
      <StudentSection />
      <CTABanner onContactClick={() => setContactOpen(true)} />
      <Footer />
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
    </>
  );
}
