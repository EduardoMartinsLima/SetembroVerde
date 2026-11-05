// Gerador de dados FICTÍCIOS para demonstração (npm run demo).
// Serve só para visualizar o painel sem acesso ao SurveyCTO. O painel exibe
// uma faixa "DADOS DE DEMONSTRAÇÃO" enquanto este modo estiver ativo.

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (arr, w) => {
  if (!w) return arr[Math.floor(rnd() * arr.length)];
  const t = w.reduce((a, b) => a + b, 0);
  let r = rnd() * t;
  for (let i = 0; i < arr.length; i++) if ((r -= w[i]) < 0) return arr[i];
  return arr[arr.length - 1];
};
const multi = (vals, p) => vals.filter(() => rnd() < p).join(' ') || vals[0];

const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function sctoDate(d) {
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const p = (n) => String(n).padStart(2, '0');
  return `${MESES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h}:${p(d.getMinutes())}:${p(d.getSeconds())} ${ap}`;
}

const MUNICIPIOS = ['Juazeiro', 'Irecê', 'Vitória da Conquista', 'Feira de Santana', 'Senhor do Bonfim', 'Barreiras', 'Jacobina', 'Itaberaba', 'Seabra', 'Euclides da Cunha', 'Valença', 'Ilhéus'];
const TIPOS = ['Associação', 'Cooperativa'];
const NOMES = ['dos Agricultores Familiares', 'de Produtores de Mel', 'das Mulheres Quebradeiras', 'de Apicultores', 'da Agricultura Familiar', 'dos Pequenos Produtores', 'de Fruticultores', 'de Beneficiamento de Mandioca', 'dos Caprinocultores', 'de Produtores de Licuri'];

function gerarBase() {
  const base = [];
  let n = 0;
  for (const [edital, qtd] of [['1', 118], ['2', 86]]) {
    for (let i = 0; i < qtd; i++) {
      n++;
      const cnpj = String(10000000000000 + n * 7919).slice(0, 14);
      base.push({
        edital,
        id: cnpj,
        nome: `${pick(TIPOS)} ${pick(NOMES)} de ${pick(MUNICIPIOS)} ${n}`,
        municipio: pick(MUNICIPIOS),
      });
    }
  }
  return base;
}

const BARULHO = ['uso de protetor auricular', 'protetor auricular para todos', 'manutenção das máquinas', 'isolamento acústico da sala', 'revezamento de turnos', 'protetor auricular e abafador', 'não há barulho', 'máquinas com abafador', 'distância das máquinas', 'uso de abafador'];
const PARTICULAS = ['uso de máscara', 'máscara PFF2', 'exaustor', 'umedecer o piso', 'ventilação natural', 'limpeza diária', 'máscara e óculos', 'exaustor e máscara', 'não se aplica'];
const TEMPERATURA = ['ventiladores', 'telhado com isolamento', 'ventilação natural', 'pausas para hidratação', 'água fresca disponível', 'horário reduzido no calor', 'ventiladores e exaustor', 'árvores ao redor do galpão', 'uso de roupas leves'];

