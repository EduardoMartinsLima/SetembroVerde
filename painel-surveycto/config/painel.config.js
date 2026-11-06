// Estrutura do painel: seções e variáveis prioritárias, na ordem da planilha
// "Variáveis para BI - missão nov/2026".
//
// Cada variável aceita:
//   campo   nome da coluna no SurveyCTO (busca sem diferenciar maiúsculas)
//   titulo  título exibido no cartão (se omitido, usa o enunciado do XLSForm)
//   tipo    'auto' (padrão) | 'categoria' | 'multipla' | 'numero' |
//           'faixa_etaria' | 'nuvem'
//   nota    texto curto de apoio exibido no cartão
//
// "auto" decide pelo XLSForm (config/formulario.xlsx), quando existir, ou
// pelos próprios valores recebidos.

const rotulos = require('./rotulos');

const NOTA_ESCALA = 'A escala de faixas mudou entre versões do formulário (de 20 em 20% e de 25 em 25%); as duas aparecem.';

module.exports = {
  rotulos,

  // Fuso das datas de envio retornadas pela API (o SurveyCTO usa UTC).
  datasEmUTC: true,

  titulo: 'PNP · Informações Ambientais e Sociais',
  subtitulo: 'Plano de Negócios Participativo — monitoramento da coleta',

  // Os dois grupos comparados em todos os gráficos.
  // "padrao" é uma expressão regular aplicada ao valor (ou rótulo) do campo
  // de edital; também vale para a coluna "edital" da base DATACAR.
  editais: [
    { id: 'e1', nome: 'Edital 1', descricao: 'OP Dinâmicas', padrao: '(^|\\D)1(\\D|$)|din[aâ]mic' },
    { id: 'e2', nome: 'Edital 2', descricao: 'OP Ativas', padrao: '(^|\\D)2(\\D|$)|ativ' },
  ],

  secoes: [
    {
      id: 'social',
      letra: 'B',
      titulo: 'Informações sociais',
      grupos: [
        {
          titulo: 'Presidente/a',
          variaveis: [
            { campo: 'sexo_presidente', titulo: 'Sexo do(a) presidente' },
            { campo: 'cor_presidente', titulo: 'Cor/raça do(a) presidente' },
            { campo: 'nascimento_presidente', titulo: 'Faixa etária do(a) presidente', tipo: 'faixa_etaria' },
          ],
        },
        {
          titulo: 'Diretoria',
          variaveis: [
            { campo: 'Presenca_de_mulheres_na_diretoria', titulo: 'Presença de mulheres na diretoria' , nota: NOTA_ESCALA },
            { campo: 'Presenca_de_jovens', titulo: 'Presença de jovens na diretoria' , nota: NOTA_ESCALA },
            { campo: 'Presenca_de_pretos', titulo: 'Presença de pessoas pretas na diretoria' , nota: NOTA_ESCALA },
          ],
        },
        {
          titulo: 'Assembleias e reuniões',
          variaveis: [
            { campo: 'Presenca_de_mulheres', titulo: 'Presença de mulheres nas assembleias' , nota: NOTA_ESCALA },
            { campo: 'numero_de_jovens_ate_29', titulo: 'Jovens (até 29 anos) nas assembleias' , nota: NOTA_ESCALA },
            { campo: 'presenca_pretos_reuniao', titulo: 'Presença de pessoas pretas nas reuniões' , nota: NOTA_ESCALA },
          ],
        },
      ],
    },
    {
      id: 'ocupacao',
      letra: 'C',
      titulo: 'Ocupação',
      grupos: [
        {
          titulo: 'Pessoas que trabalham na agroindústria',
          variaveis: [
            { campo: 'quantas_pessoas_trabalham_na_gestao', titulo: 'Pessoas que trabalham na agroindústria (todas as áreas)', tipo: 'numero' },
            {
              campo: 'quantas_sao_associadas',
              titulo: 'Dessas, quantas são associadas',
              tipo: 'numero',
              relacao: { campo: 'quantas_pessoas_trabalham_na_gestao', rotulo: 'Associadas / total de trabalhadores' },
            },
          ],
        },
      ],
    },
    {
      id: 'sst',
      letra: 'D',
      titulo: 'Saúde e segurança do trabalho',
      grupos: [
        {
          titulo: 'Equipamentos de proteção individual (EPI)',
          variaveis: [
            { campo: 'trabalhadores_usam_EPI', titulo: 'Trabalhadores usam EPI?' },
            { campo: 'forma_aquisicao_EPI', titulo: 'Forma de aquisição do EPI' },
            { campo: 'forma_controle_EPI', titulo: 'Forma de controle do EPI' },
            { campo: 'monitoramento_uso_EPI', titulo: 'Monitoramento do uso de EPI' },
          ],
        },
        {
          titulo: 'Treinamentos e acidentes',
          variaveis: [
            { campo: 'periodicidade_treinamentos_seguranca_do_trabalho', titulo: 'Periodicidade dos treinamentos de segurança' },
            { campo: 'forma_de_monitoramento_acidentes', titulo: 'Forma de monitoramento de acidentes' },
          ],
        },
        {
          titulo: 'Medidas de atenuação',
          variaveis: [
            { campo: 'medidas_atenuacao_barulho', titulo: 'Medidas de atenuação do barulho', tipo: 'nuvem' },
            { campo: 'medidas_atenuacao_particulas_suspensas', titulo: 'Medidas de atenuação de partículas suspensas' },
            { campo: 'medidas_atenuacao_temperatura', titulo: 'Medidas de atenuação da temperatura' },
          ],
        },
      ],
    },
    {
      id: 'infra',
      letra: 'E',
      titulo: 'Infraestrutura',
      grupos: [
        {
          titulo: 'Obras',
          variaveis: [{ campo: 'previsto_construcao', titulo: 'Há construção prevista?' }],
        },
      ],
    },
    {
      id: 'ambiental',
      letra: 'F',
      titulo: 'Ambiental',
      grupos: [
        {
          titulo: 'Regularidade ambiental',
          variaveis: [
            { campo: 'comprovado_cefir', titulo: 'CEFIR comprovado' },
            { campo: 'situacao_ordem_ambiental', titulo: 'Situação da ordem ambiental' },
            { campo: 'possui_licenca_ambiental', titulo: 'Possui licença ambiental?' },
            { campo: 'outorga_agroindustria', titulo: 'Outorga da agroindústria' },
          ],
        },
        {
          titulo: 'Gestão ambiental',
          variaveis: [
            { campo: 'intrumentos_gestao_ambiental', titulo: 'Instrumentos de gestão ambiental' },
            {
              campo: 'intrumentos_gestao_ambiental_PGRS',
              titulo: 'Possui Plano de Gerenciamento de Resíduos Sólidos (PGRS)?',
              tipo: 'marcado',
              pai: 'intrumentos_gestao_ambiental',
            },
          ],
        },
        {
          titulo: 'Madeira',
          variaveis: [
            { campo: 'existe_uso_de_madeira', titulo: 'Existe uso de madeira?' },
            { campo: 'origem_madeira', titulo: 'Origem da madeira' },
          ],
        },
      ],
    },
    {
      id: 'sanidade',
      letra: 'G',
      titulo: 'Sanidade alimentar',
      grupos: [
        {
          titulo: 'Inspeção e certificação',
          variaveis: [
            { campo: 'possui_inpecao_sanitaria', titulo: 'Possui inspeção sanitária?' },
            { campo: 'tipo_certificacao', titulo: 'Tipo de certificação' },
          ],
        },
      ],
    },
  ],
};
