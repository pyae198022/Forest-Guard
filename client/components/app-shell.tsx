"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ChevronLeft, Menu, RefreshCw, ServerCog } from "lucide-react";
import { NAV_ITEMS } from "@client/src/navigation";
import type { PageKey } from "@client/src/types";
import { Logo } from "@client/assets/logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useApi } from "@client/hooks/use-api";


interface HealthState {
  status: string;
  models_trained: boolean;
  best_model: string | null;
}

interface AppShellProps {
  active: PageKey;
  onNavigate: (page: PageKey) => void;
  children: React.ReactNode;
}

function NavList({
  active,
  onNavigate,
  collapsed = false,
}: {
  active: PageKey;
  onNavigate: (p: PageKey) => void;
  collapsed?: boolean;
}) {
  return (
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === active;
        const button = (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isActive
                ? "text-white"
                : "text-emerald-100/55 hover:bg-white/[0.05] hover:text-emerald-50",
              collapsed && "justify-center px-0",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-xl border border-emerald-400/25 bg-gradient-to-r from-emerald-400/[0.16] to-emerald-400/[0.04]"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon
              className={cn(
                "relative z-10 h-[18px] w-[18px] shrink-0 transition-colors",
                isActive ? "text-emerald-300" : "text-emerald-100/40 group-hover:text-emerald-200",
              )}
            />
            {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
          </button>
        );
        return collapsed ? (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right" className="border-white/10 bg-[#0a1f16] text-emerald-50">
              {item.label}
            </TooltipContent>
          </Tooltip>
        ) : (
          button
        );
      })}
    </nav>
  );
}

function BrandHeader({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-5 pt-6 pb-4", collapsed && "justify-center px-0")}>
      <div className="relative shrink-0">
        <div className="absolute inset-0 rounded-xl bg-emerald-400/25 blur-lg" aria-hidden />
        <div className="relative rounded-xl border border-white/10 bg-white/[0.04] p-1.5">
          <Logo size={22} />
        </div>
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight text-white">
            ForestGuard <span className="text-emerald-300">AI</span>
          </p>
          <p className="text-[11px] text-emerald-100/40">Data Mining Suite</p>
        </div>
      )}
    </div>
  );
}

function BackendStatus() {
  // /health returns a raw payload (no {success,data} envelope) - fetch directly
  const { data } = useApi<HealthState>(async () => {
    const res = await fetch("/health?XTransformPort=3010", { cache: "no-store" });
    return (await res.json()) as HealthState;
  }, []);
  return (
    <div className="mx-3 mb-4 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              data?.status === "ok" ? "bg-emerald-400" : "bg-amber-400",
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              data?.status === "ok" ? "bg-emerald-400" : "bg-amber-400",
            )}
          />
        </span>
        <p className="text-[11px] font-medium text-emerald-100/60">
          {data?.status === "ok" ? "ML Backend Online" : "Connecting to backend..."}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-100/35">
        <ServerCog className="h-3 w-3" />
        {data?.models_trained
          ? `Models ready · best: ${(data.best_model ?? "").replace(/_/g, " ")}`
          : "Training pipelines..."}
      </div>
    </div>
  );
}

export function AppShell({ active, onNavigate, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = useMemo(() => NAV_ITEMS.find((i) => i.key === active)!, [active]);

  const navigate = (p: PageKey) => {
    onNavigate(p);
    setMobileOpen(false);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative min-h-screen bg-[#04100b] text-emerald-50">
        {/* ambient background */}
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-[480px] w-[480px] rounded-full bg-emerald-500/[0.13] blur-[130px]" />
          <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-teal-500/[0.10] blur-[130px]" />
          <div className="absolute bottom-0 left-0 h-[360px] w-[360px] rounded-full bg-lime-500/[0.06] blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          />
        </div>

        <div className="relative flex min-h-screen">
          {/* ---------------- desktop sidebar ---------------- */}
          <aside
            className={cn(
              "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/[0.07] bg-[#06170f]/80 backdrop-blur-2xl transition-all duration-300 md:flex",
              collapsed ? "w-[76px]" : "w-[264px]",
            )}
          >
            <BrandHeader collapsed={collapsed} />
            <div className="mb-3 px-5" hidden={collapsed}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/30">
                Modules
              </p>
            </div>
            <NavList active={active} onNavigate={navigate} collapsed={collapsed} />
            <div className="mt-auto pt-4">
              <BackendStatus />
              <div className={cn("flex items-center gap-2 px-4 pb-5", collapsed && "justify-center px-0")}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCollapsed((c) => !c)}
                  className="h-8 gap-2 rounded-lg border border-white/[0.06] text-emerald-100/50 hover:bg-white/[0.06] hover:text-emerald-100"
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
                  {!collapsed && <span className="text-xs">Collapse</span>}
                </Button>
              </div>
            </div>
          </aside>

          {/* ---------------- main column ---------------- */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* topbar */}
            <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#04100b]/75 backdrop-blur-xl">
              <div className="flex items-center gap-3 px-4 py-3 md:px-8">
                {/* mobile menu */}
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-emerald-100/70 hover:bg-white/[0.06] md:hidden"
                      aria-label="Open navigation"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="w-[280px] border-white/10 bg-[#06170f] p-0 backdrop-blur-2xl"
                  >
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    <div className="flex h-full flex-col">
                      <BrandHeader />
                      <div className="mb-3 px-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/30">
                          Modules
                        </p>
                      </div>
                      <NavList active={active} onNavigate={navigate} />
                      <BackendStatus />
                    </div>
                  </SheetContent>
                </Sheet>

                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="truncate font-medium text-white">{current.label}</span>
                  <span className="hidden truncate text-emerald-100/35 md:inline">
                    · {current.short}
                  </span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-1 text-[11px] font-medium text-emerald-300 sm:inline">
                    v1.0 · University Project
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-emerald-100/60 hover:bg-white/[0.06]"
                    aria-label="Refresh data"
                    onClick={() => window.dispatchEvent(new CustomEvent("forestguard:refresh"))}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </header>

            {/* page content with transitions */}
            <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="mx-auto w-full max-w-[1440px]"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* sticky footer */}
            <footer className="mt-auto border-t border-white/[0.06] bg-[#04100b]/60">
              <div className="flex flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-emerald-100/35 md:flex-row md:px-8">
                <p>ForestGuard AI — Data Mining university project · 4,030 records · 27 features</p>
                <p>React 19 · Next.js 16 · FastAPI · scikit-learn · SQLite</p>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
