# wpp-crm

WhatsApp CRM on the Meta WhatsApp Cloud API — Next.js 16, Postgres (Docker), Drizzle.

```bash
corepack enable            # once, provides pnpm
pnpm install
cp .env.example .env.local # fill in Meta values
pnpm db:up                 # Postgres :5432, Adminer :8080
pnpm dev                   # http://localhost:3000  (health: /api/health)
```

Project rules, architecture and conventions: see [AGENTS.md](./AGENTS.md).
