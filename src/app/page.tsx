'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  FileText,
  MapPin,
  Users,
  Activity,
  ArrowRight,
  Heart,
  Sparkles,
  BarChart3,
  Shield,
} from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Ingest Field Data',
    description: 'Paste messy field notes, upload reports, or load survey data. AI structures everything.',
    color: '#D4622B',
  },
  {
    icon: Sparkles,
    title: 'AI Extraction & Scoring',
    description: 'Gemini identifies issues, urgency signals, and affected populations from unstructured text.',
    color: '#F4A261',
  },
  {
    icon: MapPin,
    title: 'Locality Prioritization',
    description: 'Transparent urgency scores rank communities by need. See heatmaps and reasoning.',
    color: '#EA580C',
  },
  {
    icon: Users,
    title: 'Smart Team Matching',
    description: 'AI recommends the best staff based on skills, availability, language, and distance.',
    color: '#2D6A4F',
  },
  {
    icon: Activity,
    title: 'Camp-Day Operations',
    description: 'Real-time patient flow: registration → triage → consultation → pharmacy → follow-up.',
    color: '#D97706',
  },
  {
    icon: BarChart3,
    title: 'Impact Reports',
    description: 'Auto-generated camp summaries, medicine usage, unresolved cases, and follow-up plans.',
    color: '#65A30D',
  },
];

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-[#E5E2DC]/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4622B] to-[#F4A261] flex items-center justify-center">
              <Heart className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-[#1A1A1A]">
              SevaSetu<span className="text-[#D4622B]"> AI</span>
            </span>
          </div>
          <Link href="/auth">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn-primary text-sm px-5 py-2.5"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </motion.button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] as const }}
          className="max-w-4xl mx-auto text-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-pale border border-[#D4622B]/20 text-[#D4622B] text-sm font-medium mb-6"
          >
            <Shield className="w-3.5 h-3.5" />
            Google Solution Challenge 2026
          </motion.div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-[#1A1A1A] leading-tight tracking-tight">
            Turn scattered NGO data into
            <span className="block mt-2 bg-gradient-to-r from-[#D4622B] via-[#E87A40] to-[#F4A261] bg-clip-text text-transparent">
              intelligent action
            </span>
          </h1>

          <p className="mt-6 text-lg text-[#6B7280] max-w-2xl mx-auto leading-relaxed">
            SevaSetu AI transforms messy field reports into clear local need signals
            and intelligently matches the right volunteers to the right tasks and locations.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/auth">
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="btn-primary text-base px-8 py-3.5"
              >
                Start Coordinating <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn-outline text-base px-8 py-3.5"
            >
              Watch Demo
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Problem → Solution */}
      <section className="py-20 px-6 bg-white border-y border-[#E5E2DC]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 gap-12"
          >
            <motion.div variants={fadeUp}>
              <span className="text-xs font-bold uppercase tracking-widest text-urgency-high">The Problem</span>
              <h2 className="text-3xl font-bold text-[#1A1A1A] mt-3">
                Resources exist. Visibility doesn&apos;t.
              </h2>
              <p className="mt-4 text-[#6B7280] leading-relaxed">
                NGOs running community health camps receive field data from scattered surveys,
                notes, spreadsheets, and prior reports. Without aggregation and analysis,
                the most urgent communities are underserved while available volunteers
                are misallocated.
              </p>
            </motion.div>

            <motion.div variants={fadeUp}>
              <span className="text-xs font-bold uppercase tracking-widest text-secondary">The Solution</span>
              <h2 className="text-3xl font-bold text-[#1A1A1A] mt-3">
                AI-powered coordination.
              </h2>
              <p className="mt-4 text-[#6B7280] leading-relaxed">
                SevaSetu AI ingests messy reports, uses Gemini to structure and classify needs,
                scores localities by urgency with transparent reasoning, recommends optimal
                staff assignments, and powers real-time camp-day operations.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-[#1A1A1A]">
              End-to-end intelligence workflow
            </h2>
            <p className="mt-3 text-[#6B7280] max-w-xl mx-auto">
              From raw field data to post-camp impact reports — every step is AI-assisted.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.08)' }}
                className="card cursor-default"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${feature.color}15` }}
                >
                  <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
                </div>
                <h3 className="text-lg font-semibold text-[#1A1A1A]">{feature.title}</h3>
                <p className="mt-2 text-sm text-[#6B7280] leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center p-12 rounded-3xl"
          style={{
            background: 'linear-gradient(135deg, #1B2E25 0%, #2D6A4F 100%)',
          }}
        >
          <h2 className="text-3xl font-bold text-white">
            Ready to coordinate smarter?
          </h2>
          <p className="mt-4 text-white/70 max-w-lg mx-auto">
            Set up your NGO&apos;s operations hub in minutes. Ingest data, prioritize needs,
            and deploy the right team to the right place.
          </p>
          <Link href="/auth">
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="mt-8 btn text-base px-8 py-3.5 bg-gradient-to-r from-[#D4622B] to-[#F4A261] text-white shadow-lg"
            >
              Get Started Free <ArrowRight className="w-5 h-5" />
            </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E5E2DC] py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-[#6B7280]">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-[#D4622B]" />
            <span>SevaSetu AI — Google Solution Challenge 2026</span>
          </div>
          <span>Built with ❤️ for social impact</span>
        </div>
      </footer>
    </div>
  );
}
