# Notas de desenvolvimento (contexto pra próximas sessões)

## Modelo de contagem
- Conta por **aula** (igual à presença do Moodle: cada aula = 1 presença). Card tem um campo "Aulas perdidas" (− / número / +).
- Atraso ou meia presença = +1 aula. Sem meia falta.
- Destaque do card = **dias** que ainda dá pra faltar (aulas restantes ÷ aulas por dia); se os dias têm tamanhos diferentes, mostra faixa ("5–11").
- Limite = `floor(25% × aulas previstas)`, dias letivos contados pelo calendário oficial (`calendario.js`). Ex.: INE5625 2026.2 = 64 aulas → 16.
  O Moodle às vezes lista mais sessões (inclui 28/10 e 02/11, que são não letivos): o site fica com o oficial (mais conservador).
- Níveis: ok / alerta (≥75% do limite) / limite (sobra < menor bloco do dia) / reprovado.

## Parser do CAGR (`parser.js`)
- Cada linha da grade: horário + 6 células (Seg–Sáb). Célula vazia = 1 linha em branco; aula = "COD-TURMA" + sala.
- Rótulos combinados ("11:00"/"11:50", "17:10"/"18:00", "21:10"/"22:00") pertencem ao primeiro horário.
- Se alguma linha não fecha 6 células → `diasConfiaveis=false` e aparece dropdown de dia.
- Slots: 07:30 08:20 09:10 10:10 11:00 13:30 14:20 15:10 16:20 17:10 18:30 19:20 20:20 21:10 (50 min). Blocos juntam se o gap entre inícios ≤ 70 min.

## Estado / armazenamento
- `localStorage`: `faltas-ufsc:v1` (`{perfil, disciplinas, diasConfiaveis, faltas:{codigo:n}, eventos:[]}`), `faltas-ufsc:tema`, `faltas-ufsc:recolhidas`.
- `migrar()` converte formato antigo de faltas (`{dia:n, avulsas}` e frações).
- Backup = "Copiar relatório" (markdown do WhatsApp, `relatorio.js`); colar no import detecta `faltas.ufsc` e restaura tudo. Reimportar grade mantém faltas e eventos.

## UI (`app.js`, `style.css`)
- Cards: `--cols = ceil(n / ceil(n/4))` → até 4 por linha, sem card órfão.
- Semana estilo Google Agenda: linhas de altura fixa (`auto 46px repeat(n, 42px)`), faixa de eventos com no máx. 2 chips (+N), aula cancelada em feriado, linha do horário atual (America/Sao_Paulo) e aviso Agora/Próxima. `?agora=YYYY-MM-DDTHH:MM` simula horário.
- Calendário mensal: clicar no dia muda a semana sem deslocar a página (testado no e2e).
- Eventos do usuário (prova/entrega/lembrete), inclusive fim de semana; cor da disciplina.
- Seções Semana e Calendário recolhíveis (abertas por padrão). Tema auto/claro/escuro, visual minimalista.

## Testes
- `npm test` (node --test, concorrência 4): parser, grade diurna, grade cheia (84 horários), round-trip do relatório.
- `test/e2e.html` no navegador (56 checks). Headless: `python3 -m http.server 8765` e Chrome `--headless=new --dump-dom --user-data-dir=<tmp isolado>` (sem perfil isolado ele trava).
- `test/montar-grade.mjs` gera grades sintéticas (`GRADE_DIURNA`, `GRADE_CHEIA`).

## Ideias em aberto
- Calendários de outros campi / semestres futuros (só FLN 2026.1 e 2026.2 hoje).
