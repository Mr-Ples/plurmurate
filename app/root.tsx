import { ArrowLeft, Home } from "lucide-react";
import { isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from "react-router";
import type { LinksFunction } from "react-router";
import styles from "./styles/app.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
  { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
  { rel: "icon", href: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
  { rel: "icon", href: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
  { rel: "manifest", href: "/site.webmanifest" },
];

export async function loader({ context }: any) {
  return {
    repoUrl: context.cloudflare.env.GITHUB_REPOSITORY_URL || null,
  };
}

export default function Root() {
  return (
    <html lang="en" className="min-h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-[#f7f3ea] bg-[linear-gradient(115deg,rgba(140,91,74,0.10),transparent_28%),linear-gradient(25deg,rgba(73,109,88,0.12),transparent_34%)] font-sans tracking-normal text-[#1f2421]">
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const details = getErrorDetails(error);

  return (
    <html lang="en" className="min-h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-[#f7f3ea] bg-[linear-gradient(115deg,rgba(140,91,74,0.10),transparent_28%),linear-gradient(25deg,rgba(73,109,88,0.12),transparent_34%)] font-sans tracking-normal text-[#1f2421]">
        <main className="mx-auto grid min-h-screen w-full max-w-[760px] place-items-center px-4 py-10">
          <section className="relative grid w-full gap-5 overflow-hidden rounded-lg border border-[#1f242129] bg-[#fffcf4d1] p-6 shadow-[0_18px_50px_rgba(31,36,33,0.12)] sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(82,111,141,0.14),transparent_52%),linear-gradient(45deg,transparent,rgba(140,91,74,0.10))]" />
            <div className="relative grid gap-2">
              <p className="m-0 text-xs uppercase tracking-[0.08em] text-[#6e716b]">Error {details.status}</p>
              <h1 className="m-0 font-serif text-[clamp(2.4rem,8vw,5.4rem)] leading-[0.95] font-medium">{details.title}</h1>
              <p className="m-0 max-w-[58ch] text-[#6e716b]">{details.message}</p>
            </div>
            <div className="relative flex flex-wrap gap-2.5">
              <button
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#1f242129] bg-white/45 px-3.5 py-2.5 text-sm font-medium text-[#1f2421] hover:border-[#1f24214d] hover:bg-[#fffcf4]"
                type="button"
                onClick={() => history.back()}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Back
              </button>
              <Link className="inline-flex items-center gap-2 rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-sm font-medium text-[#fffaf0] hover:bg-[#313834]" to="/">
                <Home size={16} aria-hidden="true" />
                Home
              </Link>
            </div>
          </section>
        </main>
        <Scripts />
      </body>
    </html>
  );
}

function getErrorDetails(error: unknown) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 401) return { status: 401, title: "Sign in required", message: "You need to log in before viewing this page." };
    if (error.status === 403) return { status: 403, title: "Access denied", message: "Your account does not have permission to use this part of Plurmurate." };
    if (error.status === 404) return { status: 404, title: "Page not found", message: "That page or nomination could not be found." };
    return { status: error.status, title: error.statusText || "Something went wrong", message: readableErrorData(error.data) };
  }

  return {
    status: 500,
    title: "Something went wrong",
    message: error instanceof Error ? error.message : "The app hit an unexpected error.",
  };
}

function readableErrorData(data: unknown) {
  if (typeof data === "string" && data.trim()) return data;
  return "The request could not be completed.";
}
