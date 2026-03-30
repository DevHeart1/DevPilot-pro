import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Folder, GitBranch } from "lucide-react";
import { GitLabProjectSummary } from "../../types";

interface NavControlChipProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    accent?: boolean;
    onClick?: () => void;
    disabled?: boolean;
}

const NavControlChip = ({
    icon: Icon,
    label,
    value,
    accent = false,
    onClick,
    disabled = false,
}: NavControlChipProps) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={[
            "group flex min-w-[140px] items-center justify-between gap-3 rounded-xl border px-3 py-1.5 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60",
            accent
                ? "border-primary/20 bg-primary/10 hover:border-primary/[0.35] hover:bg-primary/[0.14]"
                : "border-white/[0.06] bg-black/40 hover:border-white/[0.12] hover:bg-white/[0.07]",
        ].join(" ")}
    >
        <span className="flex min-w-0 items-center gap-2.5">
            <span
                className={[
                    "flex size-6 shrink-0 items-center justify-center rounded-lg transition-colors",
                    accent
                        ? "bg-primary/[0.14] text-primary"
                        : "bg-white/5 text-slate-400 group-hover:text-slate-200",
                ].join(" ")}
            >
                <Icon className="h-3 w-3" />
            </span>
            <span className="min-w-0 text-left">
                <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {label}
                </span>
                <span
                    className={[
                        "block truncate text-xs font-semibold",
                        accent ? "text-orange-50" : "text-slate-100",
                    ].join(" ")}
                >
                    {value}
                </span>
            </span>
        </span>
        <ChevronDown
            className={[
                "h-3.5 w-3.5 shrink-0 transition-colors",
                accent ? "text-primary/80" : "text-slate-600 group-hover:text-slate-400",
            ].join(" ")}
        />
    </button>
);

export interface ProjectContextNavProps {
    projectLabel: string;
    projectPath?: string;
    branches: string[];
    selectedBranch: string;
    onBranchChange: (branch: string) => void;
    disabled?: boolean;
    availableProjects?: GitLabProjectSummary[];
    onProjectChange?: (projectId: string | number) => void;
}

export const ProjectContextNav: React.FC<ProjectContextNavProps> = ({
    projectLabel,
    projectPath,
    branches,
    selectedBranch,
    onBranchChange,
    disabled = false,
    availableProjects = [],
    onProjectChange,
}) => {
    const [isBranchOpen, setIsBranchOpen] = useState(false);
    const [isProjectOpen, setIsProjectOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsBranchOpen(false);
                setIsProjectOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="flex items-center gap-2" ref={containerRef}>
            <div className="relative">
                <NavControlChip
                    icon={Folder}
                    label="Repository"
                    value={projectPath || projectLabel}
                    onClick={() => {
                        if (disabled || availableProjects.length === 0) return;
                        setIsProjectOpen((current) => !current);
                        setIsBranchOpen(false);
                    }}
                    disabled={disabled || availableProjects.length === 0}
                    accent={isProjectOpen}
                />

                {isProjectOpen && availableProjects.length > 0 && (
                    <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl border border-white/[0.08] bg-[#151515] p-2 shadow-2xl">
                        <div className="mb-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Select Project
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {availableProjects.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${p.pathWithNamespace === projectPath
                                            ? "bg-primary/10 text-primary font-semibold"
                                            : "text-slate-300 hover:bg-white/[0.06]"
                                        }`}
                                    onClick={() => {
                                        onProjectChange?.(p.id);
                                        setIsProjectOpen(false);
                                    }}
                                >
                                    <div className="truncate font-medium">{p.name}</div>
                                    <div className="truncate text-[10px] text-slate-500">{p.pathWithNamespace}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="relative">
                <NavControlChip
                    icon={GitBranch}
                    label="Branch"
                    value={selectedBranch || "No branch"}
                    onClick={() => {
                        if (disabled || branches.length === 0) return;
                        setIsBranchOpen((current) => !current);
                        setIsProjectOpen(false);
                    }}
                    disabled={disabled || branches.length === 0}
                    accent={isBranchOpen}
                />

                {isBranchOpen && branches.length > 0 && (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-xl border border-white/[0.08] bg-[#151515] p-2 shadow-2xl">
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {branches.map((branch) => (
                                <button
                                    key={branch}
                                    type="button"
                                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${branch === selectedBranch
                                            ? "bg-primary/10 text-primary"
                                            : "text-slate-300 hover:bg-white/[0.06]"
                                        }`}
                                    onClick={() => {
                                        onBranchChange(branch);
                                        setIsBranchOpen(false);
                                    }}
                                >
                                    {branch}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
