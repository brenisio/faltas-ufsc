import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGrade } from '../parser.js';
import { montarRelatorio, lerRelatorio } from '../relatorio.js';
import { montarGrade, GRADE_DIURNA } from './montar-grade.mjs';

const situacao = () => ({ emoji: '✅', texto: 'pode faltar mais 6 dias', limite: 16 });

for (const [nome, texto] of [
  ['noturna', readFileSync(new URL('./grade-exemplo.txt', import.meta.url), 'utf8')],
  ['diurna', montarGrade(GRADE_DIURNA)],
]) {
  test(`relatório → backup completo (grade ${nome})`, () => {
    const g = parseGrade(texto);
    const estado = {
      ...g,
      faltas: Object.fromEntries(g.disciplinas.map((d, i) => [d.codigo, i * 3])),
      eventos: [
        { id: 'x', data: '2026-11-04', tipo: 'prova', codigo: g.disciplinas[0].codigo, texto: 'P2' },
        { id: 'y', data: '2026-12-13', tipo: 'trabalho', codigo: '', texto: 'Relatório final' },
      ],
    };
    const msg = montarRelatorio(estado, situacao, '2026.2');
    const volta = lerRelatorio(msg);
    assert.deepEqual(volta.perfil, g.perfil);
    assert.deepEqual(volta.faltas, estado.faltas);
    assert.deepEqual(volta.disciplinas, g.disciplinas);
    assert.deepEqual(volta.eventos.map(({ id, ...e }) => e), estado.eventos.map(({ id, ...e }) => e));
  });
}

test('relatório → backup completo (grade cheia)', async () => {
  const { GRADE_CHEIA } = await import('./montar-grade.mjs');
  const g = parseGrade(montarGrade(GRADE_CHEIA));
  const estado = { ...g, faltas: { DSC1000: 3 }, eventos: [] };
  const volta = lerRelatorio(montarRelatorio(estado, situacao, '2026.2'));
  assert.deepEqual(volta.disciplinas, g.disciplinas);
});
