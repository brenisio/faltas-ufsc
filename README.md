# Faltas UFSC

Contador de faltas para alunos de graduação da UFSC: https://brenisio.github.io/faltas-ufsc/

1. Abra a [Grade de Horários no CAGR](https://cagr.sistemas.ufsc.br/modules/aluno/grade/).
2. `Ctrl+A`, `Ctrl+C` e cole no site.
3. O site identifica as disciplinas, os dias da semana e calcula o limite de faltas
   (25% das aulas previstas, descontando feriados do Calendário Acadêmico 2026, campus Florianópolis).

Tudo roda no navegador; as faltas ficam salvas em `localStorage`. O botão "Copiar relatório" gera uma mensagem pro WhatsApp que também é backup: colar ela no site restaura grade, faltas e eventos (útil pra levar pro celular).

## Desenvolvimento

Site estático sem build. Para rodar local: `python3 -m http.server` e abrir `http://localhost:8000`.
Testes do parser, calendário e relatório: `npm test`. Teste de ponta a ponta no navegador: subir o servidor local e abrir `http://localhost:8000/test/e2e.html` (mostra PASS/FAIL de cada fluxo).

Novo semestre: adicionar o calendário em `calendario.js` (início, fim, dias não letivos).
