import { parseGrade } from './parser.js';
import { CALENDARIOS, data, ehLetivo, iso, diasLetivosPorSemana, limiteFaltas } from './calendario.js';

const CHAVE = 'faltas-ufsc:v1';
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const $ = id => document.getElementById(id);

let estado = carregar();

function carregar() {
  try { return JSON.parse(localStorage.getItem(CHAVE)); } catch { return null; }
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch { /* modo privado: segue sem salvar */ }
}

function calendario() {
  return CALENDARIOS[estado?.perfil?.semestre];
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// ---------- importação ----------

function mostrarImportar(cancelavel) {
  $('importar').hidden = false;
  $('painel').hidden = !cancelavel;
  $('btn-cancelar').hidden = !cancelavel;
  $('erro').hidden = true;
  $('texto').value = '';
  $('texto').focus();
}

$('btn-importar').onclick = () => {
  try {
    const { perfil, disciplinas, diasConfiaveis } = parseGrade($('texto').value);
    const faltas = {};
    for (const d of disciplinas) faltas[d.codigo] = estado?.faltas?.[d.codigo] ?? 0;
    estado = { perfil, disciplinas, diasConfiaveis, faltas };
    salvar();
    $('importar').hidden = true;
    render();
  } catch (e) {
    $('erro').textContent = e.message;
    $('erro').hidden = false;
  }
};
$('btn-cancelar').onclick = () => { $('importar').hidden = true; };
$('btn-reimportar').onclick = () => mostrarImportar(true);
$('btn-apagar').onclick = () => {
  if (!confirm('Apagar a grade e as faltas salvas neste navegador?')) return;
  estado = null;
  try { localStorage.removeItem(CHAVE); } catch { /* nada */ }
  render();
};

// ---------- painel ----------

function render() {
  if (!estado) { mostrarImportar(false); return; }
  $('painel').hidden = false;
  const { perfil } = estado;
  const cal = calendario();
  $('p-nome').textContent = perfil.nome ?? 'Aluno';
  $('p-detalhes').textContent = [
    perfil.matricula && `Matrícula ${perfil.matricula}`,
    perfil.curso,
    perfil.semestre && `Semestre ${cal?.rotulo ?? perfil.semestre}`,
  ].filter(Boolean).join(' · ');

  const avisos = [];
  if (!cal) avisos.push(`Ainda não tenho o calendário do semestre ${esc(perfil.semestre)}; o limite foi estimado com 18 semanas sem feriados.`);
  if (!estado.diasConfiaveis) avisos.push('Não deu pra identificar os dias da semana de cada aula. Ajuste os dias nos cartões abaixo pra o limite considerar os feriados.');
  $('aviso').innerHTML = avisos.join('<br>');
  $('aviso').hidden = !avisos.length;

  renderDisciplinas(cal);
  if (cal) {
    renderSemana(cal);
    renderCalendario(cal);
  }
}

function renderDisciplinas(cal) {
  const hoje = iso(new Date());
  const restantesPorDia = cal ? diasLetivosPorSemana(cal, hoje) : null;

  $('disciplinas').innerHTML = estado.disciplinas.map((d, i) => {
    const { total, limite } = cal ? limiteFaltas(cal, d.encontros) : { total: 18 * aulasSemana(d), limite: Math.floor(18 * aulasSemana(d) * 0.25) };
    const faltas = estado.faltas[d.codigo] ?? 0;
    const sobra = limite - faltas;
    const porDia = Math.max(...d.encontros.map(e => e.aulas));
    const pct = Math.min(100, limite ? (faltas / limite) * 100 : 100);
    const nivel = sobra < 0 ? 'reprovado' : sobra === 0 ? 'limite' : pct >= 75 ? 'alerta' : 'ok';
    const status = sobra < 0
      ? `Passou do limite em ${-sobra} aula${-sobra > 1 ? 's' : ''}: reprovação por frequência (FI).`
      : sobra === 0
        ? 'No limite: mais uma falta e reprova.'
        : `Pode faltar mais <strong>${sobra}</strong> aula${sobra > 1 ? 's' : ''}` +
          (porDia > 1 && sobra >= porDia ? ` (≈ ${Math.floor(sobra / porDia)} dia${Math.floor(sobra / porDia) === 1 ? '' : 's'} de ${porDia} aulas).` : '.');
    const restantes = restantesPorDia
      ? d.encontros.reduce((s, e) => s + (e.dia == null ? 0 : restantesPorDia[e.dia] * e.aulas), 0)
      : null;

    return `
      <article class="cartao disc nivel-${nivel}" style="--cor: var(--c${i % 6})">
        <header>
          <span class="codigo">${esc(d.codigo)}</span>
          <h3>${esc(d.nome)}</h3>
          <p class="muted">${esc(d.professor)}</p>
        </header>
        <div class="encontros">
          ${d.encontros.map((e, k) => `
            <label class="chip">
              <select data-cod="${esc(d.codigo)}" data-k="${k}" aria-label="Dia da semana">
                ${e.dia == null ? '<option value="">dia?</option>' : ''}
                ${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${e.dia === n ? 'selected' : ''}>${DIAS_CURTO[n]}</option>`).join('')}
              </select>
              ${e.aulas} aula${e.aulas > 1 ? 's' : ''}
            </label>`).join('')}
        </div>
        <div class="contador">
          <button class="menos" data-cod="${esc(d.codigo)}" data-delta="-1" aria-label="Tirar uma falta">−</button>
          <div class="numero">
            <input type="number" min="0" inputmode="numeric" value="${faltas}" data-cod="${esc(d.codigo)}" aria-label="Faltas em ${esc(d.codigo)}">
            <span class="muted">de ${limite} faltas</span>
          </div>
          <button class="mais" data-cod="${esc(d.codigo)}" data-delta="1" aria-label="Somar uma falta">+1</button>
          ${porDia > 1 ? `<button class="mais" data-cod="${esc(d.codigo)}" data-delta="${porDia}" aria-label="Somar um dia de aula">+${porDia}</button>` : ''}
        </div>
        <div class="barra"><span style="width:${pct}%"></span></div>
        <p class="status">${status}</p>
        <p class="muted pequeno">${total} aulas no semestre${restantes != null ? ` · ${restantes} ainda por vir` : ''}</p>
      </article>`;
  }).join('');
}

function aulasSemana(d) {
  return d.encontros.reduce((s, e) => s + e.aulas, 0);
}

function setFaltas(cod, n) {
  estado.faltas[cod] = Math.max(0, Number.isFinite(n) ? Math.floor(n) : 0);
  salvar();
  render();
}

$('disciplinas').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-delta]');
  if (b) setFaltas(b.dataset.cod, (estado.faltas[b.dataset.cod] ?? 0) + Number(b.dataset.delta));
});

$('disciplinas').addEventListener('change', ev => {
  const el = ev.target;
  if (el.matches('input[type=number]')) setFaltas(el.dataset.cod, Number(el.value));
  if (el.matches('select')) {
    const d = estado.disciplinas.find(x => x.codigo === el.dataset.cod);
    d.encontros[Number(el.dataset.k)].dia = el.value ? Number(el.value) : null;
    if (estado.disciplinas.every(x => x.encontros.every(e => e.dia != null))) estado.diasConfiaveis = true;
    salvar();
    render();
  }
});

// ---------- semana (estilo agenda) ----------

const SLOTS = ['07:30', '08:20', '09:10', '10:10', '11:00', '13:30', '14:20', '15:10', '16:20', '17:10', '18:30', '19:20', '20:20', '21:10'];
let segundaRef = null;

function segundaDe(d) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

function fimAula(h) {
  const [H, M] = h.split(':').map(Number);
  const t = H * 60 + M + 50;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function ddmm(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function semanaInicial(cal) {
  const hoje = iso(new Date());
  if (hoje < cal.inicio) return segundaDe(data(cal.inicio));
  if (hoje > cal.fim) return segundaDe(data(cal.fim));
  return segundaDe(new Date());
}

function renderSemana(cal) {
  segundaRef ??= semanaInicial(cal);
  const hoje = iso(new Date());

  // blocos: aulas consecutivas da mesma disciplina no mesmo dia viram um bloco só
  const blocos = [];
  estado.disciplinas.forEach((disc, i) => {
    for (const e of disc.encontros) {
      if (e.dia == null || !e.horas) continue;
      const idx = e.horas.map(h => SLOTS.indexOf(h)).filter(n => n >= 0).sort((a, b) => a - b);
      for (let k = 0; k < idx.length; k++) {
        const b = blocos.at(-1);
        if (k > 0 && idx[k] === idx[k - 1] + 1 && b) b.fim = idx[k];
        else blocos.push({ disc, i, dia: e.dia, local: e.local, ini: idx[k], fim: idx[k] });
      }
    }
  });

  const semHoras = estado.disciplinas.some(d => d.encontros.some(e => e.dia != null && !e.horas));
  const usados = blocos.flatMap(b => [b.ini, b.fim]);
  const min = usados.length ? Math.min(...usados) : SLOTS.indexOf('18:30');
  const max = usados.length ? Math.max(...usados) : SLOTS.length - 1;

  const sab = new Date(segundaRef);
  sab.setDate(sab.getDate() + 5);
  $('sem-rotulo').textContent = `${ddmm(segundaRef)} a ${ddmm(sab)}` + (semHoras ? ' · reimporte a grade para ver os horários' : '');

  let html = `<div class="sem-canto"></div>`;
  for (let n = 1; n <= 6; n++) {
    const d = new Date(segundaRef);
    d.setDate(d.getDate() + n - 1);
    const s = iso(d);
    const feriado = cal.naoLetivos[s];
    const evento = eventoDoDia(cal, s);
    const fora = s < cal.inicio || s > cal.fim;
    const cls = [feriado && 'feriado', fora && 'fora', s === hoje && 'hoje'].filter(Boolean).join(' ');
    html += `<div class="sem-cab ${cls}" style="grid-column:${n + 1}">
      <span class="sem-dia">${DIAS_CURTO[n]}</span><span class="sem-num">${d.getDate()}</span>
      ${feriado ? `<span class="sem-tag feriado">${esc(feriado)}</span>` : evento ? `<span class="sem-tag evento">${esc(evento.texto)}</span>` : fora ? '<span class="sem-tag">sem aulas</span>' : ''}
    </div>`;
    html += `<div class="sem-col ${cls}" style="grid-column:${n + 1};grid-row:2 / span ${max - min + 1}"></div>`;
  }
  for (let r = min; r <= max; r++) {
    html += `<div class="sem-hora" style="grid-row:${r - min + 2}">${SLOTS[r]}</div>`;
  }
  for (const b of blocos) {
    const d = new Date(segundaRef);
    d.setDate(d.getDate() + b.dia - 1);
    const cancelada = !ehLetivo(cal, d);
    html += `<div class="sem-aula ${cancelada ? 'cancelada' : ''}" style="--cor: var(--c${b.i % 6});grid-column:${b.dia + 1};grid-row:${b.ini - min + 2} / span ${b.fim - b.ini + 1}"
      title="${esc(b.disc.nome)}${cancelada ? ' (sem aula)' : ''}">
      <strong>${esc(b.disc.codigo)}</strong>
      <span class="sem-nome">${esc(b.disc.nome)}</span>
      <span class="sem-info">${SLOTS[b.ini]}–${fimAula(SLOTS[b.fim])}${b.local ? ` · ${esc(b.local.replace(/^.*\//, ''))}` : ''}</span>
    </div>`;
  }
  $('semana').style.gridTemplateRows = `auto repeat(${max - min + 1}, minmax(34px, auto))`;
  $('semana').innerHTML = html;
}

function moverSemana(dias) {
  segundaRef.setDate(segundaRef.getDate() + dias);
  renderSemana(calendario());
}
$('sem-ant').onclick = () => moverSemana(-7);
$('sem-prox').onclick = () => moverSemana(7);
$('sem-hoje').onclick = () => { segundaRef = semanaInicial(calendario()); renderSemana(calendario()); };

// ---------- calendário ----------

function aulasDoDia(d) {
  const out = [];
  estado.disciplinas.forEach((disc, i) => {
    const n = disc.encontros.filter(e => e.dia === d.getDay()).reduce((s, e) => s + e.aulas, 0);
    if (n) out.push({ disc, n, i });
  });
  return out;
}

function eventoDoDia(cal, s) {
  return cal.eventos.find(e => s >= e.de && s <= e.ate);
}

function renderCalendario(cal) {
  $('cal-rotulo').textContent = cal.rotulo;
  const hoje = iso(new Date());
  const ini = data(cal.inicio);
  const fim = data(cal.fim);
  let html = '';
  for (let m = new Date(ini.getFullYear(), ini.getMonth(), 1); m <= fim; m.setMonth(m.getMonth() + 1)) {
    html += `<div class="mes"><h4>${MESES[m.getMonth()]}</h4><div class="dias">`;
    html += DIAS_CURTO.map(d => `<span class="cab">${d[0]}</span>`).join('');
    html += '<span></span>'.repeat(m.getDay());
    for (const d = new Date(m); d.getMonth() === m.getMonth(); d.setDate(d.getDate() + 1)) {
      const s = iso(d);
      const dentro = s >= cal.inicio && s <= cal.fim;
      const feriado = cal.naoLetivos[s];
      const evento = eventoDoDia(cal, s);
      const aulas = dentro && ehLetivo(cal, d) ? aulasDoDia(d) : [];
      const cls = [
        !dentro && 'fora', feriado && 'feriado', evento && 'evento',
        aulas.length && 'aula', s === hoje && 'hoje', s < hoje && 'passado',
      ].filter(Boolean).join(' ');
      html += `<button class="dia ${cls}" data-dia="${s}" title="${esc(feriado || evento?.texto || '')}">${d.getDate()}</button>`;
    }
    html += '</div></div>';
  }
  $('calendario').innerHTML = html;

  const proximos = Object.entries(cal.naoLetivos).filter(([s]) => s >= hoje);
  $('feriados').innerHTML = proximos.length
    ? proximos.map(([s, nome]) => {
      const d = data(s);
      return `<li><span>${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ${DIAS_CURTO[d.getDay()]}</span> ${esc(nome)}</li>`;
    }).join('')
    : '<li class="muted">Nenhum feriado até o fim do semestre.</li>';
}

$('calendario').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-dia]');
  if (!b) return;
  const cal = calendario();
  const d = data(b.dataset.dia);
  const s = b.dataset.dia;
  const titulo = `${DIAS_CURTO[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const partes = [];
  if (cal.naoLetivos[s]) partes.push(`${esc(cal.naoLetivos[s])}: sem aula`);
  const ev2 = eventoDoDia(cal, s);
  if (ev2) partes.push(esc(ev2.texto));
  if (ehLetivo(cal, d)) {
    const aulas = aulasDoDia(d);
    partes.push(aulas.length
      ? aulas.map(a => `<span class="tag" style="--cor: var(--c${a.i % 6})">${esc(a.disc.codigo)}</span> ${a.n} aula${a.n > 1 ? 's' : ''}`).join(' · ')
      : 'sem aulas suas');
  } else if (!cal.naoLetivos[s]) partes.push('fora do período letivo');
  $('dia-detalhe').innerHTML = `<strong>${titulo}</strong>: ${partes.join(' · ')}`;
  segundaRef = segundaDe(d);
  renderSemana(cal);
});

render();
