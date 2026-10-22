import { parseGrade } from './parser.js';
import { SLOTS, TIPOS, montarRelatorio, lerRelatorio } from './relatorio.js';
import { CALENDARIOS, data, ehLetivo, iso, diasLetivosPorSemana, limiteFaltas } from './calendario.js';

const CHAVE = 'faltas-ufsc:v1';
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const $ = id => document.getElementById(id);

let estado = carregar();

function carregar() {
  try { return migrar(JSON.parse(localStorage.getItem(CHAVE))); } catch { return null; }
}

function migrar(e) {
  // versão anterior guardava dias faltados por dia da semana: { [dia]: n, avulsas }
  for (const d of e?.disciplinas ?? []) {
    const f = e.faltas?.[d.codigo];
    if (f && typeof f === 'object') {
      e.faltas[d.codigo] = d.encontros.reduce((s, x) => s + (f[String(x.dia ?? 'x')] ?? 0) * x.aulas, f.avulsas ?? 0);
    }
    if (typeof e.faltas?.[d.codigo] === 'number') e.faltas[d.codigo] = Math.ceil(e.faltas[d.codigo]); // não há mais meia falta
  }
  return e;
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

$('btn-importar').onclick = async () => {
  try {
    const texto = $('texto').value.trim();
    if (/faltas\.ufsc/.test(texto)) {
      const r = lerRelatorio(texto);
      if (!r.disciplinas.length) throw new Error('Não achei disciplinas nesse relatório.');
      if (estado && !confirm(`Restaurar o relatório de ${r.perfil.nome ?? 'aluno'}? Isso substitui os dados deste aparelho.`)) return;
      estado = { ...r, diasConfiaveis: r.disciplinas.every(d => d.encontros.length) };
      salvar();
      $('importar').hidden = true;
      render();
      avisar('Relatório restaurado.');
      return;
    }
    const { perfil, disciplinas, diasConfiaveis } = parseGrade(texto);
    const faltas = {};
    for (const d of disciplinas) faltas[d.codigo] = estado?.faltas?.[d.codigo] ?? 0;
    estado = { perfil, disciplinas, diasConfiaveis, faltas, eventos: estado?.eventos ?? [] };
    salvar();
    $('importar').hidden = true;
    render();
  } catch (e) {
    $('erro').textContent = e.message;
    $('erro').hidden = false;
  }
};
$('btn-cancelar').onclick = () => { $('importar').hidden = true; };

// ---------- relatório / backup ----------

function situacao(d) {
  const cal = calendario();
  const { limite } = cal ? limiteFaltas(cal, d.encontros) : { limite: Math.floor(18 * aulasSemana(d) * 0.25) };
  const sobra = limite - faltasDe(d);
  const menor = Math.min(...d.encontros.map(e => e.aulas));
  const pct = limite ? faltasDe(d) / limite : 1;
  if (sobra < 0) return { emoji: '❌', texto: 'reprovado por falta', limite };
  if (sobra < menor) return { emoji: '⚠️', texto: sobra ? `no limite (cabe${sobra > 1 ? 'm' : ''} ${plural(sobra, 'aula')})` : 'no limite', limite };
  return { emoji: pct >= 0.75 ? '🟡' : '✅', texto: `pode faltar mais ${plural(Math.floor(sobra / menor), 'dia')}`, limite };
}

$('btn-backup').onclick = async () => {
  const msg = montarRelatorio(estado, situacao, calendario()?.rotulo ?? estado.perfil?.semestre);
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ text: msg }); return; } catch { /* cancelou: cai no copiar */ }
  }
  try {
    await navigator.clipboard.writeText(msg);
    avisar('Relatório copiado! Cole no WhatsApp.');
  } catch {
    prompt('Copie o relatório:', msg);
  }
};

function avisar(txt) {
  const t = $('toast');
  t.textContent = txt;
  t.hidden = false;
  clearTimeout(avisar.timer);
  avisar.timer = setTimeout(() => { t.hidden = true; }, 3500);
}

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

// Faltas = total de aulas faltadas na disciplina, como os pontos de presença do Moodle
// (atraso/meia presença = 1). "+2"/"+4" lança um encontro inteiro de uma vez.

