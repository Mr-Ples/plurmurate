import { Link } from "react-router";
import type { CurrentUser } from "~/repositories/interfaces";

export function AppShell({ user, children }: { user: CurrentUser | null; children: React.ReactNode }) {
  const isPublisher = user?.roles.some((role) => ["publisher", "host", "admin"].includes(role));
  const isAdmin = user?.roles.some((role) => ["host", "admin"].includes(role));
  return (
    <div className="page">
      <header className="topbar">
        <Link className="brand" to="/">Plurmurate</Link>
        <nav className="nav">
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
