'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ChevronRight, PlayCircle } from 'lucide-react';

interface TourStep {
  id: string;
  title: string;
  content: string;
  targetId?: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to SevaSetu AI',
    content: 'This guided tour will show you how to manage health camps using AI intelligence. Let\'s get started!',
    position: 'bottom'
  },
  {
    id: 'priorities',
    title: 'Intelligence: Priority Ranking',
    content: 'SevaSetu AI analyzes field reports to rank localities by urgency using a hybrid deterministic-AI scoring model.',
    targetId: 'priority-localities',
    position: 'right'
  },
  {
    id: 'planning',
    title: 'Planning: Smart Staffing',
    content: 'Use the Planner to Pick a locality and get AI-powered volunteer recommendations based on role fit and language.',
    targetId: 'next-camp',
    position: 'left'
  },
  {
    id: 'ops',
    title: 'Operations: Real-time Flow',
    content: 'Track patient flow on camp day with a real-time Kanban board to ensure no patient is left waiting.',
    targetId: 'active-camp',
    position: 'top'
  }
];

export default function DemoTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Tour only auto-launches when explicitly opted-in via `?tour=1`.
    // Prevents the floating modal from hijacking a live judge demo.
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tour') === '1') {
      setIsActive(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setIsActive(false);
    localStorage.setItem('sevasetu_tour_seen', 'true');
  };

  if (!isActive) return (
    <button 
      onClick={() => { setIsActive(true); setCurrentStep(0); }}
      className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-[#E5E2DC] shadow-lg hover:shadow-xl hover:border-[#D4622B]/30 transition-all text-sm font-semibold text-[#1A1A1A] z-40"
    >
      <PlayCircle className="w-4 h-4 text-[#D4622B]" />
      Watch Demo Tour
    </button>
  );

  const step = TOUR_STEPS[currentStep];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Overlay with Spotlight */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto"
          onClick={handleComplete}
        />

        {/* Modal */}
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 pointer-events-auto relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
              <button onClick={handleComplete} className="text-[#6B7280] hover:text-[#1A1A1A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary-pale flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#D4622B]" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#D4622B] uppercase tracking-widest">Demo Tour</p>
                <h3 className="font-bold text-[#1A1A1A]">{step.title}</h3>
              </div>
            </div>

            <p className="text-[#6B7280] text-sm leading-relaxed mb-8">
              {step.content}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all ${i === currentStep ? 'w-6 bg-[#D4622B]' : 'w-1.5 bg-[#E5E2DC]'}`} 
                  />
                ))}
              </div>
              <button 
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4622B] text-white text-sm font-bold shadow-lg shadow-[#D4622B]/20 hover:bg-[#B44C1D] transition-colors"
              >
                {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next Step'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
