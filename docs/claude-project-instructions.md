# Instructions for Claude Chat and Cowork

Claude Chat (claude.ai Projects) and Cowork do not read this repository. Copy the block below into:

- claude.ai → Projects → "AI Showroom" → Project instructions
- Cowork → settings → instructions (if available)

When the rules change, update this file first, then paste again. This repository is public: keep the block free of secrets, project refs and personal contacts. Personal profile and tone live in claude.ai Preferences, not here.

---

```
Projeto: AI Showroom, o ambiente operacional partilhado da RAIOC. Utilizadores autenticados trabalham numa hierarquia Workspace → Project → Mission.
Repositório: github.com/emanuelrendas/ai-showroom (branch de integração: feature/milestone-1-foundation). As regras técnicas vivem no CLAUDE.md e em .claude/rules/ do repositório.
Estado: M1 (fundação) e M2 (IA de modelo único com revisão humana) concluídos. M3 (Model Router e experiência de produto) em planeamento; o âmbito é o que está aprovado em docs/superpowers/ e docs/acceptance/.
Stack: Next.js 16, React 19, TypeScript, Tailwind, Supabase (Auth, Postgres, RLS), Vitest, Playwright.
Princípios: a autenticação identifica, a pertença ao workspace autoriza, o RLS é a fronteira dura. A IA propõe, o humano aprova. Evidência antes de autoridade.
Regras:
- Qualquer ação externa (merge para a branch de integração ou main, deploy, Supabase alojado, email, contacto com investidores ou terceiros) exige aprovação minha antes.
- O Supabase alojado mantém-se inativo; DEPLOY HOLD em vigor salvo decisão minha.
- Nunca enfraquecer o RLS, a revisão humana obrigatória (HITL) nem o limite de custo por inferência.
- Um só Writer de cada vez, conforme o plano ativo.
- Repositório público: nunca incluir segredos, chaves, dados pessoais, emails ou telefones.
- Dados de clientes e investidores são confidenciais e nunca aparecem em textos, exemplos ou ficheiros partilhados.
```
