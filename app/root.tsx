import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { LinksFunction } from "react-router";
import styles from "./styles/app.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

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
