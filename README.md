This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Local development

Run the development server:

```bash
npm run dev
```

If you need to test from another device on your Tailscale network during development:

```bash
npm run dev:host
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

### Persistent local/Tailscale run

For a more reliable always-on local run, use the production server instead of `next dev`:

```bash
./scripts/run-prod.sh
```

That script will:
- build the app,
- start the production server bound to `0.0.0.0:3000`,
- keep it running after the terminal closes,
- write logs to `.run/agent-dashboard.log`,
- store the PID in `.run/agent-dashboard.pid`.

Stop it with:

```bash
./scripts/stop-prod.sh
```

If your Tailscale IP is `100.70.37.99`, the dashboard will be reachable at:

```text
http://100.70.37.99:3000
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
