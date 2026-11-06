// Rótulos para os códigos das opções, usados quando config/formulario.xlsx
// (XLSForm) não está disponível. Se o XLSForm existir, os rótulos dele têm
// prioridade. Códigos que não estão aqui são "embelezados" automaticamente
// (ex.: "nao_tem_controle" -> "Não tem controle").
//
// "geral" vale para qualquer variável; "campos" sobrescreve por variável.
// "ordem" define a ordem de exibição das categorias (escalas); categorias
// fora de uma escala são ordenadas pela frequência.

const escalaPresenca = {
  nenhum: 'Nenhum',
  '20_menos': '20% ou menos',
  Ate_25: 'Até 25%',
  '20_a_40': 'Acima de 20% e até 40%',
  '25_a_50': 'Acima de 25% e até 50%',
  '40_a_60': 'Acima de 40% e até 60%',
  '50_a_75': 'Acima de 50% e até 75%',
  '60_a_80': 'Acima de 60% e até 80%',
  acima_de_75: 'Acima de 75%',
  acima_80: 'Acima de 80%',
};

module.exports = {
  geral: {
    sim: 'Sim',
    nao: 'Não',
    // CEFIR / licenças / outorga / inspeção
    nao_rural: 'Não — imóvel rural',
    nao_urbano: 'Não — imóvel urbano',
    Segundo_a_lei: 'Não exigida, segundo a lei',
    SEGUNDO_LEI: 'Não exigida, segundo a lei',
    dispensa_licenciamento: 'Dispensa de licenciamento',
    outorga_terceiros: 'Outorga de terceiros',
    // EPI
    todos_utilizam: 'Todos utilizam',
    mais_da_metade: 'Mais da metade',
    metade_usa: 'Metade usa',
    menos_da_metade: 'Menos da metade',
    ninguem_utiliza: 'Ninguém utiliza',
    entregues_gratuitamente: 'Entregues gratuitamente',
    apenas_alguns_sao_entregues: 'Apenas alguns são entregues',
    cada_um_usa_o_que_achar_melhor: 'Cada um usa o que achar melhor',
    nao_entregam: 'Não são entregues',
    folha_de_controle: 'Folha de controle',
    sistema_eletronico: 'Sistema eletrônico',
    outra_forma_de_controle: 'Outra forma de controle',
    nao_tem_controle: 'Não tem controle',
    um_trabalhador_fica_responsavel: 'Um trabalhador fica responsável',
    outra_forma_de_verificar_EPI: 'Outra forma de verificar',
    nao_tem_forma_de_verificar: 'Não tem forma de verificar',
    // treinamentos e acidentes
    semanal: 'Semanal',
    mensal: 'Mensal',
    bimensal: 'Bimensal',
    trimestral: 'Trimestral',
    semestral: 'Semestral',
    anual: 'Anual',
    aconteceu_mas_sem_frequencia: 'Já aconteceu, sem frequência definida',
    nunca: 'Nunca',
    livro_caderno_em_papel: 'Livro/caderno em papel',
    sistema_eletronico_de_registro: 'Sistema eletrônico de registro',
    outra_forma_de_registro: 'Outra forma de registro',
    nao_tem_registro: 'Não tem registro',
    // medidas de atenuação (múltipla escolha)
    aberturas: 'Aberturas (portas/janelas)',
    exaustores: 'Exaustores',
    humidificadores: 'Umidificadores',
    ventiladores: 'Ventiladores',
    ar_condicionado: 'Ar-condicionado',
    outras: 'Outras',
    Outras: 'Outras',
    nenhuma: 'Nenhuma',
    // gestão ambiental
    MBPF: 'Manual de Boas Práticas de Fabricação (MBPF)',
    PGRS: 'Plano de Gerenciamento de Resíduos Sólidos (PGRS)',
    PGR: 'Programa de Gerenciamento de Riscos (PGR)',
    PGEE: 'PGEE',
    outros: 'Outros',
    Nao_tem: 'Não tem',
    sim_residuos: 'Sim — resíduos',
    sim_lenha: 'Sim — lenha',
    sim_efluentes: 'Sim — efluentes',
    Sim_outro: 'Sim — outro',
    // madeira
    coleta: 'Coleta',
    compra_madeira_exotica: 'Compra de madeira exótica',
    fonecedor: 'Fornecedor',
    plantio_proprio: 'Plantio próprio',
    residuo_serrarias: 'Resíduo de serrarias',
    madeira_certificada: 'Madeira certificada',
    // certificação sanitária
    alvara_sanitario: 'Alvará sanitário',
    SIM: 'SIM (municipal)',
    SIE: 'SIE (estadual)',
    SIF: 'SIF (federal)',
    SUSAF: 'SUSAF',
    SISBI: 'SISBI',
    ...escalaPresenca,
  },
  campos: {
    intrumentos_gestao_ambiental: { nenhum: 'Nenhum' },
  },
  ordem: [
    'sim', 'nao', 'nao_rural', 'nao_urbano',
    ...Object.keys(escalaPresenca),
    'todos_utilizam', 'mais_da_metade', 'metade_usa', 'menos_da_metade', 'ninguem_utiliza',
    'semanal', 'mensal', 'bimensal', 'trimestral', 'semestral', 'anual', 'aconteceu_mas_sem_frequencia', 'nunca',
  ],
};
