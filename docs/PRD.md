# FinOps — Documento de Requisitos do Produto (PRD)

**Última atualização:** 2026-10-26
**Status:** v1 — em implementação

## Visão Geral

O FinOps é uma ferramenta pessoal de controle de custos de projetos. O usuário cadastra
seus projetos e os serviços pagos de cada um (servidor, banco de dados, domínio, APIs,
assinaturas), informando valor e moeda. A ferramenta calcula e exibe:

- Quanto cada projeto custa por mês
- O custo total de todos os projetos no mês
- A evolução mês a mês dos custos

Todos os valores são convertidos para **BRL (Real)** usando cotações cadastradas pelo
próprio usuário, de forma que exista sempre um número único e comparável por projeto.

## Público-Alvo

**Usuário principal:** desenvolvedor / empreendedor solo que mantém vários projetos
paralelos e perde a noção de quanto cada um consome por mês.

**Dor atual:** as cobranças estão espalhadas entre cartões, provedores e moedas
diferentes; não existe visão consolidada por projeto nem histórico de evolução.

## Funcionalidades Principais

### 1. Autenticação
- Login de uso pessoal (e-mail + senha) para proteger os dados quando publicado na internet.
- Cada usuário vê apenas seus próprios projetos e serviços.

### 2. Projetos
- Criar, editar e arquivar projetos (nome, descrição opcional, cor para identificação visual).
- Arquivar em vez de excluir, para preservar o histórico de custos.
- Excluir definitivamente também é possível (remove o histórico do projeto).

### 3. Serviços (custos recorrentes)
Cada serviço pertence a um projeto e possui:
- **Nome** (ex.: "VPS Hetzner", "Domínio .com.br", "OpenAI API")
- **Categoria**: Servidor, Banco de Dados, Domínio, API, Armazenamento, Monitoramento, Outro
- **Valor** e **moeda** (BRL, USD, EUR)
- **Ciclo de cobrança**: mensal ou anual (valores anuais são rateados por mês — 1/12 — para comparação justa)
- **Data de início** e, opcionalmente, **data de término** (quando o serviço é cancelado)
- **Observações** (campo livre: conta usada, renovação, etc.)

Serviços com data de término param de contar nos meses posteriores. Serviços com data de
início futura só começam a contar a partir daquele mês.

### 4. Conversão de Moedas
- O usuário cadastra a cotação de cada moeda estrangeira **por mês** (ex.: Out/2026, 1 USD = 5,40 BRL).
- Se não houver cotação cadastrada para um mês, o sistema usa a cotação mais recente anterior.
- Se nunca houve cotação para aquela moeda, o valor aparece destacado como "cotação pendente"
  e não entra no total, com um aviso visível ao usuário.

### 5. Painel do Mês (tela principal)
- Seletor de mês (padrão: mês atual).
- **Total do mês** em BRL, somando todos os projetos ativos.
- Comparação com o mês anterior (variação em R$ e em %).
- Lista de projetos ordenada por custo, com o valor mensal de cada um e sua participação (%) no total.
- Aviso quando houver serviços sem cotação disponível.

### 6. Detalhe do Projeto
- Custo mensal do projeto no mês selecionado.
- Lista dos serviços do projeto com valor original (moeda cadastrada) e valor convertido em BRL.
- Quebra de custo por categoria.
- Gráfico de evolução mês a mês do projeto (últimos 12 meses).

### 7. Evolução Mês a Mês
- Gráfico com o custo total dos últimos 12 meses.
- Visão empilhada por projeto, para enxergar quem cresceu ou encolheu.
- Tabela com o valor de cada mês e a variação em relação ao mês anterior.

## Fluxos do Usuário

**Primeiro uso**
1. Usuário faz login.
2. Tela vazia convida a criar o primeiro projeto.
3. Cria o projeto → adiciona os serviços que paga.
4. Se houver serviço em moeda estrangeira, é convidado a cadastrar a cotação do mês.
5. Painel do mês passa a mostrar o total.

**Uso recorrente (mensal)**
1. Abre o painel, vê o total do mês e a variação em relação ao mês anterior.
2. Atualiza a cotação do dólar/euro do mês, se necessário.
3. Registra serviços novos ou marca data de término dos cancelados.
4. Consulta a evolução para entender tendências.

## Requisitos Não Funcionais

- **Idioma:** português do Brasil em toda a interface.
- **Formatação:** valores em formato brasileiro (R$ 1.234,56); datas em dd/mm/aaaa.
- **Responsivo:** utilizável em celular e desktop.
- **Desempenho:** painel do mês carrega em menos de 1 segundo com até 50 projetos e 500 serviços.
- **Privacidade:** dados visíveis apenas ao usuário autenticado; sem compartilhamento público.
- **Precisão monetária:** valores armazenados em centavos (inteiros) para evitar erros de arredondamento.

## Fora de Escopo (v1)

- Integração automática com provedores de nuvem (AWS, GCP, Locaweb) para importar faturas.
- Cotação de moedas buscada automaticamente de API externa (o usuário cadastra manualmente).
- Receitas, faturamento ou cálculo de lucro por projeto.
- Múltiplos usuários / equipes com permissões.
- Alertas por e-mail quando o custo passa de um limite.
- Exportação para CSV/Excel.
- Custos por uso variável (ex.: cobrança por requisição que muda todo mês) — a v1 trata
  valores recorrentes fixos; variações são registradas editando o serviço.
