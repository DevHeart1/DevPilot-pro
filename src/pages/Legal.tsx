import React from 'react';

export const Legal = ({ title, lastUpdated, content, onBack }: { title: string, lastUpdated: string, content: React.ReactNode, onBack: () => void }) => {
  return (
    <div className="min-h-screen bg-background-dark text-slate-100 font-display">
      <header className="flex items-center px-6 py-4 border-b border-border-subtle bg-background-dark/50 sticky top-0 z-50">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="font-medium">Back to Dashboard</span>
        </button>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">{title}</h1>
        <p className="text-sm text-primary font-medium mb-12">Last updated: {lastUpdated}</p>
        <div className="prose prose-invert prose-primary max-w-none prose-p:text-slate-400 prose-p:leading-relaxed prose-headings:text-slate-200 prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80 prose-li:text-slate-400">
          {content}
        </div>
      </div>
    </div>
  );
};

export const PrivacyPolicyContent = (
  <>
    <h2>1. Introduction</h2>
    <p>At DevPilot, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our automated development platform.</p>
    
    <h2>2. Information We Collect</h2>
    <p>We may collect information about you in a variety of ways. The information we may collect via the Platform includes:</p>
    <ul>
      <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, shipping address, email address, and telephone number.</li>
      <li><strong>Derivative Data:</strong> Information our servers automatically collect when you access the Platform, such as your IP address, your browser type, your operating system, your access times, and the pages you have viewed directly before and after accessing the Platform.</li>
      <li><strong>Code Repository Data:</strong> To provide our services, we require access to your code repositories. We only access the repositories you explicitly authorize.</li>
    </ul>

    <h2>3. Use of Your Information</h2>
    <p>Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Platform to:</p>
    <ul>
      <li>Create and manage your account.</li>
      <li>Analyze your codebase to provide automated development suggestions.</li>
      <li>Email you regarding your account or order.</li>
      <li>Fulfill and manage purchases, orders, payments, and other transactions related to the Platform.</li>
    </ul>

    <h2>4. Disclosure of Your Information</h2>
    <p>We may share information we have collected about you in certain situations. Your information may be disclosed as follows:</p>
    <p><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.</p>
  </>
);

export const TermsOfServiceContent = (
  <>
    <h2>1. Agreement to Terms</h2>
    <p>These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and DevPilot ("we," "us" or "our"), concerning your access to and use of the DevPilot platform.</p>
    
    <h2>2. Intellectual Property Rights</h2>
    <p>Unless otherwise indicated, the Platform is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Platform (collectively, the "Content") and the trademarks, service marks, and logos contained therein (the "Marks") are owned or controlled by us or licensed to us.</p>
    <p>You retain all intellectual property rights to the code in your repositories. DevPilot claims no ownership over your proprietary code.</p>

    <h2>3. User Representations</h2>
    <p>By using the Platform, you represent and warrant that:</p>
    <ul>
      <li>All registration information you submit will be true, accurate, current, and complete.</li>
      <li>You will maintain the accuracy of such information and promptly update such registration information as necessary.</li>
      <li>You have the legal capacity and you agree to comply with these Terms of Service.</li>
      <li>You will not access the Platform through automated or non-human means, whether through a bot, script, or otherwise, except as explicitly permitted by our API documentation.</li>
    </ul>

    <h2>4. Prohibited Activities</h2>
    <p>You may not access or use the Platform for any purpose other than that for which we make the Platform available. The Platform may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.</p>
  </>
);
