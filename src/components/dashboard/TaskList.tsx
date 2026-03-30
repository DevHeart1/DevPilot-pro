import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { taskService } from "../../lib/services";
import { Task } from "../../types";
import { CodeReviewIssueList } from "./CodeReviewIssueList";

interface TaskItemProps {
    id: string;
    title: string;
    status: string;
    time: string;
    branch: string;
    additions: number;
    deletions: number;
    onClick?: () => void;
}

const TaskItem: React.FC<TaskItemProps> = ({
    title,
    status,
    time,
    branch,
    additions,
    deletions,
    onClick,
}) => {
    let statusClasses = "";
    if (status === "MERGED") {
        statusClasses = "border-purple-500/20 bg-purple-500/10 text-purple-400";
    } else if (status === "RUNNING") {
        statusClasses = "border-primary/20 bg-primary/10 text-primary";
    } else if (status === "CLOSED") {
        statusClasses = "border-slate-500/20 bg-slate-500/10 text-slate-400";
    }

    return (
        <div
            onClick={onClick}
            className="relative flex cursor-pointer flex-col justify-between border-t border-border-subtle p-4 transition-all duration-200 first:border-t-0 hover:z-10 hover:scale-[1.01] hover:bg-surface-dark/50 hover:shadow-lg md:flex-row md:items-center sm:p-5"
        >
            <div className="flex flex-col gap-1.5">
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
                    <span className="line-clamp-2 break-words text-sm font-medium text-slate-100 transition-colors group-hover:text-primary md:line-clamp-1">
                        {title}
                    </span>
                    <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${statusClasses}`}
                    >
                        {status}
                    </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        {time}
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">fork_right</span>
                        {branch}
                    </span>
                </div>
            </div>
            <div className="mt-4 flex items-center gap-4 md:mt-0">
                <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="font-bold text-emerald-500">+{additions}</span>
                    <span className="font-bold text-rose-500">-{deletions}</span>
                </div>
                <span className="material-symbols-outlined text-slate-600 transition-colors group-hover:text-slate-300">
                    chevron_right
                </span>
            </div>
        </div>
    );
};

const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(timestamp);
};

const getTaskGroup = (timestamp: number) => {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    return days <= 7 ? "Last 7 Days" : "Older";
};

interface TaskListProps {
    onSelectTask: (id: string) => void;
    activeTab: Task["category"];
    onSelectCodeReviewIssue?: (id: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ onSelectTask, activeTab, onSelectCodeReviewIssue }) => {
    if (activeTab === "code_reviews" && onSelectCodeReviewIssue) {
        return <CodeReviewIssueList onSelectIssue={onSelectCodeReviewIssue} />;
    }

    const [searchQuery, setSearchQuery] = useState("");
    const dbTasks = useLiveQuery(() => taskService.getTasksByCategory(activeTab), [activeTab]);

    const allTasks = (dbTasks || []).map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status.toUpperCase(),
        time: formatTimeAgo(task.createdAt),
        branch: `${task.repo}/${task.branch}`,
        additions: task.plusCount,
        deletions: task.minusCount,
        group: getTaskGroup(task.createdAt),
    }));

    const filteredTasks = allTasks.filter(
        (task) =>
            task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.branch.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    const recentTasks = filteredTasks.filter((task) => task.group === "Last 7 Days");
    const olderTasks = filteredTasks.filter((task) => task.group === "Older");

    return (
        <div className="space-y-8">
            <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    search
                </span>
                <input
                    type="text"
                    placeholder="Filter tasks by title or branch..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-surface/30 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
            </div>

            <div className="space-y-12">
                {recentTasks.length > 0 && (
                    <div>
                        <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                            Last 7 Days
                        </h3>
                        <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface/30">
                            {recentTasks.map((task) => (
                                <TaskItem key={task.id} {...task} onClick={() => onSelectTask(task.id)} />
                            ))}
                        </div>
                    </div>
                )}

                {olderTasks.length > 0 && (
                    <div>
                        <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                            Older
                        </h3>
                        <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface/30">
                            {olderTasks.map((task) => (
                                <TaskItem key={task.id} {...task} onClick={() => onSelectTask(task.id)} />
                            ))}
                        </div>
                    </div>
                )}

                {filteredTasks.length === 0 && (
                    <div className="rounded-2xl border border-border-subtle bg-surface/20 px-6 py-12 text-center text-slate-500">
                        {searchQuery
                            ? `No tasks found matching "${searchQuery}".`
                            : "No live tasks yet. Submit a prompt above to create the first run."}
                    </div>
                )}
            </div>
        </div>
    );
};
