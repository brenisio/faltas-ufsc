// Relatório pro WhatsApp que também é o backup: colar a mensagem no site reconstrói
// perfil, grade (dias, horários e salas), faltas e eventos.

export const SLOTS = ['07:30', '08:20', '09:10', '10:10', '11:00', '13:30', '14:20', '15:10', '16:20', '17:10', '18:30', '19:20', '20:20', '21:10'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const TIPOS = { prova: 'Prova', trabalho: 'Entrega', outro: 'Lembrete' };

const min = h => { const [H, M] = h.split(':').map(Number); return H * 60 + M; };
const hhmm = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

// Blocos de aulas seguidas de um encontro: [{ ini: '18:30', fim: '20:10' }]
function blocos(horas) {
  const out = [];
  for (const h of [...horas].sort()) {
    const b = out.at(-1);
    if (b && min(h) - b.ultimo <= 70) b.ultimo = min(h);
    else out.push({ ini: h, ultimo: min(h) });
  }
  return out.map(b => ({ ini: b.ini, fim: hhmm(b.ultimo + 50) }));
}

// situacao(d) → { emoji, texto, limite } calculado pelo app (depende do calendário).
export function montarRelatorio(estado, situacao, rotuloSemestre) {
  const p = estado.perfil ?? {};
  const linhas = [
    `📚 *faltas.ufsc* — ${p.nome ?? 'Aluno'}${p.matricula ? ` (${p.matricula})` : ''}`,
    [p.curso, rotuloSemestre].filter(Boolean).join(' · '),
  ];
  for (const d of estado.disciplinas) {
    const s = situacao(d);
    const horario = d.encontros.filter(e => e.dia != null).map(e =>
      `${DIAS[e.dia]} ${(e.horas ? blocos(e.horas) : []).map(b => `${b.ini}–${b.fim}`).join(' e ') || `${e.aulas} aulas`}` +
      (e.local ? ` (${e.local})` : '')).join(' · ');
    linhas.push(
      '',
      `*${d.codigo}-${d.turma}* ${d.nome}`,
      ...(d.professor ? [`_${d.professor}_`] : []),
      `🗓 ${horario}`,
      `${s.emoji} ${estado.faltas[d.codigo] ?? 0}/${s.limite} faltas — ${s.texto}`,
    );
  }
  const eventos = [...(estado.eventos ?? [])].sort((a, b) => a.data.localeCompare(b.data));
  if (eventos.length) {
    linhas.push('', '📅 *Eventos*');
    for (const e of eventos) {
      const [, m, dd] = e.data.split('-');
      linhas.push(`• ${dd}/${m} ${TIPOS[e.tipo] ?? 'Lembrete'}${e.codigo ? ` ${e.codigo}` : ''}${e.texto ? `: ${e.texto}` : ''}`);
    }
  }
  linhas.push('', '_Cole esta mensagem no faltas.ufsc pra restaurar._');
  return linhas.join('\n');
}

export function lerRelatorio(texto) {
  const linhas = texto.replace(/\r/g, '').split('\n').map(l => l.trim());
  const perfil = {};
  const cab = linhas.find(l => /faltas\.ufsc\*?\s+—/.test(l));
  const mc = cab?.match(/—\s*(.+?)(?:\s*\((\d+)\))?$/);
  if (mc) [perfil.nome, perfil.matricula] = [mc[1], mc[2]];
  const ms = texto.match(/^(.*?)\s*·\s*(\d{4})\.(\d)\s*$/m);
  if (ms) [perfil.curso, perfil.semestre] = [ms[1].trim() || undefined, ms[2] + ms[3]];
  const ano = perfil.semestre?.slice(0, 4) ?? String(new Date().getFullYear());

  const disciplinas = [];
  const faltas = {};
  const eventos = [];
  let atual = null;
  for (const l of linhas) {
    let m;
    if ((m = l.match(/^\*?([A-Z]{3}\d{4})-(\w+)\*?\s+(.+)$/))) {
      atual = { codigo: m[1], turma: m[2], nome: m[3], professor: '', encontros: [] };
      disciplinas.push(atual);
    } else if (atual && (m = l.match(/^_(.+)_$/)) && !/faltas\.ufsc/.test(l)) {
      atual.professor = m[1];
    } else if (atual && l.startsWith('🗓')) {
      for (const parte of l.slice(2).split('·')) {
        const md = parte.trim().match(/^(\S+)\s+(.*?)(?:\s*\(([^)]+)\))?$/);
        const dia = md ? DIAS.indexOf(md[1]) : -1;
        if (dia < 0) continue;
        const horas = [];
        for (const [, ini, fim] of md[2].matchAll(/(\d{2}:\d{2})–(\d{2}:\d{2})/g)) {
          horas.push(...SLOTS.filter(s => min(s) >= min(ini) && min(s) < min(fim)));
        }
        const aulas = horas.length || Number(md[2].match(/(\d+) aulas/)?.[1]) || 0;
        atual.encontros.push({ dia, aulas, horas, local: md[3] ?? '' });
      }
    } else if (atual && (m = l.match(/(\d+)\s*\/\s*\d+\s*faltas/))) {
      faltas[atual.codigo] = Number(m[1]);
      atual = null;
    } else if ((m = l.match(/^•\s*(\d{2})\/(\d{2})\s+(\S+)(?:\s+([A-Z]{3}\d{4}))?(?::\s*(.*))?$/))) {
      const tipo = Object.keys(TIPOS).find(k => TIPOS[k] === m[3]) ?? 'outro';
      eventos.push({ id: `${ano}${m[2]}${m[1]}${eventos.length}`, data: `${ano}-${m[2]}-${m[1]}`, tipo, codigo: m[4] ?? '', texto: m[5] ?? '' });
    }
  }
  return { perfil, disciplinas, faltas, eventos };
}
