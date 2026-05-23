import { Link } from "react-router";
import type { CurrentUser } from "~/repositories/interfaces";

export function AppShell({ user, children }: { user: CurrentUser | null; children: React.ReactNode }) {
  const isPublisher = user?.roles.some((role) => ["publisher", "host", "admin"].includes(role));
  const isAdmin = user?.roles.some((role) => ["host", "admin"].includes(role));
  return (
    <div className="mx-auto w-[min(1120px,calc(100vw-28px))]">
      <header className="flex flex-col items-start justify-between gap-3.5 border-b border-[#1f242129] py-[22px] pb-3 md:flex-row md:items-center">
        <Link className="font-serif text-[1.4rem]" to="/">Plurmurate</Link>
        <nav className="flex flex-wrap gap-3.5 text-[#6e716b]">
          <Link to="/nominations/new">New Post</Link>
          {isPublisher ? <Link to="/review">Review</Link> : null}
          {isAdmin ? <Link to="/settings">Settings</Link> : null}
          {user ? <Link to="/me">@{user.username ?? "me"}</Link> : <Link to="/login">Login</Link>}
        </nav>
      </header>
      {children}
    </div>
  );
}
