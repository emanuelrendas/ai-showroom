"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, FolderClosed, LayoutGrid, LogOut, Menu, X } from "lucide-react";
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
  const collapseRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const overviewHref = `/w/${workspace.slug}`;

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    let returnTarget = menuRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function close() {
      setMobileOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
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
    function containFocus(event: FocusEvent) {
      if (!drawerRef.current?.contains(event.target as Node)) closeRef.current?.focus();
    }
    function onResize() {
      if (window.innerWidth >= 768) {
        returnTarget = collapseRef.current;
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", containFocus);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", containFocus);
      window.removeEventListener("resize", onResize);
      // React has removed inert by cleanup; focus never waits on motion.
      returnTarget?.focus();
    };
  }, [mobileOpen]);

  function closeMobile() {
    setMobileOpen(false);
  }

  function navigation(isMobile: boolean) {
    return (
      <>
        <div className="shell-identity">
          <Link href="/app" aria-label={`AI SHOWROOM, ${workspace.name}, all workspaces`} className="flex min-w-0 items-center gap-3 rounded-lg" onClick={isMobile ? closeMobile : undefined}>
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-xs font-semibold tracking-tight text-primary">AI</span>
            <span className="shell-label min-w-0">
              <span className="block text-[10px] font-semibold tracking-[0.18em] text-text-secondary">AI SHOWROOM</span>
              <span className="mt-1 block truncate text-sm font-medium">{workspace.name}</span>
            </span>
          </Link>
          {isMobile && <button ref={closeRef} type="button" aria-label="Close navigation" onClick={closeMobile} className="shell-icon-button absolute right-2 top-5"><X size={18} /></button>}
        </div>
        {!isMobile && (
          <button ref={collapseRef} type="button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)} className="shell-collapse shell-nav-link">
            <ChevronLeft size={18} aria-hidden="true" className={`shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            <span className="shell-label">Collapse navigation</span>
          </button>
        )}
        <nav aria-label={isMobile ? "Mobile workspace navigation" : "Workspace navigation"} className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-5">
          <p className="shell-label mb-3 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-text-secondary">Workspace</p>
          <Link href={overviewHref} aria-label="Overview" aria-current={pathname === overviewHref ? "page" : undefined} title="Overview" onClick={isMobile ? closeMobile : undefined} className="shell-nav-link">
            <LayoutGrid size={18} aria-hidden="true" /><span className="shell-label">Overview</span>
          </Link>
          <p className="shell-label mb-3 mt-7 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-text-secondary">Projects</p>
          <div className="space-y-1">
            {projects.map((project) => {
              const href = `${overviewHref}/projects/${project.id}`;
              return (
                <Link key={project.id} href={href} aria-label={project.name} aria-current={pathname === href ? "page" : pathname.startsWith(`${href}/`) ? "location" : undefined} title={project.name} onClick={isMobile ? closeMobile : undefined} className="shell-nav-link">
                  <FolderClosed size={18} aria-hidden="true" /><span className="shell-label truncate">{project.name}</span>
                </Link>
              );
            })}
            {projects.length === 0 && <p className="shell-label px-3 py-2 text-xs text-text-secondary">No projects yet</p>}
          </div>
        </nav>
        <div className="border-t border-border px-4 py-4">
          <div className="mb-3 flex h-10 items-center gap-3 px-2">
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs text-text-secondary">{displayName.slice(0, 1).toUpperCase()}</span>
            <span className="shell-label truncate text-xs text-text-secondary">{displayName}</span>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" title="Sign out" aria-label="Sign out" className="shell-nav-link w-full justify-start">
              <LogOut size={18} aria-hidden="true" /><span className="shell-label">Sign out</span>
            </Button>
          </form>
        </div>
      </>
    );
  }

  return (
    <div data-testid="workspace-shell" data-collapsed={collapsed} className="flex min-h-screen bg-background text-foreground">
      <aside inert={mobileOpen} data-collapsed={collapsed} className="desktop-sidebar sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar md:flex">
        {navigation(false)}
      </aside>
      <div inert={mobileOpen} className="min-w-0 flex-1">
        <header className="flex h-16 items-center gap-3 border-b border-border px-4 md:hidden">
          <button ref={menuRef} type="button" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="mobile-workspace-navigation" onClick={() => setMobileOpen(true)} className="shell-icon-button"><Menu size={20} /></button>
          <span className="text-xs font-semibold tracking-[0.16em] text-primary">AI SHOWROOM</span>
          <span className="min-w-0 truncate border-l border-border pl-3 text-sm text-text-secondary">{workspace.name}</span>
        </header>
        <main className="@container mx-auto min-w-0 max-w-[1680px] px-4 py-7 sm:px-6 md:px-8 md:py-9">{children}</main>
      </div>
      <div data-open={mobileOpen} className="mobile-navigation fixed inset-0 z-40 md:hidden" aria-hidden={!mobileOpen}>
        <button type="button" tabIndex={-1} aria-label="Close navigation backdrop" onClick={closeMobile} className="drawer-backdrop absolute inset-0 bg-black/65" />
        <div id="mobile-workspace-navigation" ref={drawerRef} role="dialog" aria-label="Navigation" data-open={mobileOpen} aria-modal={mobileOpen ? "true" : undefined} inert={!mobileOpen} className="drawer-panel relative flex h-full w-[min(86vw,320px)] flex-col border-r border-border bg-sidebar shadow-2xl">
          {navigation(true)}
        </div>
      </div>
    </div>
  );
}
