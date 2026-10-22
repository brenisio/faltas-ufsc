# Faltas UFSC

Contador de faltas para alunos de graduação da UFSC: https://brenisio.github.io/faltas-ufsc/

1. Abra a [Grade de Horários no CAGR](https://cagr.sistemas.ufsc.br/modules/aluno/grade/).
2. `Ctrl+A`, `Ctrl+C` e cole no site.
3. O site identifica as disciplinas, os dias da semana e calcula o limite de faltas
   (25% das aulas previstas, descontando feriados do Calendário Acadêmico 2026, campus Florianópolis).

Tudo roda no navegador; as faltas ficam salvas em `localStorage`.

## Desenvolvimento

Site estático sem build. Para rodar local: `python3 -m http.server` e abrir `http://localhost:8000`.
Testes do parser e do calendário: `npm test`.

Novo semestre: adicionar o calendário em `calendario.js` (início, fim, dias não letivos).
