# sb1-j9bvxuxo

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/Jliman3012/sb1-j9bvxuxo)

## Environment setup

This project requires Supabase credentials to be available at build time. A ready-to-use example
configuration is provided in `.env.example` with the currently provisioned project:

```
VITE_SUPABASE_URL=https://trtqfmdjgsgbodpyoucq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRydHFmbWRqZ3NnYm9kcHlvdWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1OTQxMTUsImV4cCI6MjA3NzE3MDExNX0.qT9vHrz-w5Lh3Fr-wWoz7VkNoDY67sxxmcF03GfEPqM
```

Copy this file to `.env` (or supply equivalent environment variables through your preferred
configuration mechanism) before running the development server or building the application.

When the variables are not explicitly provided (for example, when running a StackBlitz
preview), the app now falls back to the above Supabase project automatically. If you want to
disable this behaviour—for instance, in automated tests—set `VITE_SUPABASE_DISABLE_DEFAULTS`
to `true` in your environment.
