// Grade de quem tem aula de manhã e de tarde (inclusive blocos de 3 e 4 aulas e sábado),
// montada no mesmo formato do Ctrl+A/Ctrl+C do CAGR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGrade } from '../parser.js';
import { CALENDARIOS, limiteFaltas } from '../calendario.js';
import { montarGrade, GRADE_DIURNA } from './montar-grade.mjs';

const grade = montarGrade(GRADE_DIURNA);

test('grade diurna: dias, horários e aulas por dia', () => {
  const { perfil, disciplinas, diasConfiaveis } = parseGrade(grade);
  assert.equal(diasConfiaveis, true);
  assert.equal(perfil.curso, 'ENGENHARIA CIVIL');
  const m = Object.fromEntries(disciplinas.map(d => [d.codigo, d.encontros]));
  assert.deepEqual(m.MTM3101.map(e => [e.dia, e.aulas]), [[1, 4], [3, 2]]);
  assert.deepEqual(m.FSC5101.map(e => [e.dia, e.aulas]), [[2, 3], [4, 3]]);
  assert.deepEqual(m.QMC5125.map(e => [e.dia, e.aulas]), [[5, 2], [6, 2]]);
  assert.deepEqual(m.ECV5215.map(e => [e.dia, e.aulas]), [[2, 4]]);
  assert.deepEqual(m.QMC5125[0].horas, ['10:10', '11:00']);
  assert.deepEqual(m.ECV5215[0].horas, ['07:30', '08:20', '16:20', '17:10']);
});

test('grade diurna: limites', () => {
  const { disciplinas } = parseGrade(grade);
  const lim = Object.fromEntries(disciplinas.map(d => [d.codigo, limiteFaltas(CALENDARIOS[20262], d.encontros)]));
  assert.deepEqual(lim.MTM3101, { total: 4 * 15 + 2 * 17, limite: 23 });
  assert.deepEqual(lim.FSC5101, { total: 3 * 18 + 3 * 18, limite: 27 });
  assert.deepEqual(lim.QMC5125, { total: 2 * 17 + 2 * 16, limite: 16 });
  assert.deepEqual(lim.ECV5215, { total: 4 * 18, limite: 18 });
});
