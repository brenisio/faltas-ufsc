import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGrade } from '../parser.js';
import { CALENDARIOS, diasLetivosPorSemana, limiteFaltas } from '../calendario.js';

const texto = readFileSync(new URL('./grade-exemplo.txt', import.meta.url), 'utf8');

test('lê perfil do aluno', () => {
  const { perfil } = parseGrade(texto);
  assert.deepEqual(perfil, {
    nome: 'Fulano de Tal da Silva', matricula: '23100000',
    curso: 'SISTEMAS DE INFORMAÇÃO (noturno)', semestre: '20262',
  });
});

test('infere disciplinas e dias da semana', () => {
  const { disciplinas, diasConfiaveis } = parseGrade(texto);
  assert.equal(diasConfiaveis, true);
  const m = Object.fromEntries(disciplinas.map(d => [d.codigo, d]));
  assert.deepEqual(m.EGC5010.encontros, [{ dia: 2, aulas: 2 }]);
  assert.deepEqual(m.INE5625.encontros, [{ dia: 1, aulas: 2 }, { dia: 3, aulas: 2 }]);
  assert.deepEqual(m.INE5624.encontros, [{ dia: 2, aulas: 2 }, { dia: 3, aulas: 2 }]);
  assert.deepEqual(m.INE5680.encontros, [{ dia: 4, aulas: 2 }, { dia: 5, aulas: 2 }]);
  assert.equal(m.INE5680.nome, 'Segurança da Informação e de Redes');
  assert.equal(m.INE5680.professor, 'Carla Merkle Westphall');
});

test('dias letivos batem com os totais do PDF (FLN)', () => {
  // [dom, seg, ter, qua, qui, sex, sáb]
  assert.deepEqual(diasLetivosPorSemana(CALENDARIOS[20262]), [0, 15, 18, 17, 18, 17, 16]);
  const t1 = diasLetivosPorSemana(CALENDARIOS[20261]).reduce((a, b) => a + b);
  assert.equal(t1, 19 + 22 + 24 + 23 + 13);
});

test('limite de faltas por disciplina', () => {
  const { disciplinas } = parseGrade(texto);
  const lim = Object.fromEntries(disciplinas.map(d => [d.codigo, limiteFaltas(CALENDARIOS[20262], d.encontros)]));
  assert.deepEqual(lim.INE5625, { total: 64, limite: 16 });
  assert.deepEqual(lim.EGC5010, { total: 36, limite: 9 });
  assert.deepEqual(lim.INE5624, { total: 70, limite: 17 });
  assert.deepEqual(lim.INE5680, { total: 70, limite: 17 });
});

test('grade com linhas em branco colapsadas não chuta dia', () => {
  const colapsado = texto.replace(/\n{2,}/g, '\n');
  const { disciplinas, diasConfiaveis } = parseGrade(colapsado);
  assert.equal(diasConfiaveis, false);
  assert.equal(disciplinas.find(d => d.codigo === 'INE5625').encontros[0].aulas, 4);
});
