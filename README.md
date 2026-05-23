| ![murmurate ghibli](./assets/murmurate-ghibli.png) | ![plurmurate-def](./assets/plurmurate-def.png) |
| :---: | :---: |

Plurmurate is a community nomination and voting tool for deciding what a shared X/Twitter account should post, quote, repost, or reply to. Users authenticate with X, submit proposed posts as nominations, and vote on nominations using the A/B/U rating system developed by [Defender](https://x.com/DefenderOfBasic):

![abu_rating](./assets/ABU.jpeg)

# Setup

## X/Twitter Setup

Create two separate X developer apps with the **Create App** button.

Name them `plurmurate-staging` and `plurmurate-production` for example.
- `plurmurate-staging`: used for local development and staging.
- `plurmurate-production`: used for the live production deployment.

For both apps, configure user authentication:

- App permissions: **Read and write**.
  - Do not choose **Read and write and Direct message**.
- Type of App: **Web App, Automated App or Bot**.
  - Do not choose **Native App**.
- Use any temporary placeholder URL for now until the app has been deployed or tunneled.

Create production and staging secrets:

```bash
cp .dev.vars.staging.example .dev.vars.staging
cp .dev.vars.production.example .dev.vars.production
```

Edit `.dev.vars.staging`:

```env
SESSION_SECRET=replace-with-at-least-32-random-characters
X_CLIENT_ID=your-staging-x-oauth-client-id
X_CLIENT_SECRET=your-staging-x-oauth-client-secret
```

Edit `.dev.vars.production`:

```env
SESSION_SECRET=replace-with-at-least-32-random-characters
X_CLIENT_ID=your-production-x-oauth-client-id
X_CLIENT_SECRET=your-production-x-oauth-client-secret
```

## App Setup

### Staging/local

Create local Wrangler config:

```bash
cp wrangler.example.jsonc wrangler.jsonc
```

Create the staging D1 database:

```bash
npx wrangler d1 create plurmurate
# If it asks to add the config on your behalf say No
npx wrangler r2 bucket create plurmurate-media
# If it asks to add the config on your behalf say No
```

Edit `wrangler.jsonc`:

- Set the `database_id` printed by `npx wrangler d1 create plurmurate`.
- Set the host account vars `X_HOST_HANDLE` and `X_HOST_USER_ID` (find id here: https://twxpicker.com/user-id-finder)

Apply migrations to the local D1 database, then start the dev server:

```bash
npm run db:migrate:local
npm run db:migrate:staging:remote
npm run dev
# once its running start a tunnel by tapping t + enter
```

Copy the URL from the tunnel to the staging X app configuration **Website URL** and **Callback URI / Redirect URL** setting (you need to do this every time you start the local tunnel):
- Website URL: https://tunnel-url.cloudflare.com
- Callback URI / Redirect URL: https://tunnel-url.cloudflare.com/x/callback

### Production

Create production resources:

```bash
npx wrangler d1 create plurmurate-production
# If it asks to add the config on your behalf say No
npx wrangler r2 bucket create plurmurate-media-production
# If it asks to add the config on your behalf say No
```

Edit `wrangler.jsonc`:
- Set the `database_id` printed by `npx wrangler d1 create plurmurate-production`.

Upload production secrets:

```bash
npx wrangler secret bulk .dev.vars.production --env production
```

Apply production migrations and deploy:

```bash
npm run db:migrate:production:remote
npm run build:production
npm run deploy:production
```

## Staging Deploy

```bash
npm run db:migrate:staging:remote
npm run build:staging
npm run deploy:staging
```
