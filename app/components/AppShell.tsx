import { Form, Link } from "react-router";
import type { CurrentUser } from "~/repositories/interfaces";

export function AppShell({ user, children }: { user: CurrentUser | null; children: React.ReactNode }) {
  const isPublisher = user?.roles.some((role) => ["publisher", "host", "admin"].includes(role));
  const isAdmin = user?.roles.some((role) => ["host", "admin"].includes(role));
  return (
    <div className="mx-auto w-[min(1120px,calc(100vw-28px))]">
      <header className="flex flex-col items-start justify-between gap-3.5 border-b border-[#1f242129] py-[22px] pb-3 md:flex-row md:items-center">
        <Link className="font-serif text-[1.4rem]" to="/">Plurmurate</Link>
        <nav className="flex flex-wrap items-center gap-3.5 text-[#6e716b]">
          <Link to="/nominations/new">New Post</Link>
          {user ? (
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-[#1f242129] bg-white/35 px-2.5 py-1.5 text-[#1f2421] [&::-webkit-details-marker]:hidden">
                @{user.username ?? "me"}
                <span className="text-[0.7rem] text-[#6e716b]" aria-hidden="true">v</span>
              </summary>
              <div className="absolute right-0 z-20 mt-2 grid min-w-44 gap-1 rounded-lg border border-[#1f242129] bg-[#fffcf4] p-2 text-[#1f2421] shadow-[0_14px_34px_rgba(31,36,33,0.14)]">
                {isPublisher ? <Link className="rounded-md px-3 py-2 hover:bg-[#1f24210d]" to="/review">Review</Link> : null}
                {isAdmin ? <Link className="rounded-md px-3 py-2 hover:bg-[#1f24210d]" to="/settings">Settings</Link> : null}
                <Form method="post" action="/logout" className="m-0 border-t border-[#1f242129] pt-1">
                  <button className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-[#8b3434] hover:bg-[#8b34340f]" type="submit">Logout</button>
                </Form>
              </div>
            </details>
          ) : <Link to="/login">Login</Link>}
        </nav>
      </header>
      {children}
    </div>
  );
}
