// Calendário Acadêmico de Graduação UFSC 2026 (Resolução Normativa nº 214/2025/CUn),
// campus-sede Florianópolis. Datas não letivas = feriados + dias não letivos que caem
// dentro do semestre.

export const CALENDARIOS = {
  20261: {
    rotulo: '2026.1',
    inicio: '2026-03-09',
    fim: '2026-07-15',
    naoLetivos: {
      '2026-03-23': 'Aniversário de Florianópolis',
      '2026-04-03': 'Sexta-feira Santa',
      '2026-04-04': 'Dia não letivo',
      '2026-04-20': 'Dia não letivo',
      '2026-04-21': 'Tiradentes',
      '2026-05-01': 'Dia do Trabalho',
      '2026-05-02': 'Dia não letivo',
      '2026-06-04': 'Corpus Christi',
      '2026-06-05': 'Dia não letivo',
      '2026-06-06': 'Dia não letivo',
    },
    eventos: [
      { de: '2026-03-09', ate: '2026-03-09', texto: 'Início das aulas' },
      { de: '2026-07-09', ate: '2026-07-15', texto: 'Período de recuperação' },
      { de: '2026-07-15', ate: '2026-07-15', texto: 'Fim do semestre' },
    ],
  },
  20262: {
    rotulo: '2026.2',
    inicio: '2026-08-10',
    fim: '2026-12-12',
    naoLetivos: {
      '2026-09-07': 'Independência do Brasil',
      '2026-10-12': 'Nossa Senhora Aparecida',
      '2026-10-28': 'Dia do Servidor Público',
      '2026-11-02': 'Finados',
      '2026-11-15': 'Proclamação da República',
      '2026-11-20': 'Consciência Negra',
      '2026-11-21': 'Dia não letivo',
      '2026-12-05': 'Vestibular UFSC (não letivo)',
    },
    eventos: [
      { de: '2026-08-10', ate: '2026-08-10', texto: 'Início das aulas' },
      { de: '2026-12-07', ate: '2026-12-12', texto: 'Período de recuperação' },
      { de: '2026-12-12', ate: '2026-12-12', texto: 'Fim do semestre' },
    ],
  },
};

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function data(isoStr) {
  const [a, m, d] = isoStr.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function ehLetivo(cal, d) {
  const s = iso(d);
  return d.getDay() !== 0 && s >= cal.inicio && s <= cal.fim && !cal.naoLetivos[s];
}

// Quantos dias letivos cada dia da semana tem no semestre (índice = Date.getDay()).
// `de` opcional: conta só a partir dessa data (inclusive).
export function diasLetivosPorSemana(cal, de) {
  const cont = [0, 0, 0, 0, 0, 0, 0];
  const d = data(de && de > cal.inicio ? de : cal.inicio);
  const fim = data(cal.fim);
  for (; d <= fim; d.setDate(d.getDate() + 1)) {
    if (ehLetivo(cal, d)) cont[d.getDay()]++;
  }
  return cont;
}

// Total de aulas da disciplina no semestre e limite de faltas (25%, frequência mínima 75%).
export function limiteFaltas(cal, encontros) {
  const porDia = diasLetivosPorSemana(cal);
  let total = 0;
  for (const e of encontros) total += e.dia == null ? 18 * e.aulas : porDia[e.dia] * e.aulas;
  return { total, limite: Math.floor(total * 0.25) };
}
