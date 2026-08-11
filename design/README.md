# Direção visual — SECC Tech Design System

Desde 11/08/2026 o front-end usa o **SECC Tech Design System** (projeto homônimo no Claude
Design, sincronizado via `/design-sync`). Os tokens vivem em `src/styles/secc-tech/` e a camada
de aplicação em `src/styles/globals.css`. A direção editorial clara anterior (ink/paper/forest)
foi substituída integralmente.

## Princípio

Dark nativo, técnico, sóbrio e instrumental. Metáfora central: **sinal vital** — a empresa em
crise é monitorada como um paciente. Nada de gradiente saturado, ilustração lúdica ou canto
muito arredondado.

## Regras que não se negociam

- Quatro degraus de fundo (`#070809 → #0d0f14 → #14171f`) com contraste baixo de propósito:
  a separação entre blocos vem da **borda branca a 9%**, nunca do fundo.
- Um único azul de marca (`#5b8bff`). Cor semântica sempre em **três camadas**: cheia no texto,
  14% no fundo, 34% na borda.
- IBM Plex Sans (400–700) para prosa e título; JetBrains Mono para **todo número**, código e
  etiqueta técnica (maiúscula com `tracking-widest`).
- Escala fluida de seis degraus (`--fluid-*`); nunca escrever um `clamp()` novo.
- O `.secc-panel` (cantos em L de 14px em azul, raio 4px) marca instrumentação técnica; o card
  de marketing usa raio 12–16px. **Não uniformizar.**
- Brilho azul só em elemento de ação. Vidro (`blur 24px + saturate 160%`) só em navbar, modal
  e dropdown.
- Movimento entre 0.12s e 0.4s; vocabulário de sinal vital (`secc-ecg`, `secc-breathe`,
  `secc-pulse`); `prefers-reduced-motion` desliga tudo.
- Rótulo de gravidade é vocabulário fechado: Estável · Monitorar · Crítico · Intervenção · Info.
- Emoji nunca. Números em formato brasileiro com `−` tipográfico.

## Fontes

Carregadas via `next/font` em `src/app/layout.tsx` e expostas como `--font-plex` /
`--font-jbmono`; `src/styles/secc-tech/typography.css` faz a ponte para os tokens genéricos
(`--font-sans`, `--font-mono`).

## Referência completa

Projeto "SECC Tech Design System" no Claude Design: tokens, 12 componentes com prompts,
22 guidelines e UI kits de marketing e app. O `readme.md` de lá é a autoridade em caso de dúvida.
