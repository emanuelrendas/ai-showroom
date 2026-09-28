"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, FolderClosed, LayoutGrid, LogOut, Menu, PanelLeftOpen, X } from "lucide-react";
import { signOutAction } from "@/features/auth/actions";
import type { Workspace } from "@/features/workspaces/types";
import { Button } from "@/components/ui/button";

type WorkspaceShellProps = {
  workspace: Workspace;
  displayName: string;
  projects: { id: string; name: string }[];
  children: React.ReactNode;
};

export function WorkspaceShell({ workspace, displayName, projects, children }: WorkspaceShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const overviewHref = `/w/${workspace.slug}`;

  useEffect(() => {
    if (mobileOpen) closeRef.current?.focus();
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuRef.current?.focus();
      }
      if (event.key === "Tab") {
        const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  function closeMobile() {
    setMobileOpen(false);
    menuRef.current?.focus();
  }

  function navigation(isMobile: boolean) {
    const compact = !isMobile && collapsed;
    return (
      <>
        <div className={`flex items-center justify-between gap-2 border-b border-border py-5 ${compact ? "flex-col px-2" : "px-4"}`}>
          <Link href="/app" aria-label={`AI SHOWROOM, ${workspace.name}, all workspaces`} className="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-ring" onClick={isMobile ? closeMobile : undefined}>
            {compact ? <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-xs font-bold tracking-tight text-primary">AI</span> : <span className="block truncate text-[11px] font-semibold tracking-[0.22em] text-primary">AI SHOWROOM</span>}
            <span className={`mt-1 block truncate text-sm font-semibold text-foreground ${compact ? "sr-only" : ""}`}>{workspace.name}</span>
          </Link>
          {isMobile ? (
            <button ref={closeRef} type="button" aria-label="Close navigation" onClick={closeMobile} className="rounded-lg p-2 text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"><X size={18} /></button>
          ) : (
            <button type="button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)} className="rounded-lg p-2 text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
              {collapsed ? <PanelLeftOpen size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}
        </div>
        <nav aria-label={isMobile ? "Mobile workspace navigation" : "Workspace navigation"} className="flex-1 overflow-y-auto px-3 py-6">
          <p className={`px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground ${compact ? "sr-only" : ""}`}>Workspace</p>
          <Link href={overviewHref} aria-current={pathname === overviewHref ? "page" : undefined} title="Overview" onClick={isMobile ? closeMobile : undefined} className={`mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-[var(--motion-nav)] focus-visible:outline-2 focus-visible:outline-ring ${pathname === overviewHref ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
            <LayoutGrid size={17} aria-hidden="true" /><span className={compact ? "sr-only" : ""}>Overview</span>
          </Link>
          <p className={`mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground ${compact ? "sr-only" : ""}`}>Projects</p>
          <div className="mt-3 space-y-1">
            {projects.map((project) => {
              const href = `${overviewHref}/projects/${project.id}`;
              const isCurrent = pathname === href;
              const isWithin = pathname.startsWith(`${href}/`);
              return (
                <Link key={project.id} href={href} aria-current={isCurrent ? "page" : isWithin ? "location" : undefined} title={project.name} onClick={isMobile ? closeMobile : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-[var(--motion-nav)] focus-visible:outline-2 focus-visible:outline-ring ${isCurrent || isWithin ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                  <FolderClosed size={17} aria-hidden="true" /><span className={`truncate ${compact ? "sr-only" : ""}`}>{project.name}</span>
                </Link>
              );
            })}
            {projects.length === 0 && <p className={`px-3 py-2 text-xs text-muted-foreground ${compact ? "sr-only" : ""}`}>No projects yet</p>}
          </div>
        </nav>
        <div className="border-t border-border p-3">
          <p className={`mb-2 truncate px-3 text-xs text-muted-foreground ${compact ? "sr-only" : ""}`}>{displayName}</p>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" title="Sign out" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
              <LogOut size={17} aria-hidden="true" /><span className={compact ? "sr-only" : ""}>Sign out</span>
            </Button>
          </form>
        </div>
      </>
    );
  }

  return (
    <div data-testid="workspace-shell" data-collapsed={collapsed} className="flex min-h-screen bg-background text-foreground">
      <aside className={`hidden shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-[var(--motion-sidebar)] ease-out md:flex ${collapsed ? "w-[76px]" : "w-[252px]"}`}>
        {navigation(false)}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center gap-3 border-b border-border px-4 md:hidden">
          <button ref={menuRef} type="button" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="mobile-workspace-navigation" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring"><Menu size={20} /></button>
          <span className="text-xs font-semibold tracking-[0.16em] text-primary">AI SHOWROOM</span>
          <span className="min-w-0 truncate border-l border-border pl-3 text-sm text-muted-foreground">{workspace.name}</span>
        </header>
        <main className="mx-auto min-w-0 max-w-[1500px] px-4 py-7 sm:px-6 md:px-8 md:py-9 lg:px-10">{children}</main>
      </div>
      <div className={`fixed inset-0 z-40 md:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!mobileOpen}>
        <button type="button" tabIndex={mobileOpen ? 0 : -1} aria-label="Close navigation backdrop" onClick={closeMobile} className={`absolute inset-0 bg-black/65 transition-opacity duration-[var(--motion-drawer-open)] ${mobileOpen ? "opacity-100" : "opacity-0"}`} />
        <div id="mobile-workspace-navigation" ref={drawerRef} role="dialog" aria-label="Navigation" data-open={mobileOpen} aria-modal={mobileOpen ? "true" : undefined} inert={!mobileOpen} className={`relative flex h-full w-[min(86vw,320px)] flex-col border-r border-border bg-sidebar shadow-2xl transition-transform ${mobileOpen ? "translate-x-0 duration-[var(--motion-drawer-open)]" : "-translate-x-full duration-[var(--motion-drawer-close)]"}`}>
          {navigation(true)}
        </div>
      </div>
    </div>
  );
}