function faltasDe(d) {
  return Number(estado.faltas[d.codigo]) || 0;
}

// Maior total de faltas alcançável sem passar do limite, faltando só dias inteiros.
function maxAlcancavel(limite, passos) {
  const ok = [true];
  for (let v = 1; v <= limite; v++) ok[v] = passos.some(p => p <= v && ok[v - p]);
  return ok.lastIndexOf(true);
}

function plural(n, s, p = s + 's') {
  return `${n} ${n === 1 ? s : p}`;
}


function renderDisciplinas(cal) {
  const hoje = iso(new Date());
  const restantesPorDia = cal ? diasLetivosPorSemana(cal, hoje) : null;
  const n = estado.disciplinas.length;
  $('disciplinas').style.setProperty('--cols', Math.ceil(n / Math.ceil(n / 4)));

  $('disciplinas').innerHTML = estado.disciplinas.map((d, i) => {
    const { total, limite } = cal ? limiteFaltas(cal, d.encontros) : { total: 18 * aulasSemana(d), limite: Math.floor(18 * aulasSemana(d) * 0.25) };
    const passos = [...new Set(d.encontros.map(e => e.aulas))].sort((a, b) => b - a);
    const menor = Math.min(...passos);
    const faltas = faltasDe(d);
    const sobra = limite - faltas;
    const pct = Math.min(100, limite ? (faltas / limite) * 100 : 100);
    const nivel = sobra < 0 ? 'reprovado' : sobra < menor ? 'limite' : pct >= 75 ? 'alerta' : 'ok';
    const maior = Math.max(...passos);
    const diasMin = Math.max(0, Math.floor(sobra / maior));
    const diasMax = Math.max(0, Math.floor(sobra / menor));
    const emDias = n => passos.length > 1
      ? plural(n, 'aula')
      : [Math.floor(n / menor) && plural(Math.floor(n / menor), 'dia'), n % menor && plural(n % menor, 'aula')].filter(Boolean).join(' e ') || '0 dias';
    const diasTxt = diasMin === diasMax ? `${diasMax}` : `${diasMin}–${diasMax}`;
    const status = nivel === 'reprovado'
      ? `Passou do limite (${limite} aulas): reprovação por frequência (FI).`
      : nivel === 'limite'
        ? sobra > 0
          ? `Faltar mais um dia inteiro reprova. Ainda cabe${sobra > 1 ? 'm' : ''} ${plural(sobra, 'aula')} (atrasos).`
          : 'No limite: mais uma aula perdida reprova.'
        : `Ainda pode perder <strong>${plural(sobra, 'aula')}</strong>${passos.length > 1 ? ` (dias de ${maior} ou ${menor} aulas)` : ''}.`;
    const soDias = maxAlcancavel(limite, passos);
    const restantes = restantesPorDia
      ? d.encontros.reduce((s, e) => s + (e.dia == null ? 0 : restantesPorDia[e.dia] * e.aulas), 0)
      : null;
    const cod = esc(d.codigo);

    return `
      <article class="cartao disc nivel-${nivel}" style="--cor: var(--c${i % 6})">
        <header>
          <span class="codigo">${cod}</span>
          <h3>${esc(d.nome)}</h3>
          <p class="muted">${esc(d.professor)}</p>
        </header>
        <div class="encontros">
          ${d.encontros.map((e, k) => e.dia == null ? `
            <label class="chip">
              <select data-cod="${cod}" data-k="${k}" aria-label="Dia da semana">
                <option value="">dia?</option>
                ${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}">${DIAS_CURTO[n]}</option>`).join('')}
              </select>
              ${plural(e.aulas, 'aula')}
            </label>` : '').join('')}
          ${resumoDias(d)}
        </div>
        <div class="placar">
          <span class="numero">${nivel === 'reprovado' ? '—' : diasTxt}</span>
          <span class="muted">${nivel === 'reprovado' ? 'reprovado por falta' : `dia${diasMax === 1 ? '' : 's'} que ainda pode faltar`}</span>
        </div>
        <div class="barra"><span style="width:${pct}%"></span></div>
        <div class="dias-falta">
          <div class="linha-dia">
            <span class="rotulo">Aulas perdidas</span>
            <button data-cod="${cod}" data-delta="-1" aria-label="Tirar uma aula perdida" ${faltas >= 1 ? '' : 'disabled'}>−</button>
            <input type="number" min="0" inputmode="numeric" value="${faltas}" data-cod="${cod}" aria-label="Aulas perdidas em ${cod}">
            <button data-cod="${cod}" data-delta="1" aria-label="Mais uma aula perdida">+</button>
          </div>
        </div>
        <p class="faltas-txt">= <strong>${emDias(faltas)}</strong> faltado${faltas === 1 ? '' : 's'} · limite ${limite} aulas</p>
        <p class="status">${status}</p>
        <p class="muted pequeno">${total} aulas no semestre · limite 25% = ${limite}${soDias !== limite ? ` (faltando só encontros inteiros, ${soDias})` : ''}${restantes != null ? ` · ${restantes} ainda por vir` : ''}</p>
      </article>`;
  }).join('');
}

