import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const TYPING_PHRASES = [
  "Navigate 50,000 fans effortlessly.",
  "Zero waiting. Maximum fun.",
  "Your AI stadium companion is here."
];

const Landing: React.FC = () => {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % TYPING_PHRASES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <div className="w-full relative overflow-x-hidden bg-bg-primary pb-10">
      {/* ── Hero Section ── */}
      <section aria-label="Hero - VenueFlow AI crowd management platform" className="relative min-h-screen flex flex-col justify-center overflow-hidden animate-gradient bg-gradient-to-br from-[#0a0a0f] via-[#111318] to-indigo-900/20">
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10 text-center flex flex-col items-center pt-20">
          <motion.div initial="hidden" animate="show" variants={fadeInUp}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-glass-bg border border-border mb-8 shadow-glow-indigo">
              <span className="live-dot"></span>
              <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Live Demo Available</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.2] mb-6 min-h-[120px]">
              <AnimatePresence mode="wait">
                 <motion.span
                   key={phraseIndex}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   transition={{ duration: 0.4 }}
                   className="text-gradient-primary inline-block"
                 >
                   {TYPING_PHRASES[phraseIndex]}
                 </motion.span>
                 <span className="typing-cursor"></span>
              </AnimatePresence>
            </h1>
            
            <div className="flex flex-col sm:flex-row justify-center gap-6 mt-8">
              <Link to="/login" className="btn-primary hover-lift text-lg px-10 py-4 shadow-glow-indigo">
                Fan Login
              </Link>
              <Link to="/login" className="btn-danger hover-lift text-lg px-10 py-4 shadow-glow-red bg-gradient-to-r from-orange-500 to-amber-500">
                Manager Login
              </Link>
            </div>
          </motion.div>

          {/* Floating animated stats bar */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="flex flex-wrap justify-center items-center gap-4 md:gap-8 mt-20 glass-card p-6 border-accent/20"
          >
             <div className="flex items-center gap-2 text-text-primary font-bold whitespace-nowrap"><span className="text-warning">★</span> 34 min avg wait time saved</div>
             <div className="flex items-center gap-2 text-text-primary font-bold whitespace-nowrap"><span className="text-warning">★</span> 50,000+ fans guided per match</div>
             <div className="flex items-center gap-2 text-text-primary font-bold whitespace-nowrap"><span className="text-warning">★</span> 3 AI agents running 24/7</div>
             <div className="flex items-center gap-2 text-text-primary font-bold whitespace-nowrap"><span className="text-warning">★</span> 99.9% system uptime</div>
          </motion.div>
        </div>
      </section>

      {/* ── Problem vs Solution Section ── */}
      <section aria-label="Problem vs Solution comparison" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div initial="hidden" whileInView="show" viewport={{ once:true }} variants={fadeInUp} className="card p-10 bg-danger/10 border-danger/30 hover-lift">
              <h3 className="text-3xl font-bold text-danger mb-6">The Old Way</h3>
              <ul className="space-y-6 text-xl">
                <li className="flex items-center gap-4"><span className="text-2xl">❌</span> 45 min gate queues</li>
                <li className="flex items-center gap-4"><span className="text-2xl">❌</span> No food court info</li>
                <li className="flex items-center gap-4"><span className="text-2xl">❌</span> Panic during emergencies</li>
                <li className="flex items-center gap-4"><span className="text-2xl">❌</span> Zero real-time guidance</li>
              </ul>
            </motion.div>

            <motion.div initial="hidden" whileInView="show" viewport={{ once:true }} variants={fadeInUp} className="card p-10 bg-success/10 border-success/30 hover-lift">
              <h3 className="text-3xl font-bold text-success mb-6">VenueFlow Way</h3>
              <ul className="space-y-6 text-xl">
                <li className="flex items-center gap-4"><span className="text-2xl border bg-success rounded-full flex items-center justify-center w-8 h-8 text-white p-1">✓</span> 2 min smart gate entry</li>
                <li className="flex items-center gap-4"><span className="text-2xl border bg-success rounded-full flex items-center justify-center w-8 h-8 text-white p-1">✓</span> Live food court wait times</li>
                <li className="flex items-center gap-4"><span className="text-2xl border bg-success rounded-full flex items-center justify-center w-8 h-8 text-white p-1">✓</span> AI emergency coordination</li>
                <li className="flex items-center gap-4"><span className="text-2xl border bg-success rounded-full flex items-center justify-center w-8 h-8 text-white p-1">✓</span> Personalized fan assistant</li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Features Showcase ── */}
      <section aria-label="Platform features" className="py-24 bg-bg-secondary border-y border-border">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold mb-16">Platform <span className="text-gradient-primary">Features</span></h2>
            <div className="grid md:grid-cols-3 gap-8">
              <motion.div className="card p-8 hover-lift" initial="hidden" whileInView="show" variants={fadeInUp} viewport={{ once:true }}>
                 <div className="w-16 h-16 mx-auto mb-6 bg-accent/20 rounded-2xl flex items-center justify-center animate-bounce text-3xl">💬</div>
                 <h3 className="text-2xl font-bold mb-4">FlowBot AI</h3>
                 <p className="text-text-secondary">A highly contextual chat interface guiding fans directly to their seats with real-time updates.</p>
              </motion.div>
              <motion.div className="card p-8 hover-lift" initial="hidden" whileInView="show" variants={fadeInUp} viewport={{ once:true }}>
                 <div className="w-16 h-16 mx-auto mb-6 bg-success/20 rounded-2xl flex items-center justify-center">
                   <div className="live-dot scale-150"></div>
                 </div>
                 <h3 className="text-2xl font-bold mb-4">Digital Twin Map</h3>
                 <p className="text-text-secondary">Fully mapped live SVG nodes allowing managers to identify chokepoints before they become issues.</p>
              </motion.div>
              <motion.div className="card p-8 hover-lift shadow-[0_0_20px_rgba(239,68,68,0.2)] border-danger/30" initial="hidden" whileInView="show" variants={fadeInUp} viewport={{ once:true }}>
                 <div className="w-16 h-16 mx-auto mb-6 bg-danger/20 rounded-2xl flex items-center justify-center animate-pulse text-3xl">🚨</div>
                 <h3 className="text-2xl font-bold text-danger mb-4">God Mode Control</h3>
                 <p className="text-text-secondary">One button locks down the stadium mapping evacuation paths and dispatching PA announcements.</p>
              </motion.div>
            </div>
         </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24">
         <div className="max-w-7xl mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold mb-16 text-gradient-primary">How It Works</h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-12">
               <motion.div initial="hidden" whileInView="show" variants={fadeInUp} viewport={{ once:true }} className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-bg-secondary border-2 border-accent flex items-center justify-center text-4xl mb-4">📱</div>
                  <h3 className="font-bold text-xl">1. Scan Ticket QR</h3>
               </motion.div>
               <div className="hidden md:block text-text-secondary text-2xl font-bold">→</div>
               <motion.div initial="hidden" whileInView="show" variants={fadeInUp} viewport={{ once:true }} className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-bg-secondary border-2 border-accent2 flex items-center justify-center text-4xl mb-4">🤖</div>
                  <h3 className="font-bold text-xl">2. Get Live AI Guidance</h3>
               </motion.div>
               <div className="hidden md:block text-text-secondary text-2xl font-bold">→</div>
               <motion.div initial="hidden" whileInView="show" variants={fadeInUp} viewport={{ once:true }} className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-bg-secondary border-2 border-success flex items-center justify-center text-4xl mb-4">🏟️</div>
                  <h3 className="font-bold text-xl">3. Enjoy the Match</h3>
               </motion.div>
            </div>
         </div>
      </section>

      {/* ── Live STATS TICKER ── */}
      <div role="marquee" aria-label="Live venue statistics ticker" aria-live="polite" className="fixed bottom-0 left-0 right-0 bg-accent/10 border-t border-accent/20 text-accent-light font-mono font-bold text-sm py-2 z-50 overflow-hidden backdrop-blur-md">
        <div className="animate-marquee px-4">
          <span className="mx-8">Gate B: 3m wait</span> • 
          <span className="mx-8">Food Court East: <span className="text-success">LOW</span></span> • 
          <span className="mx-8">North Stand: 67% full</span> • 
          <span className="mx-8">Halftime in: 12 min</span> •
          <span className="mx-8">Gate B: 3m wait</span> • 
          <span className="mx-8">Food Court East: <span className="text-success">LOW</span></span> • 
          <span className="mx-8">North Stand: 67% full</span> • 
          <span className="mx-8">Halftime in: 12 min</span>
        </div>
      </div>
    </div>
  );
};

export default Landing;
