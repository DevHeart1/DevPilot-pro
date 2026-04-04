import React from "react";

import { Link } from "react-router-dom";
import { ProjectContextNav, ProjectContextNavProps } from "./ProjectContextNav";
import { AuthSessionSnapshot, ConnectedIntegration } from "../../types";

interface HeaderProps extends Partial<ProjectContextNavProps> {
    authSession?: AuthSessionSnapshot;
    connectedIntegrations?: ConnectedIntegration[];
    pendingApprovalCount?: number;
}

export const Header: React.FC<HeaderProps> = (props) => (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border-subtle bg-background-dark/50 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
        <Link
            to="/"
            className="flex cursor-pointer items-center gap-3"
        >
            <div className="flex size-8 items-center justify-center rounded bg-primary text-black">
                <span className="material-symbols-outlined text-[20px] font-bold">
                    bolt
                </span>
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-100">
                DevPilot
            </h2>
        </Link>
        <div className="flex items-center gap-4">
            {props.projectLabel && (
                <div className="hidden lg:block mr-2">
                    <ProjectContextNav {...(props as ProjectContextNavProps)} />
                </div>
            )}
            <div className="hidden xl:flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                <span className={`inline-flex h-2 w-2 rounded-full ${props.authSession?.auth0.tokenVaultReady ? "bg-emerald-400" : props.authSession?.isFallback ? "bg-amber-400" : "bg-slate-500"}`} />
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
                    <span>{props.authSession?.auth0.tokenVaultReady ? "Secure runtime ready" : props.authSession?.isFallback ? "Fallback-secure runtime" : props.authSession?.status === "authenticated" ? (props.authSession.user?.name || "Authenticated") : "Secure runtime"}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-500">
                        {(props.connectedIntegrations || []).filter((integration) => integration.status === "connected").length} tools
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-500">{props.pendingApprovalCount || 0} approval gates</span>
                </div>
            </div>
            <div className="mr-6 hidden items-center gap-6 md:flex">
                <Link
                    to="/documentation"
                    className="text-sm font-medium text-slate-500 transition-colors hover:text-primary"
                >
                    Documentation
                </Link>
                <Link
                    to="/changelog"
                    className="text-sm font-medium text-slate-500 transition-colors hover:text-primary"
                >
                    Changelog
                </Link>
            </div>
            <button className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5">
                <span className="material-symbols-outlined">notifications</span>
            </button>
            <Link
                to="/settings"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 flex items-center justify-center"
            >
                <span className="material-symbols-outlined">settings</span>
            </Link>
            <Link
                to="/settings"
                className="h-8 w-8 cursor-pointer rounded-full border border-white/10 bg-gradient-to-tr from-primary to-orange-200 block"
            />
        </div>
    </header >
);