function resumoDias(d) {
  const conhecidos = d.encontros.filter(e => e.dia != null);
  if (!conhecidos.length) return '';
  const uniforme = conhecidos.every(e => e.aulas === conhecidos[0].aulas);
  return uniforme
    ? `<span class="chip">${conhecidos.map(e => DIAS_CURTO[e.dia]).join(' · ')} — ${conhecidos[0].aulas} aulas/dia</span>`
    : conhecidos.map(e => `<span class="chip">${DIAS_CURTO[e.dia]} — ${plural(e.aulas, 'aula')}</span>`).join('');
}

function aulasSemana(d) {
  return d.encontros.reduce((s, e) => s + e.aulas, 0);
}

$('disciplinas').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-delta]');
  if (!b) return;
  const cod = b.dataset.cod;
  estado.faltas[cod] = Math.max(0, (Number(estado.faltas[cod]) || 0) + Number(b.dataset.delta));
  salvar();
  render();
});

$('disciplinas').addEventListener('change', ev => {
  const el = ev.target;
  if (el.matches('input[type=number]')) {
    estado.faltas[el.dataset.cod] = Math.max(0, Math.floor(Number(el.value)) || 0);
    salvar();
    render();
  }
  if (el.matches('select')) {
    const d = estado.disciplinas.find(x => x.codigo === el.dataset.cod);
    d.encontros[Number(el.dataset.k)].dia = el.value ? Number(el.value) : null;
    if (estado.disciplinas.every(x => x.encontros.every(e => e.dia != null))) estado.diasConfiaveis = true;
    salvar();
    render();
  }
});

// ---------- semana (estilo agenda) ----------

let segundaRef = null;

function segundaDe(d) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

function minutos(h) {
  const [H, M] = h.split(':').map(Number);
  return H * 60 + M;
}

