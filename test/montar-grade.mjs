// Monta texto no formato do Ctrl+A/Ctrl+C da Grade de Horários do CAGR.

const LINHAS = ['07:30', '08:20', '09:10', '10:10', '11:00\n11:50', '13:30', '14:20', '15:10', '16:20', '17:10\n18:00', '18:30', '19:20', '20:20', '21:10\n22:00'];

export function montarGrade(aulas) { // aulas: { 'MTM3101-01208': { 1: ['07:30', ...], ... } }
  let txt = 'Aluno:\tFulana\tMatrícula:\t22100000\nCurso:\tENGENHARIA CIVIL\tSemestre:\t20262\n\nSegunda\tTerça\tQuarta\tQuinta\tSexta\tSábado\n';
  for (const l of LINHAS) {
    txt += l + '\t\n';
    const hora = l.slice(0, 5);
    for (let dia = 1; dia <= 6; dia++) {
      const cod = Object.keys(aulas).find(c => aulas[c][dia]?.includes(hora));
      txt += cod ? `${cod}  \nCTC/SALA${dia}\n` : '\n';
    }
  }
  txt += '\nDISCIP.\tTURMA\tNOME DA DISCIPLINA\tPROFESSOR\n';
  for (const c of Object.keys(aulas)) txt += `${c.slice(0, 7)}\t${c.slice(8)}\tDisciplina ${c.slice(0, 7)}\tProf ${c.slice(0, 3)}\n`;
  return txt;
}

export const GRADE_DIURNA = {
  'MTM3101-01208': { 1: ['07:30', '08:20', '09:10', '10:10'], 3: ['07:30', '08:20'] },
  'FSC5101-02208': { 2: ['13:30', '14:20', '15:10'], 4: ['13:30', '14:20', '15:10'] },
  'QMC5125-03208': { 5: ['10:10', '11:00'], 6: ['08:20', '09:10'] },
  'ECV5215-04208': { 2: ['07:30', '08:20', '16:20', '17:10'] },
};
