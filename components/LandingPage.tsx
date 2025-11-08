
import React from 'react';
import { ArrowRightIcon, BrainIcon, DocumentTextIcon, LockClosedIcon, ShieldCheckIcon } from '../constants';

interface LandingPageProps {
  onEnter: () => void;
}

const BrainItem: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-background-med border border-border-color rounded-lg p-6">
    <h3 className="font-mono text-primary text-lg font-bold mb-2">{title}</h3>
    <p className="text-text-med">{children}</p>
  </div>
);

const FeatureItem: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-background-med border border-border-color rounded-xl p-8 transform transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20">
    <div className="mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-text-light mb-2">{title}</h3>
    <p className="text-text-med">{children}</p>
  </div>
);

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  return (
    <div className="min-h-screen bg-background-dark flex flex-col items-center p-4 sm:p-8 animate-fadeIn">
      <main className="w-full max-w-4xl mx-auto">
        <header className="text-center py-16 sm:py-24">
          <h1 className="font-mono text-4xl sm:text-5xl font-bold text-text-light mb-4">
            VERUM <span className="text-primary">OMNIS</span>
          </h1>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-text-light sm:text-5xl mb-6">
            A Forensic Expert Witness in Your Pocket.
          </h2>
          <p className="text-lg text-text-med max-w-2xl mx-auto">
            Verum Omnis is a stateless, constitutional AI that analyzes evidence with uncompromising integrity, producing sealed, court-ready reports.
          </p>
        </header>

        <section className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-light">9-Brain Architecture</h2>
            <p className="text-text-med mt-4 max-w-2xl mx-auto">
              A zero-trust architecture where multiple specialized AI "brains" analyze evidence in parallel. A conclusion is only reached if at least three brains concur.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BrainItem title="Contradiction Engine">Cross-checks statements and evidence to find logical, temporal, and factual inconsistencies.</BrainItem>
            <BrainItem title="Behavioral Linguistics">Analyzes language for hedging, evasion, aggression, and other indicators of deception.</BrainItem>
            <BrainItem title="Doc/Image Forensics">Scans file integrity, metadata, and pixel patterns for signs of tampering or generation by other AI.</BrainItem>
            <BrainItem title="Legal Compliance">Maps findings to specific jurisdictional legal packs (e.g., UAE, SA, EU) to identify statutory violations.</BrainItem>
          </div>
        </section>

        <section className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-light">Court-Ready by Design</h2>
             <p className="text-text-med mt-4 max-w-2xl mx-auto">
              Every output is designed for legal admissibility and forensic integrity from the ground up.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FeatureItem icon={<ShieldCheckIcon />} title="Immutable Constitution">The AI operates under a fixed, unalterable set of rules that prioritize truth and determinism.</FeatureItem>
            <FeatureItem icon={<DocumentTextIcon />} title="SHA-512 Integrity Lock">Every piece of evidence is hashed, creating a tamper-evident chain of custody included in the final report.</FeatureItem>
            <FeatureItem icon={<LockClosedIcon />} title="Stateless & Private">The AI never trains on your data or "phones home." Each analysis is a sealed, independent event.</FeatureItem>
            <FeatureItem icon={<BrainIcon />} title="Explainable AI">Every conclusion is delivered with a clear chain-of-proof, outlining the trigger, source, and rationale for B1-B8 brains.</FeatureItem>
          </div>
        </section>
        
        <footer className="text-center py-16 sm:py-24">
           <div className="max-w-xl mx-auto bg-gradient-to-br from-background-med to-transparent border border-primary/50 rounded-2xl p-8 mb-12">
                <h3 className="text-2xl font-bold text-success mb-2">A Gift to Humanity</h3>
                <p className="text-text-med">This tool is provided free of charge, without tracking, and without storing your data. It is a sealed, offline-capable instrument for truth.</p>
           </div>
          <p className="text-2xl font-semibold text-text-light mb-8">Your evidence has a voice. Let it be heard.</p>
          <button
            onClick={onEnter}
            className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-primary to-blue-400 rounded-full shadow-lg shadow-primary/30 transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-primary/50"
          >
            Enter Application
            <span className="ml-3 transform transition-transform duration-300 group-hover:translate-x-2">
                <ArrowRightIcon />
            </span>
          </button>
        </footer>
      </main>
    </div>
  );
};

export default LandingPage;
