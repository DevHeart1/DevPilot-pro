import React, { useState } from 'react';

export const Support = ({ onBack }: { onBack: () => void }) => {
  const [isSubmitted, setIsSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-background-dark text-slate-100 font-display">
      <header className="flex items-center px-6 py-4 border-b border-border-subtle bg-background-dark/50 sticky top-0 z-50">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="font-medium">Back to Dashboard</span>
        </button>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-16">
        <div className="animate-in fade-in slide-in-from-left-8 duration-700">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Get Support</h1>
          <p className="text-lg text-slate-400 mb-12 leading-relaxed">Need help with DevPilot? We're here for you. Fill out the form and our team will get back to you within 24 hours.</p>

          <div className="space-y-8">
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">
                <span className="material-symbols-outlined text-xl">mail</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">Email Us</h3>
                <p className="text-sm text-slate-400 mb-2">For general inquiries and technical support.</p>
                <a href="mailto:support@devpilot.ai" className="text-primary font-medium hover:underline">support@devpilot.ai</a>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0 mt-1">
                <span className="material-symbols-outlined text-xl">forum</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">Community Forum</h3>
                <p className="text-sm text-slate-400 mb-2">Join our Discord server to chat with other developers.</p>
                <button className="text-blue-500 font-medium hover:underline">Join Discord</button>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0 mt-1">
                <span className="material-symbols-outlined text-xl">menu_book</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">Documentation</h3>
                <p className="text-sm text-slate-400 mb-2">Find answers quickly in our comprehensive guides.</p>
                <button className="text-emerald-500 font-medium hover:underline">Read the Docs</button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface/30 border border-border-subtle p-8 rounded-3xl shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-right-8 duration-700">
          {isSubmitted ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Message Sent!</h3>
              <p className="text-slate-400 mb-8 leading-relaxed">We've received your request and will be in touch shortly. Check your email for a confirmation.</p>
              <button onClick={() => setIsSubmitted(false)} className="px-6 py-2.5 bg-surface-dark border border-border-subtle rounded-lg text-sm font-medium hover:bg-white/5 transition-colors">Send another message</button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setIsSubmitted(true); }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">First Name</label>
                  <input id="first-name" name="firstName" required type="text" className="w-full bg-surface-dark border border-border-subtle rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all" placeholder="Jane" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Last Name</label>
                  <input id="last-name" name="lastName" required type="text" className="w-full bg-surface-dark border border-border-subtle rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all" placeholder="Doe" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                <input id="email" name="email" required type="email" className="w-full bg-surface-dark border border-border-subtle rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all" placeholder="jane@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
                <select id="subject" name="subject" className="w-full bg-surface-dark border border-border-subtle rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all appearance-none">
                  <option>Technical Issue</option>
                  <option>Billing Question</option>
                  <option>Feature Request</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">How can we help?</label>
                <textarea id="message" name="message" required rows={5} className="w-full bg-surface-dark border border-border-subtle rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all resize-none" placeholder="Please describe your issue in detail..."></textarea>
              </div>
              <button type="submit" className="w-full py-3.5 bg-primary text-background-dark font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 text-base">Send Message</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
