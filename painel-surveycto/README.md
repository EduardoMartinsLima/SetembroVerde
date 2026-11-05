# Painel PNP · SurveyCTO (monitoramento em tempo real)

Painel web que se conecta à API do SurveyCTO e acompanha, em tempo real, o
formulário **PNP – Informações Ambientais e Sociais para o Plano de Negócios
Participativo** (`registro_de_informaes_ambientais_e_sociais_do_plano_de_investimentos`).

Ele segue a planilha *“Variáveis para BI – missão nov/2026”*:

| Seção | Conteúdo |
|---|---|
| **A** Progresso da coleta | OP que responderam × não responderam (contra a base DATACAR de cada edital), submissões por dia, últimas submissões, KPIs |
| **B** Informações sociais | Presidente/a (sexo, cor, **faixa etária** agrupada em até 20, 21–29, 30–39 … 80+), diretoria e assembleias |
| **C** Ocupação | Pessoas na gestão e associadas (total, média, mediana, distribuição e % de associadas) |
| **D** Saúde e segurança | EPI, treinamentos, acidentes e **nuvens de palavras** para as medidas de atenuação de barulho, partículas e temperatura |
| **E** Infraestrutura | Construção prevista |
| **F** Ambiental | CEFIR, gestão ambiental/PGRS, ordem ambiental, licença, outorga, madeira |
| **G** Sanidade alimentar | Inspeção sanitária e tipo de certificação |

Todos os gráficos mostram **número e percentual** e podem ser vistos em
**Comparar editais** (Edital 1 – OP Dinâmicas × Edital 2 – OP Ativas lado a
lado), só um edital, ou **Todos**. Cada cartão tem o botão **Tabela** para ver
os números exatos.

## Como funciona o “tempo real”

```
SurveyCTO API  ──(a cada 5 min)──▶  server.js (cache)  ──(SSE, push)──▶  navegadores
```

- O servidor consulta `api/v2/forms/data/wide/json/<form>?date=Oct 13, 2015 00:00:00 AM`
  (data fixa → base completa). As credenciais ficam **só no servidor**.
- Quando chega algo novo, todos os painéis abertos atualizam sozinhos e
  mostram um aviso “+N novas submissões”.
- O SurveyCTO só permite baixar a base completa a cada ~300 s. Por isso o
  intervalo padrão é 300 s (`INTERVALO_SEGUNDOS`). Se a consulta falhar, o painel
  continua exibindo os últimos dados e mostra o erro em destaque.

## Rodando

Pré-requisito: **Node.js 18+**. Não há dependências para instalar.

```bash
cd painel-surveycto
cp .env.example .env      # preencha SCTO_SENHA (e, se quiser, PAINEL_USUARIO/PAINEL_SENHA)
npm run testar-conexao    # faz 1 consulta e lista campos encontrados/ausentes
npm start                 # http://localhost:3100
```

Para conhecer o painel sem acessar o SurveyCTO: `npm run demo` (dados
**fictícios**, sinalizados por uma faixa amarela no topo).

### Protótipo em HTML único

```bash
npm run prototipo         # gera prototipo/painel-pnp.html
```

Gera um único `.html` com um instantâneo dos dados embutido (abre direto no
navegador, sem servidor). CNPJs viram códigos e datas de nascimento viram só o
ano. Não atualiza sozinho e fica fora do git, pois contém dados reais.

## Arquivos opcionais (recomendados) em `config/`

| Arquivo | Para quê |
|---|---|
| `formulario.xlsx` | A definição do formulário (XLSForm) baixada do SurveyCTO (*Design → Download form files*). Com ele o painel mostra **“Feminino”** em vez do código **“2”**, e usa o tipo exato de cada pergunta. É relido automaticamente quando trocado. |
| `base_conveniadas.csv` | Lista de OP conveniadas do **DATACAR**, para calcular *responderam × não responderam* por edital e listar quem falta. Colunas: `edital;cnpj;nome;municipio` (separador `;` ou `,`). Veja `base_conveniadas.exemplo.csv`. |

Os dois arquivos ficam fora do git (`.gitignore`), pois têm dados reais.

## Como o painel lida com este formulário (testado com os dados reais)

- **Autenticação**: o servidor `bpcomponente2` usa HTTP Basic; o cliente detecta o
  esquema sozinho (também suporta Digest).
- **Edital**: o formulário **não tem campo de edital**. A separação Edital 1 × Edital 2
  vem da base DATACAR, cruzada pelo `cnpj_organizacao`. Sem a base, o painel mostra
  o conjunto completo e os botões de edital ficam desabilitados.
- **Reenvios**: há OP com mais de uma submissão (mesmo CNPJ). Os gráficos usam a
  **submissão mais recente de cada OP**; os KPIs mostram submissões e OP distintas.
- **Múltipla escolha "dividida"**: `medidas_atenuacao_particulas_suspensas`,
  `medidas_atenuacao_temperatura`, `intrumentos_gestao_ambiental` e
  `situacao_ordem_ambiental` chegam como uma coluna por opção (`campo_opcao = 1`);
  o servidor as reconstrói automaticamente.
- **Rótulos**: a API não fornece o XLSForm. Enquanto `config/formulario.xlsx` não
  existir, os códigos são traduzidos por `config/rotulos.js` (editável).
- **Datas de envio** vêm em UTC e são exibidas no horário local do navegador.

## Ajustes

- **Variáveis, títulos e seções**: `config/painel.config.js`. Cada variável aceita
  `tipo: 'auto' | 'categoria' | 'multipla' | 'numero' | 'faixa_etaria' | 'nuvem'`.
- **Campos-chave** (edital, CNPJ/ID da OP, nome, município): são detectados pelo
  nome da coluna; se necessário, force no `.env` (`CAMPO_EDITAL`, `CAMPO_ID_OP`, …).
  Se o formulário não tiver campo de edital, o edital vem da base DATACAR (pelo CNPJ/nome).
- **Acesso**: defina `PAINEL_USUARIO`/`PAINEL_SENHA` para exigir login — os dados
  incluem informações pessoais de presidentes (LGPD). Em produção, publique atrás
  de HTTPS (proxy reverso/IIS/nginx).

## Estrutura

```
server.js              servidor HTTP + agendador + SSE
lib/surveycto.js       cliente da API (Digest/Basic, sem dependências)
lib/xlsform.js         leitor do XLSForm (.xlsx) para rótulos/tipos
lib/demo.js            gerador de dados fictícios (npm run demo)
config/painel.config.js seções e variáveis do painel
public/                front-end (HTML/CSS/JS puros, claro/escuro, responsivo)
```
