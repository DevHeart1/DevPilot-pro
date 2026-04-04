import React from "react";
import { Task } from "../../types";

const tabConfig: Array<{ id: Task["category"]; label: string }> = [
  { id: "tasks", label: "Tasks" },
  { id: "code_reviews", label: "Code Reviews" },
  { id: "archive", label: "Archive" },
];

interface TabsProps {
  activeTab: Task["category"];
  onTabChange: (tab: Task["category"]) => void;
}

export const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange }) => (
  <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-border-subtle bg-surface/20 p-2">
    {tabConfig.map((tab) => (
      <button
        key={tab.id}
        type="button"
        onClick={() => onTabChange(tab.id)}
        className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === tab.id
            ? "bg-primary/10 text-primary"
            : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