function gerarRegistro(op, quando) {
  const temMadeira = rnd() < 0.35;
  const temInspecao = rnd() < 0.42;
  const ano = 1950 + Math.floor(rnd() * 55);
  const gestao = 2 + Math.floor(rnd() * rnd() * 28);
  return {
    KEY: 'uuid:' + Math.floor(rnd() * 1e16).toString(16) + '-' + Math.floor(rnd() * 1e8).toString(16),
    SubmissionDate: sctoDate(quando),
    edital: op.edital,
    cnpj_op: op.id,
    nome_op: op.nome,
    municipio: op.municipio,
    sexo_presidente: pick(['1', '2', '3'], [52, 46, 2]),
    cor_presidente: pick(['1', '2', '3', '4', '5', '6'], [14, 38, 41, 3, 2, 2]),
    nascimento_presidente: `${MESES[Math.floor(rnd() * 12)]} ${1 + Math.floor(rnd() * 27)}, ${ano}`,
    Presenca_de_mulheres_na_diretoria: pick(['1', '0'], [71, 29]),
    Presenca_de_jovens: pick(['1', '0'], [38, 62]),
    Presenca_de_pretos: pick(['1', '0'], [77, 23]),
    Presenca_de_mulheres: pick(['1', '2', '3', '4'], [10, 28, 39, 23]),
    numero_de_jovens_ate_29: String(Math.floor(rnd() * rnd() * 25)),
    presenca_pretos_reuniao: pick(['1', '2', '3', '4'], [6, 18, 36, 40]),
    quantas_pessoas_trabalham_na_gestao: String(gestao),
    quantas_sao_associadas: String(Math.max(0, gestao - Math.floor(rnd() * 4))),
    trabalhadores_usam_EPI: pick(['1', '2', '3'], [48, 37, 15]),
    forma_aquisicao_EPI: multi(['1', '2', '3', '4'], 0.4),
    forma_controle_EPI: pick(['1', '2', '3', '4'], [30, 22, 18, 30]),
    monitoramento_uso_EPI: pick(['1', '2', '3'], [44, 31, 25]),
    periodicidade_treinamentos_seguranca_do_trabalho: pick(['1', '2', '3', '4', '5'], [12, 19, 28, 17, 24]),
    forma_de_monitoramento_acidentes: multi(['1', '2', '3', '4'], 0.35),
    medidas_atenuacao_barulho: pick(BARULHO),
    medidas_atenuacao_particulas_suspensas: pick(PARTICULAS),
    medidas_atenuacao_temperatura: pick(TEMPERATURA),
    previsto_construcao: pick(['1', '2', '3'], [33, 22, 45]),
    comprovado_cefir: pick(['1', '0', '2'], [57, 28, 15]),
    intrumentos_gestao_ambiental: multi(['1', '2', '3', '4', '5'], 0.3),
    intrumentos_gestao_ambiental_PGRS: pick(['1', '0', '2'], [27, 58, 15]),
    situacao_ordem_ambiental: pick(['1', '2', '3', '4'], [41, 23, 21, 15]),
    possui_licenca_ambiental: pick(['1', '2', '3'], [34, 26, 40]),
    outorga_agroindustria: pick(['1', '2', '3'], [22, 31, 47]),
    existe_uso_de_madeira: temMadeira ? '1' : '0',
    origem_madeira: temMadeira ? pick(['1', '2', '3', '4'], [45, 25, 18, 12]) : '',
    possui_inpecao_sanitaria: temInspecao ? '1' : '0',
    tipo_certificacao: temInspecao ? multi(['1', '2', '3', '4'], 0.4) : '',
  };
}

