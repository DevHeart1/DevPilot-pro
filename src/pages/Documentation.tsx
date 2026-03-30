import React, { useState } from 'react';

export const Documentation = ({ onBack }: { onBack: () => void }) => {
  const [activeTab, setActiveTab] = useState('getting-started');
  
  return (
    <div className="min-h-screen bg-background-dark text-slate-100 font-display">
      <header className="flex items-center px-6 py-4 border-b border-border-subtle bg-background-dark/50 sticky top-0 z-50">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="font-medium">Back to Dashboard</span>
        </button>
      </header>
      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-12">
        <aside className="w-full md:w-64 shrink-0">
          <h2 className="text-2xl font-bold text-white mb-6">Documentation</h2>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('getting-started')} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${activeTab === 'getting-started' ? 'bg-primary/10 text-primary font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>Getting Started</button>
            <button onClick={() => setActiveTab('architecture')} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${activeTab === 'architecture' ? 'bg-primary/10 text-primary font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>Architecture</button>
            <button onClick={() => setActiveTab('api')} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${activeTab === 'api' ? 'bg-primary/10 text-primary font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>API Reference</button>
            <button onClick={() => setActiveTab('webhooks')} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${activeTab === 'webhooks' ? 'bg-primary/10 text-primary font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>Webhooks</button>
          </nav>
        </aside>
        <main className="flex-1 max-w-3xl">
          {activeTab === 'getting-started' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-bold text-white">Getting Started</h1>
              <p className="text-slate-400 leading-relaxed text-lg">Welcome to DevPilot. This guide will help you set up your automated development environment and run your first task.</p>
              
              <div className="mt-12 space-y-8">
                <section>
                  <h2 className="text-xl font-semibold text-white mb-4">1. Installation</h2>
                  <p className="text-slate-400 mb-4">Install the DevPilot CLI globally using npm:</p>
                  <div className="bg-[#1c140c] p-4 rounded-xl border border-border-subtle font-mono text-sm text-primary/90 flex items-center justify-between group">
                    <span>npm install -g devpilot-cli</span>
                    <button className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><span className="material-symbols-outlined text-sm">content_copy</span></button>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-white mb-4">2. Authentication</h2>
                  <p className="text-slate-400 mb-4">Run the login command to authenticate with your GitHub account and link your repositories:</p>
                  <div className="bg-[#1c140c] p-4 rounded-xl border border-border-subtle font-mono text-sm text-primary/90 flex items-center justify-between group">
                    <span>devpilot login</span>
                    <button className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><span className="material-symbols-outlined text-sm">content_copy</span></button>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-white mb-4">3. Initialize a Project</h2>
                  <p className="text-slate-400 mb-4">Navigate to your project directory and initialize DevPilot:</p>
                  <div className="bg-[#1c140c] p-4 rounded-xl border border-border-subtle font-mono text-sm text-primary/90 flex items-center justify-between group">
                    <span>devpilot init</span>
                    <button className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><span className="material-symbols-outlined text-sm">content_copy</span></button>
                  </div>
                  <p className="text-sm text-slate-500 mt-3 italic">This will create a .devpilot directory with your configuration files.</p>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-bold text-white">Architecture</h1>
              <p className="text-slate-400 leading-relaxed text-lg">Understand how DevPilot interacts with your codebase and executes tasks securely.</p>
              
              <div className="mt-8 p-8 border border-border-subtle rounded-2xl bg-surface/30 flex flex-col items-center justify-center gap-6">
                <div className="flex items-center gap-4 text-slate-400">
                  <div className="p-4 bg-surface-dark rounded-xl border border-border-subtle flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-3xl text-primary">terminal</span>
                    <span className="text-xs font-bold">CLI</span>
                  </div>
                  <span className="material-symbols-outlined">arrow_forward</span>
                  <div className="p-4 bg-surface-dark rounded-xl border border-border-subtle flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-3xl text-emerald-500">cloud</span>
                    <span className="text-xs font-bold">Cloud Engine</span>
                  </div>
                  <span className="material-symbols-outlined">arrow_forward</span>
                  <div className="p-4 bg-surface-dark rounded-xl border border-border-subtle flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-3xl text-blue-500">code</span>
                    <span className="text-xs font-bold">Repository</span>
                  </div>
                </div>
                <p className="text-sm text-slate-500 text-center max-w-md">DevPilot uses a secure cloud engine to analyze your codebase and propose changes via Pull Requests.</p>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-bold text-white">API Reference</h1>
              <p className="text-slate-400 leading-relaxed text-lg">Integrate DevPilot directly into your CI/CD pipelines using our REST API.</p>
              
              <div className="mt-8 space-y-6">
                <div className="border border-border-subtle rounded-xl overflow-hidden">
                  <div className="bg-surface-dark px-4 py-3 border-b border-border-subtle flex items-center gap-3">
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-500 text-[10px] font-bold rounded uppercase tracking-wider">POST</span>
                    <code className="text-sm text-slate-300 font-mono">/v1/tasks/create</code>
                  </div>
                  <div className="p-4 bg-surface/30">
                    <p className="text-sm text-slate-400 mb-4">Creates a new automation task.</p>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Request Body</h4>
                    <pre className="bg-[#1c140c] p-4 rounded-lg text-xs text-slate-300 font-mono overflow-x-auto border border-border-subtle">
{`{
  "repository": "user/repo",
  "branch": "main",
  "prompt": "Fix the navigation overflow on mobile screens"
}`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-bold text-white">Webhooks</h1>
              <p className="text-slate-400 leading-relaxed text-lg">Listen for events on your DevPilot account so your integration can automatically trigger reactions.</p>
              <div className="mt-8 p-6 border border-border-subtle rounded-xl bg-surface/30">
                <h3 className="text-lg font-medium text-white mb-2">Supported Events</h3>
                <ul className="space-y-3 mt-4">
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                    <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">task.created</code> - Triggered when a new task is queued.
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <code className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">task.completed</code> - Triggered when a task successfully generates a PR.
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <code className="text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">task.failed</code> - Triggered when a task encounters an error.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
