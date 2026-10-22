// Lê o texto copiado (Ctrl+A, Ctrl+C) da página "Grade de Horários" do CAGR.
//
// Cada linha da grade começa com o horário ("18:30") e em seguida vêm 6 células
// (Segunda..Sábado), uma por linha: célula vazia = linha em branco; célula com aula =
// "INE5625-06238" + linha com a sala ("CTC/CTC201"). Horários de fim de bloco aparecem
// colados ("11:00" / "11:50") e são tratados como uma linha só.

const RE_HORA = /^\d{2}:\d{2}$/;
const RE_CODIGO = /([A-Z]{3}\d{4})-(\w+)/;
const DIAS = 6;

export function parseGrade(texto) {
  const linhas = texto.replace(/\r/g, '').replace(/ /g, ' ').split('\n');
  const t = i => (linhas[i] ?? '').trim();

  const perfil = {};
  for (const l of linhas) {
    const a = l.match(/Aluno:\s*(.+?)\s*Matr[íi]cula:\s*(\d+)/);
    if (a) [perfil.nome, perfil.matricula] = [a[1], a[2]];
    const c = l.match(/Curso:\s*(.+?)\s*Semestre:\s*(\d{5})/);
    if (c) [perfil.curso, perfil.semestre] = [c[1], c[2]];
    const s = l.match(/Semestre:\s*(\d{5})/);
    if (s && !perfil.semestre) perfil.semestre = s[1];
  }

  const ini = linhas.findIndex(l => /Segunda/.test(l) && /S[áa]bado/.test(l));
  let fim = linhas.findIndex(l => /^\s*DISCIP/.test(l));
  if (fim < 0) fim = linhas.length;
  if (ini < 0) throw new Error('Não encontrei a grade de horários no texto colado.');

  const aulas = []; // { codigo, turma, local, dia (1=seg..6=sáb), hora }
  let diasConfiaveis = true;
  let j = ini + 1;
  while (j < fim) {
    if (!RE_HORA.test(t(j))) { j++; continue; }
    let hora = t(j);
    j++;
    if (RE_HORA.test(t(j))) j++; // "11:00" + "11:50": o bloco é o das 11:00

    const celulas = [];
    while (j < fim && celulas.length < DIAS && !RE_HORA.test(t(j))) {
      const m = t(j).match(RE_CODIGO);
      if (!t(j)) celulas.push(null);
      else if (m) {
        let local = '';
        if (t(j + 1) && !RE_HORA.test(t(j + 1)) && !RE_CODIGO.test(t(j + 1))) local = t(++j);
        celulas.push({ codigo: m[1], turma: m[2], local });
      }
      j++;
    }
    if (celulas.length !== DIAS) diasConfiaveis = false;
    celulas.forEach((c, i) => c && aulas.push({ ...c, dia: i + 1, hora }));
  }

  const info = {};
  for (let i = fim + 1; i < linhas.length; i++) {
    const m = linhas[i].match(/^\s*([A-Z]{3}\d{4})\s+(\w+)\s+(.*)$/);
    if (!m) continue;
    const [nome, professor = ''] = m[3].split(/\t|\s{2,}/).map(s => s.trim()).filter(Boolean);
    info[m[1]] = { turma: m[2], nome, professor };
  }

  const porCodigo = new Map();
  for (const a of aulas) {
    if (!porCodigo.has(a.codigo)) {
      porCodigo.set(a.codigo, {
        codigo: a.codigo,
        turma: a.turma,
        nome: info[a.codigo]?.nome ?? a.codigo,
        professor: info[a.codigo]?.professor ?? '',
        encontros: [],
      });
    }
    const d = porCodigo.get(a.codigo);
    const dia = diasConfiaveis ? a.dia : null;
    const e = d.encontros.find(x => x.dia === dia && dia != null) ?? (dia == null ? d.encontros[0] : undefined);
    if (e) {
      e.aulas++;
      e.horas.push(a.hora);
    } else d.encontros.push({ dia, aulas: 1, horas: [a.hora], local: a.local });
  }
  const disciplinas = [...porCodigo.values()];
  if (!disciplinas.length) throw new Error('Não encontrei nenhuma disciplina na grade.');
  for (const d of disciplinas) d.encontros.sort((a, b) => a.dia - b.dia);

  return { perfil, disciplinas, diasConfiaveis };
}
