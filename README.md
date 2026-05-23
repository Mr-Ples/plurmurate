| ![murmurate ghibli](./assets/murmurate-ghibli.png) | ![plurmurate-def](./assets/plurmurate-def.png) |
| :---: | :---: |

Plurmurate is a community nomination and voting tool for deciding what a shared X/Twitter account should post, quote, repost, or reply to. Users authenticate with X, submit proposed posts as nominations, and vote on nominations using the A/B/U rating system developed by [Defender](https://x.com/DefenderOfBasic):

![abu_rating](./assets/ABU.jpeg)

## Setup

This app is a React Router app that runs on Cloudflare Workers. For local X login, expose the local dev server with jprq and use that HTTPS jprq URL in a dedicated X developer app.

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

## Local X login with jprq

X asks for a website URL because user login is a browser redirect flow. It needs a public HTTPS URL it can send the browser back to after login.

Use jprq to expose the Plurmurate dev server itself. Do not use the separate `/media/projects/vps-personal` Flask bridge for this flow.

Start Plurmurate locally:

```bash
npm run dev
```

In another terminal, expose port `5173` with jprq:

```bash
jprq http 5173 -s plurmurate
```

Use the HTTPS URL jprq gives you. It will look something like:

```text
https://plurmurate.mr-ples.jprq
```

The callback route already exists inside Plurmurate:

```text
/auth/x/callback
```

So the jprq callback URL is:

```text
https://plurmurate.mr-ples.jprq/auth/x/callback
```

If your jprq URL is different, use your actual jprq URL everywhere below.

Create a dedicated X developer app for local Plurmurate development.

On the app page, open the **Keys & Tokens** tab. You should see sections like:

- **App-Only Authentication**
- **OAuth 1.0 Keys**
- **User authentication settings**

For this app, ignore these sections:

- **App-Only Authentication** / **Bearer Token**
- **OAuth 1.0 Keys** / **Consumer Key**
- **OAuth 1.0 Keys** / **Access Token**

Those values are not used for local sign-in.

In the **User authentication settings** section, click **Set up**. This is the section that says users can log in to your app with X.

In the **Authentication settings** form, use these exact choices:

- Under **App permissions**, select **Read and write**.
  - Do not select **Read**. The app needs to publish posts.
  - Do not select **Read and write and Direct message** unless you intentionally want DM access.
- Leave **Request email from users** off.
- Under **Type of App**, select **Web App, Automated App or Bot**.
  - Do not select **Native App**. This repo expects the web/confidential app credentials.
- Under **App info**, set **Callback URI / Redirect URL** to your jprq callback URL:

```text
https://plurmurate.mr-ples.jprq/auth/x/callback
```

- Set **Website URL** to your jprq app URL:

```text
https://plurmurate.mr-ples.jprq
```

- **Organization name** can be left blank unless X requires it for your account.
- **Organization URL** can be left blank unless X requires it.
- **Terms of Service** can be left blank unless X requires it.
- **Privacy Policy** can be left blank unless X requires it.
- Click **Save Changes**.

After saving **User authentication settings**, X should show or generate the credentials for user login. Use those values for:

- `X_CLIENT_ID`: the client ID shown after setting up user authentication
- `X_CLIENT_SECRET`: the client secret shown after setting up user authentication

The app derives the OAuth redirect URI from the URL you use to open it, so the X dashboard callback must match that public URL plus `/auth/x/callback`.

This app asks X for these login permissions:

```text
users.read tweet.read tweet.write media.write offline.access follows.read
```

Set `.env` for local runtime settings and secrets:

```env
SESSION_SECRET=replace-with-at-least-32-random-characters
DATABASE_PROVIDER=sqlite
STORAGE_PROVIDER=local-r2

X_CLIENT_ID=your-x-oauth-client-id
X_CLIENT_SECRET=your-x-oauth-client-secret
```

Open the app through the jprq URL, not `localhost`, when testing X login:

```text
https://plurmurate.mr-ples.jprq
```

That keeps the login cookie and callback on the same HTTPS host.

Apply the local D1 migrations:

```bash
npm run db:migrate:local
```

Then run:

```bash
npm run dev
jprq http 5173 -s plurmurate
```

## Cloudflare deployment

For Cloudflare later, create a separate X developer app for production:

```env
SESSION_SECRET=replace-with-at-least-32-random-characters
DATABASE_PROVIDER=d1
STORAGE_PROVIDER=r2

X_CLIENT_ID=your-x-oauth-client-id
X_CLIENT_SECRET=your-x-oauth-client-secret
```

Set secret values in Cloudflare/Wrangler rather than committing them to the repo.

Create the Cloudflare resources:

```bash
npx wrangler d1 create plurmurate
npx wrangler r2 bucket create plurmurate-media
```

Copy the D1 `database_id` from the `wrangler d1 create` output into `wrangler.jsonc`, replacing:

```text
00000000-0000-0000-0000-000000000000
```

In `wrangler.jsonc`, set the deployed runtime vars:

```jsonc
"vars": {
  "DATABASE_PROVIDER": "d1",
  "STORAGE_PROVIDER": "r2",
  "PUBLISHING_WORKFLOW": "manual_review_when_qualified",
  "X_HOST_USER_ID": "",
  "X_HOST_HANDLE": ""
}
```

Set production secrets:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put X_CLIENT_ID
npx wrangler secret put X_CLIENT_SECRET
```

Apply remote migrations and deploy:

```bash
npm run db:migrate:remote
npm run build
npm run deploy
```

After deploy, put the deployed Cloudflare URL into the X dashboard:

```text
Website URL:
https://your-cloudflare-app-url

Callback URI / Redirect URL:
https://your-cloudflare-app-url/auth/x/callback
```

## Useful scripts

```bash
npm run dev              # Start the local React Router dev server
npm run build            # Build the app
npm run typecheck        # Run TypeScript checks
npm run lint             # Run ESLint
npm run db:migrate:local # Apply D1 migrations locally
npm run db:migrate:remote # Apply D1 migrations to Cloudflare
npm run deploy           # Deploy with Wrangler
```