function fimAula(h) {
  const t = minutos(h) + 50;
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

  // blocos: aulas seguidas (intervalo de até 10 min) da mesma disciplina no mesmo dia viram um bloco só
  const blocos = [];
  estado.disciplinas.forEach((disc, i) => {
    for (const e of disc.encontros) {
      if (e.dia == null || !e.horas) continue;
      const idx = e.horas.map(h => SLOTS.indexOf(h)).filter(n => n >= 0).sort((a, b) => a - b);
      for (let k = 0; k < idx.length; k++) {
        const b = blocos.at(-1);
        if (k > 0 && b && minutos(SLOTS[idx[k]]) - minutos(SLOTS[idx[k - 1]]) <= 60) b.fim = idx[k];
        else blocos.push({ disc, i, dia: e.dia, local: e.local, ini: idx[k], fim: idx[k] });
      }
    }
  });

  const semHoras = estado.disciplinas.some(d => d.encontros.some(e => e.dia != null && !e.horas));
  const usados = blocos.flatMap(b => [b.ini, b.fim]);
  const min = usados.length ? Math.min(...usados) : SLOTS.indexOf('18:30');
  const max = usados.length ? Math.max(...usados) : SLOTS.length - 1;
  const L0 = 3; // linha 1 = cabeçalho, linha 2 = eventos de dia inteiro

  const dom = new Date(segundaRef);
  dom.setDate(dom.getDate() + 6);
  $('sem-rotulo').textContent = `${ddmm(segundaRef)} a ${ddmm(dom)}` + (semHoras ? ' · reimporte a grade para ver os horários' : '');

  let html = `<div class="sem-canto"></div>`;
  for (let o = 0; o < 7; o++) {
    const d = new Date(segundaRef);
    d.setDate(d.getDate() + o);
    const s = iso(d);
    const feriado = cal.naoLetivos[s];
    const fora = s < cal.inicio || s > cal.fim;
    const cls = [feriado && 'feriado', (fora || o === 6) && 'fora', s === hoje && 'hoje'].filter(Boolean).join(' ');
    html += `<div class="sem-cab ${cls}" style="grid-column:${o + 2}">
      <span class="sem-dia">${DIAS_CURTO[d.getDay()]}</span><span class="sem-num">${d.getDate()}</span>
    </div>`;
    html += `<div class="sem-eventos" style="grid-column:${o + 2}">${chipsDoDia(cal, s, fora && o < 6)}</div>`;
    html += `<div class="sem-col ${cls}" style="grid-column:${o + 2};grid-row:${L0} / span ${max - min + 1}"></div>`;
  }
  for (let r = min; r <= max; r++) {
    html += `<div class="sem-hora" style="grid-row:${r - min + L0}">${SLOTS[r]}</div>`;
  }
  for (const b of blocos) {
    const d = new Date(segundaRef);
    d.setDate(d.getDate() + b.dia - 1);
    const cancelada = !ehLetivo(cal, d);
    html += `<div class="sem-aula ${cancelada ? 'cancelada' : ''}" style="--cor: var(--c${b.i % 6});grid-column:${b.dia + 1};grid-row:${b.ini - min + L0} / span ${b.fim - b.ini + 1}"
      title="${esc(b.disc.nome)}${cancelada ? ' (sem aula)' : ''}">
      <strong>${esc(b.disc.codigo)}</strong>
      <span class="sem-nome">${esc(b.disc.nome)}</span>
      <span class="sem-info">${SLOTS[b.ini]}–${fimAula(SLOTS[b.fim])}${b.local ? ` · ${esc(b.local.replace(/^.*\//, ''))}` : ''}</span>
    </div>`;
  }
  $('semana').style.gridTemplateRows = `auto auto repeat(${max - min + 1}, minmax(34px, auto))`;
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


function meusEventos(s) {
  return (estado.eventos ?? []).filter(e => e.data === s);
}

// Evento ligado a uma disciplina usa a cor dela.
function corDoEvento(e) {
  const i = estado.disciplinas.findIndex(d => d.codigo === e.codigo);
  return i >= 0 ? `--meu: var(--c${i % 6}); --meu-bg: color-mix(in srgb, var(--c${i % 6}) 22%, var(--card))` : '';
}

function rotuloMeu(e) {
  return `${TIPOS[e.tipo] ?? 'Evento'}${e.codigo ? ` ${e.codigo}` : ''}${e.texto ? `: ${e.texto}` : ''}`;
}

function chipsDoDia(cal, s, fora) {
  const out = [];
  if (cal.naoLetivos[s]) out.push(`<span class="chip-ev feriado">${esc(cal.naoLetivos[s])} · sem aula</span>`);
  const ev = eventoDoDia(cal, s);
  if (ev) out.push(`<span class="chip-ev evento">${esc(ev.texto)}</span>`);
  if (fora && !cal.naoLetivos[s]) out.push('<span class="chip-ev fora">Fora do semestre</span>');
  for (const e of meusEventos(s)) out.push(`<span class="chip-ev meu ${e.tipo}" style="${corDoEvento(e)}" title="${esc(rotuloMeu(e))}">${esc(rotuloMeu(e))}</span>`);
  return out.join('');
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
        aulas.length && 'aula', s === hoje && 'hoje', s < hoje && 'passado', meusEventos(s).length && 'meu',
      ].filter(Boolean).join(' ');
      html += `<button class="dia ${cls}" data-dia="${s}" title="${esc([feriado, evento?.texto, ...meusEventos(s).map(rotuloMeu)].filter(Boolean).join(' · '))}">${d.getDate()}</button>`;
    }
    html += '</div></div>';
  }
  $('calendario').innerHTML = html;

  const datas = [
    ...Object.entries(cal.naoLetivos).map(([de, texto]) => ({ de, ate: de, texto, tipo: 'feriado' })),
    ...cal.eventos.map(e => ({ ...e, tipo: 'evento' })),
    ...(estado.eventos ?? []).map(e => ({ de: e.data, ate: e.data, texto: rotuloMeu(e), tipo: `meu ${e.tipo}`, id: e.id })),
  ].filter(x => x.ate >= hoje).sort((x, y) => x.de.localeCompare(y.de));
  const quando = (de, ate) => {
    const d = data(de);
    return de === ate ? `${ddmm(d)} · ${DIAS_CURTO[d.getDay()]}` : `${ddmm(d)} a ${ddmm(data(ate))}`;
  };
  $('feriados').innerHTML = datas.length
    ? datas.map(x => `<li class="${x.tipo}"><span>${quando(x.de, x.ate)}</span> ${esc(x.texto)}${x.id ? ` <button class="remover" data-id="${x.id}" aria-label="Remover">×</button>` : ''}</li>`).join('')
    : '<li class="muted">Nada até o fim do semestre.</li>';
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
  for (const e of meusEventos(s)) partes.push(`<strong>${esc(rotuloMeu(e))}</strong>`);
  if (ehLetivo(cal, d)) {
    const aulas = aulasDoDia(d);
    partes.push(aulas.length
      ? aulas.map(a => `<span class="tag" style="--cor: var(--c${a.i % 6})">${esc(a.disc.codigo)}</span> ${a.n} aula${a.n > 1 ? 's' : ''}`).join(' · ')
      : 'sem aulas suas');
  } else if (!cal.naoLetivos[s]) partes.push('fora do período letivo');
  $('dia-detalhe').innerHTML = `<strong>${titulo}</strong>: ${partes.join(' · ')}`;
  segundaRef = segundaDe(d);
  $('ev-data').value = s;
  renderSemana(cal);
});

// ---------- eventos do usuário ----------

$('btn-evento').onclick = () => {
  const f = $('form-evento');
  f.hidden = !f.hidden;
  if (f.hidden) return;
  if (!$('ev-data').value) $('ev-data').value = iso(new Date());
  $('ev-disc').innerHTML = '<option value="">Sem disciplina</option>' +
    estado.disciplinas.map(d => `<option value="${esc(d.codigo)}">${esc(d.codigo)} · ${esc(d.nome)}</option>`).join('');
  $('ev-texto').focus();
};

$('form-evento').onsubmit = ev => {
  ev.preventDefault();
  if (!$('ev-data').value) return;
  estado.eventos ??= [];
  estado.eventos.push({
    id: Date.now().toString(36),
    data: $('ev-data').value,
    tipo: $('ev-tipo').value,
    codigo: $('ev-disc').value,
    texto: $('ev-texto').value.trim(),
  });
  $('ev-texto').value = '';
  $('form-evento').hidden = true;
  segundaRef = segundaDe(data($('ev-data').value));
  salvar();
  render();
};
$('ev-cancelar').onclick = () => { $('form-evento').hidden = true; };

$('feriados').addEventListener('click', ev => {
  const b = ev.target.closest('button.remover');
  if (!b) return;
  estado.eventos = estado.eventos.filter(e => e.id !== b.dataset.id);
  salvar();
  render();
});

// ---------- tema ----------

const TEMAS = [['', '◐ Auto'], ['light', '☀ Claro'], ['dark', '☾ Escuro']];
function aplicarTema(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  $('btn-tema').textContent = TEMAS.find(x => x[0] === t)[1];
  try { t ? localStorage.setItem('faltas-ufsc:tema', t) : localStorage.removeItem('faltas-ufsc:tema'); } catch { /* nada */ }
}
$('btn-tema').onclick = () => {
  const atual = document.documentElement.dataset.theme ?? '';
  aplicarTema(TEMAS[(TEMAS.findIndex(x => x[0] === atual) + 1) % TEMAS.length][0]);
};
aplicarTema(document.documentElement.dataset.theme ?? '');

render();
