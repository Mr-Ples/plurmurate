import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Form, Link, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import type { CurrentUser } from "~/repositories/interfaces";

export function AppShell({ user, children }: { user: CurrentUser | null; children: React.ReactNode }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDetailsElement>(null);
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const repoUrl = rootData?.repoUrl;
  const isAdmin = user?.roles.includes("admin");

  useEffect(() => {
    if (!userMenuOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setUserMenuOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [userMenuOpen]);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-3.5">
      <header className="relative z-10 flex items-center justify-between gap-3.5 border-b border-[#1f242129] py-[22px] pb-3">
        <Link className="inline-flex shrink-0 items-center gap-2 font-serif text-[1.4rem]" to="/">
          <img className="h-6 w-6 rounded-sm" src="/favicon-32x32.png" alt="" aria-hidden="true" />
          <span>Plurmurate</span>
        </Link>
        <nav className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3.5 text-[#6e716b]">
          {repoUrl ? (
            <a
              className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-md border border-[#1f242129] bg-white/35 text-[#1f2421] hover:border-[#1f24214d] hover:bg-[#fffcf4d1]"
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open GitHub repository"
              title="GitHub"
            >
              <GitHubMark className="h-[18px] w-[18px]" />
            </a>
          ) : null}
          {user ? (
            <details className="group relative" open={userMenuOpen} onToggle={(event) => setUserMenuOpen(event.currentTarget.open)} ref={userMenuRef}>
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-[#1f242129] bg-white/35 px-2.5 py-1.5 text-[#1f2421] [&::-webkit-details-marker]:hidden">
                @{user.username ?? "me"}
                <span className="text-[0.7rem] text-[#6e716b]" aria-hidden="true">v</span>
              </summary>
              <div className="absolute right-0 z-20 mt-2 grid min-w-44 gap-1 rounded-lg border border-[#1f242129] bg-[#fffcf4] p-2 text-[#1f2421] shadow-[0_14px_34px_rgba(31,36,33,0.14)]">
                {isAdmin ? <Link className="rounded-md px-3 py-2 hover:bg-[#1f24210d]" to="/settings" onClick={() => setUserMenuOpen(false)}>Settings</Link> : null}
                <Form method="post" action="/logout" className="m-0 border-t border-[#1f242129] pt-1">
                  <button className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-[#8b3434] hover:bg-[#8b34340f]" type="submit">Logout</button>
                </Form>
              </div>
            </details>
          ) : (
            <Link className="inline-flex items-center gap-1.5" to="/login">
              Login
              <ExternalLink size={15} aria-hidden="true" />
            </Link>
          )}
        </nav>
      </header>
      {children}
    </div>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 98 96" fill="currentColor" aria-hidden="true" focusable="false">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.449-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364C83.99 89.389 98 70.973 98 49.217 98 22 76 0 48.854 0z"
      />
    </svg>
  );
}
