import React from 'react';

interface ReleaseEntry {
  version: string;
  date: string;
  isLatest?: boolean;
  sections: {
    title: string;
    items: string[];
    color: string;
  }[];
  icon: string;
}

const releases: ReleaseEntry[] = [
  {
    version: "v2.6.0",
    date: "March 25, 2026",
    isLatest: true,
    icon: "published_with_changes",
    sections: [
      {
        title: "Agentic Workflows",
        color: "bg-emerald-500",
        items: [
          "Introduced Pre-Computation Planning & Security Audit approval gate",
          "Added proactive Agentic Security Audits and Compliance Checks prior to generative code modifications",
          "Implemented Conversational Follow-up workflows to contextually refine AI execution plans",
          "Migrated DevPilot Sandbox to a stable Node.js headless Playwright architecture"
        ]
      },
      {
        title: "Dashboard UI",
        color: "bg-rose-500",
        items: [
          "Built a beautifully styled interactive modal to review implementation plans and security findings",
          "Added the RunStepsProgress component to visually track and animate the active lifecycle of AI operations"
        ]
      }
    ]
  },
  {
    version: "v2.5.5",
    date: "March 23, 2026",
    icon: "shield",
    sections: [
      {
        title: "Infrastructure",
        color: "bg-emerald-500",
        items: [
          "Resolved Sandbox CORS Policy block using dynamic origin matching for Vercel",
          "Fixed Vercel build failure by correcting service barrel exports and Rollup config",
          "Enhanced Cloud Run middleware for robust preflight (OPTIONS) handling",
          "Implemented global error boundaries to prevent uninitialized state crashes"
        ]
      },
      {
        title: "Dashboard UI",
        color: "bg-blue-500",
        items: [
          "Repositioned 'Go' button to the far right edge for a more professional dashboard layout",
          "Fixed visual clipping issues in the Hero Composer shell using optimized padding",
          "Resolved Dashboard runtime TypeError related to uninitialized state during project loading"
        ]
      }
    ]
  },
  {
    version: "v2.5.0",
    date: "March 23, 2026",
    icon: "rocket_launch",
    sections: [
      {
        title: "Enterprise Readiness",
        color: "bg-purple-500",
        items: [
          "Major App.tsx refactor: decomposed 65KB file into modular hooks and components",
          "Introduced Zod-based runtime configuration validation for environment variables",
          "Established testing foundation with Vitest and initial smoke test suite",
          "Added professional CONTRIBUTING.md and security standard documentation"
        ]
      },
      {
        title: "Frontend Core",
        color: "bg-emerald-500",
        items: [
          "Introduced useTaskHub hook for centralized state and GitLab orchestration",
          "Implemented dynamic repository and branch configuration for GitLab integration",
          "Fixed repository selection dropdown clipping and responsiveness issues"
        ]
      }
    ]
  },
  {
    version: "v2.4.5",
    date: "March 19, 2026",
    icon: "account_tree",
    sections: [
      {
        title: "Duo Orchestration",
        color: "bg-blue-500",
        items: [
          "Integrated GitLab Duo agent mapping for custom workflow orchestration",
          "Implemented DashboardHeroComposer with advanced command input processing",
          "Added webhook event routing for automated repository state management",
          "Verification preparation workflow for standardized GitLab handoffs"
        ]
      }
    ]
  },
  {
    version: "v2.0.0",
    date: "March 10, 2026",
    icon: "grid_view",
    sections: [
      {
        title: "Next-Gen Dashboard",
        color: "bg-rose-500",
        items: [
          "Complete UI overhaul with glassmorphism and high-performance animations",
          "Introduced real-time browser preview pane with interactive analysis",
          "Advanced Chat Input with multi-project support and autocompletion",
          "Dexie-based local persistence layer for ultra-fast offline access"
        ]
      }
    ]
  },
  {
    version: "v1.5.0",
    date: "February 25, 2026",
    icon: "visibility",
    sections: [
      {
        title: "Vision Engine",
        color: "bg-cyan-500",
        items: [
          "Initial integration with Browserbase for secure, remote UI inspection",
          "Gemini 1.5 Pro vision analysis for automated UI defect detection",
          "Multi-viewport testing support (Desktop, Tablet, Mobile)",
          "Automated patch proposal generation from visual diagnostics"
        ]
      }
    ]
  },
  {
    version: "v1.0.0",
    date: "February 1, 2026",
    icon: "foundation",
    sections: [
      {
        title: "The Foundation",
        color: "bg-slate-500",
        items: [
          "Initial architecture for DevPilot AI Agent hub",
          "Core engine for GitLab API integration and PR management",
          "Basic terminal and agent intelligence interfaces",
          "Cloud Run Sandbox foundation for isolated code execution"
        ]
      }
    ]
  }
];

export const Changelog = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="min-h-screen bg-background-dark text-slate-100 font-display">
      <header className="flex items-center px-6 py-4 border-b border-border-subtle bg-background-dark/50 sticky top-0 z-50 backdrop-blur-md">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="font-medium">Back to Dashboard</span>
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Changelog</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            The evolution of DevPilot — from initial foundation to enterprise-grade AI orchestration.
          </p>
        </div>

        <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border-subtle/50 before:to-transparent">
          {releases.map((release, index) => (
            <div
              key={release.version}
              className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${release.isLatest ? 'is-active' : ''}`}
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border ${release.isLatest ? 'border-primary bg-surface-dark text-primary shadow-[0_0_15px_rgba(244,140,37,0.3)]' : 'border-border-subtle bg-surface-dark text-slate-500 shadow'} shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-transform group-hover:scale-110`}>
                <span className="material-symbols-outlined text-sm">{release.icon}</span>
              </div>

              <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-2xl border ${release.isLatest ? 'border-primary/20 bg-surface/40' : 'border-border-subtle bg-surface/20'} shadow-xl backdrop-blur-sm hover:border-slate-600 transition-all duration-300`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-xl text-white">{release.version}</h3>
                  {release.isLatest && (
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider border border-primary/20">
                      Latest
                    </span>
                  )}
                </div>
                <time className="block text-xs font-medium text-slate-500 mb-4">{release.date}</time>

                <div className="space-y-6">
                  {release.sections.map((section) => (
                    <div key={section.title}>
                      <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2 uppercase tracking-wide">
                        <span className={`w-1.5 h-1.5 rounded-full ${section.color}`}></span>
                        {section.title}
                      </h4>
                      <ul className="list-none text-sm text-slate-400 space-y-2 ml-1">
                        {section.items.map((item, i) => (
                          <li key={i} className="flex gap-2 leading-relaxed">
                            <span className="text-slate-600 font-mono text-[10px] mt-1 shrink-0">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