const SIM_NAO = { 1: 'Sim', 0: 'Não' };
const ESQUEMA = {
  edital: { tipo: 'select_one', rotulo: 'Edital', opcoes: { 1: 'Edital 1 - OP Dinâmicas', 2: 'Edital 2 - OP Ativas' } },
  sexo_presidente: { tipo: 'select_one', opcoes: { 1: 'Masculino', 2: 'Feminino', 3: 'Prefere não informar' } },
  cor_presidente: { tipo: 'select_one', opcoes: { 1: 'Branca', 2: 'Preta', 3: 'Parda', 4: 'Amarela', 5: 'Indígena', 6: 'Não informou' } },
  nascimento_presidente: { tipo: 'date' },
  Presenca_de_mulheres_na_diretoria: { tipo: 'select_one', opcoes: SIM_NAO },
  Presenca_de_jovens: { tipo: 'select_one', opcoes: SIM_NAO },
  Presenca_de_pretos: { tipo: 'select_one', opcoes: SIM_NAO },
  Presenca_de_mulheres: { tipo: 'select_one', opcoes: { 1: 'Nenhuma', 2: 'Menos da metade', 3: 'Cerca da metade', 4: 'Mais da metade' } },
  numero_de_jovens_ate_29: { tipo: 'integer' },
  presenca_pretos_reuniao: { tipo: 'select_one', opcoes: { 1: 'Nenhuma', 2: 'Menos da metade', 3: 'Cerca da metade', 4: 'Mais da metade' } },
  quantas_pessoas_trabalham_na_gestao: { tipo: 'integer' },
  quantas_sao_associadas: { tipo: 'integer' },
  trabalhadores_usam_EPI: { tipo: 'select_one', opcoes: { 1: 'Sim, todos', 2: 'Sim, parte deles', 3: 'Não' } },
  forma_aquisicao_EPI: { tipo: 'select_multiple', opcoes: { 1: 'Compra pela organização', 2: 'Doação', 3: 'O próprio trabalhador compra', 4: 'Projeto/convênio' } },
  forma_controle_EPI: { tipo: 'select_one', opcoes: { 1: 'Ficha de entrega', 2: 'Planilha', 3: 'Caderno', 4: 'Não há controle' } },
  monitoramento_uso_EPI: { tipo: 'select_one', opcoes: { 1: 'Diário', 2: 'Eventual', 3: 'Não monitora' } },
  periodicidade_treinamentos_seguranca_do_trabalho: { tipo: 'select_one', opcoes: { 1: 'Mensal', 2: 'Semestral', 3: 'Anual', 4: 'Só na admissão', 5: 'Nunca' } },
  forma_de_monitoramento_acidentes: { tipo: 'select_multiple', opcoes: { 1: 'Registro em livro', 2: 'Comunicação de acidente (CAT)', 3: 'Relato verbal', 4: 'Não monitora' } },
  medidas_atenuacao_barulho: { tipo: 'text' },
  medidas_atenuacao_particulas_suspensas: { tipo: 'text' },
  medidas_atenuacao_temperatura: { tipo: 'text' },
  previsto_construcao: { tipo: 'select_one', opcoes: { 1: 'Sim, construção nova', 2: 'Sim, reforma/ampliação', 3: 'Não' } },
  comprovado_cefir: { tipo: 'select_one', opcoes: { 1: 'Sim', 0: 'Não', 2: 'Em andamento' } },
  intrumentos_gestao_ambiental: { tipo: 'select_multiple', opcoes: { 1: 'PGRS', 2: 'Coleta seletiva', 3: 'Compostagem', 4: 'Reuso de água', 5: 'Nenhum' } },
  intrumentos_gestao_ambiental_PGRS: { tipo: 'select_one', opcoes: { 1: 'Sim', 0: 'Não', 2: 'Em elaboração' } },
  situacao_ordem_ambiental: { tipo: 'select_one', opcoes: { 1: 'Regular', 2: 'Em regularização', 3: 'Dispensada', 4: 'Irregular' } },
  possui_licenca_ambiental: { tipo: 'select_one', opcoes: { 1: 'Sim', 2: 'Dispensa de licença', 3: 'Não' } },
  outorga_agroindustria: { tipo: 'select_one', opcoes: { 1: 'Possui outorga', 2: 'Dispensa de outorga', 3: 'Não possui' } },
  existe_uso_de_madeira: { tipo: 'select_one', opcoes: SIM_NAO },
  origem_madeira: { tipo: 'select_one', opcoes: { 1: 'Reflorestamento', 2: 'Manejo autorizado', 3: 'Comprada com DOF', 4: 'Não sabe' } },
  possui_inpecao_sanitaria: { tipo: 'select_one', opcoes: SIM_NAO },
  tipo_certificacao: { tipo: 'select_multiple', opcoes: { 1: 'SIM (municipal)', 2: 'SIE (estadual)', 3: 'SIF (federal)', 4: 'Orgânico' } },
};

function criarDemo() {
  const base = gerarBase();
  const pendentes = base.slice().sort(() => rnd() - 0.5);
  const registros = [];
  const agora = Date.now();
  const inicio = agora - 21 * 86400000;
  const iniciais = Math.round(base.length * 0.58);
  for (let i = 0; i < iniciais; i++) {
    const t = inicio + Math.pow(rnd(), 0.7) * (agora - inicio);
    registros.push(gerarRegistro(pendentes.pop(), new Date(t)));
  }
  registros.sort((a, b) => new Date(a.SubmissionDate) - new Date(b.SubmissionDate));
  return {
    base,
    esquema: { campos: ESQUEMA },
    // A cada atualização, chegam de 0 a 3 novas respostas (simula o campo).
    proximo() {
      const novas = Math.floor(rnd() * 4);
      for (let i = 0; i < novas && pendentes.length; i++) registros.push(gerarRegistro(pendentes.pop(), new Date()));
      return registros.slice();
    },
  };
}

module.exports = { criarDemo };
