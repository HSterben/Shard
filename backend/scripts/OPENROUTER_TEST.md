# OpenRouter test (direct)

```bash
cd backend
npm run test:openrouter
```

## Setup

`backend/.env.local`:

```env
OPENROUTER_API_KEY=...
```

## Optional env

| Variable | Default |
|----------|---------|
| `TEST_MODEL` | `nvidia/nemotron-nano-12b-v2-vl:free` |
| `TEST_PROMPT` | Short DFA question |
| `TEST_MAX_TOKENS` | `256` |
| `TEST_SYSTEM` | Shard default system line |
