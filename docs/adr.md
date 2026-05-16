# Architecture Decision Records (ADR)

Registro das principais decisões arquiteturais tomadas durante o desenvolvimento da plataforma de gestão de documentos. Cada entrada descreve o contexto que motivou a decisão, a decisão em si, as alternativas avaliadas e as consequências esperadas.

---

## ADR-001 — NestJS como framework principal da API

**Status:** Aceita  
**Data:** 2026-05

### Contexto

A plataforma exige uma API que suporte autenticação com controle de acesso por cargos, upload de arquivos, integração com dois bancos de dados, filas assíncronas e envio de e-mails. Era necessário um framework com estrutura clara para organizar esses domínios sem construir tudo do zero.

### Decisão

Utilizar **NestJS** como framework principal da API, aproveitando seu sistema nativo de módulos, injeção de dependência, guards, decorators e integrações oficiais com Prisma, BullMQ, Mongoose e Nodemailer.

### Alternativas consideradas

| Alternativa      | Motivo de descarte                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Express puro** | Exigiria construir manualmente estrutura de módulos, DI, guards e pipes — custo alto sem benefício para o escopo do projeto |
| **Fastify**      | Boa performance, mas ecossistema de integrações menos maduro e ausência de estrutura opinativa nativa                       |
| **Hapi.js**      | Opinativo, mas comunidade menor e menor adoção no mercado brasileiro                                                        |

### Consequências

- **Positivas:** Velocidade de desenvolvimento alta; convenções bem definidas reduzem decisões de baixo nível; ampla documentação e comunidade ativa; integrações oficiais com as ferramentas escolhidas funcionam com configuração mínima.
- **Negativas:** Overhead de inicialização maior que frameworks minimalistas; curva de aprendizado para quem não conhece o paradigma Angular-like; geração de código boilerplate em módulos simples.

---

## ADR-002 — Estratégia dual de banco de dados (PostgreSQL + MongoDB)

**Status:** Aceita  
**Data:** 2026-05

### Contexto

A plataforma armazena dois tipos distintos de dados com naturezas muito diferentes: dados estruturados e relacionais do documento (nome, tamanho, status de processamento, cargo do usuário que fez upload, metadados XML) e dados semi-estruturados resultantes da extração de conteúdo (texto bruto extraído, padrões identificados como CPFs, CNPJs, datas e valores monetários). Esses dois conjuntos têm padrões de acesso, tamanho e estrutura distintos.

### Decisão

Utilizar **PostgreSQL** (via Prisma ORM) para os dados estruturados do domínio — documentos, usuários, status de processamento e metadados XML — e **MongoDB** (via Mongoose) exclusivamente para armazenar o resultado da extração de conteúdo dos documentos processados.

A separação foi feita com base na natureza dos dados:

- PostgreSQL: dados com schema fixo, relações entre entidades, consultas com filtros, agregações e joins.
- MongoDB: texto extraído de tamanho variável e imprevisível, padrões identificados em arrays dinâmicos — estrutura que se adapta mal a colunas fixas.

### Alternativas consideradas

| Alternativa                    | Motivo de descarte                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Somente PostgreSQL**         | Armazenar texto extraído de PDFs grandes em colunas `TEXT` é viável, mas o schema de padrões (arrays dinâmicos de datas, CPFs, CNPJs) seria modelado de forma forçada com `JSONB` ou tabelas auxiliares |
| **Somente MongoDB**            | Perda das garantias relacionais e de integridade referencial entre Documento e Usuário; consultas de relatório com agregações por status e período são mais simples em SQL                              |
| **PostgreSQL + Elasticsearch** | Mais adequado para busca full-text em escala, mas complexidade operacional desproporcional ao volume esperado (até 5.000 docs/dia)                                                                      |

### Consequências

- **Positivas:** Cada banco é usado para o que faz melhor; o schema do PostgreSQL permanece limpo e normalizado; o MongoDB absorve a variabilidade do conteúdo extraído sem impactar o modelo relacional.
- **Negativas:** Operações que precisam cruzar os dois bancos (ex: buscar análise de um documento específico) exigem duas queries separadas na aplicação; maior complexidade operacional para monitoramento e backup de dois bancos.

---

## ADR-003 — Processamento assíncrono via fila (BullMQ + Redis)

**Status:** Aceita  
**Data:** 2026-05

### Contexto

O processamento de documentos — extração de texto via `pdf-parse` para PDFs e OCR via `tesseract.js` para imagens PNG — é uma operação de CPU e I/O intensivos. Para arquivos próximos ao limite de 25 MB, o tempo de processamento pode ultrapassar 30 segundos. Processar de forma síncrona durante a requisição HTTP causaria dois problemas: esgotamento de timeout da requisição e bloqueio de recursos da API para outros usuários durante o processamento.

Além disso, a volumetria esperada de até 5.000 documentos por dia (≈ 208 por hora) em pico exige que o processamento seja desacoplado do ciclo de vida das requisições HTTP.

### Decisão

Utilizar **BullMQ** como sistema de filas com **Redis** como broker. O fluxo adotado é:

1. A requisição HTTP salva o arquivo em disco e cria o registro no banco com status `PENDING`.
2. Um job é enfileirado no Redis com os dados necessários para processamento.
3. A resposta HTTP retorna imediatamente com o `id` e `filePath` do documento.
4. O worker (`PdfExtractionProcessor`) consome o job em background, atualiza o status para `PROCESSED` ou `ERROR` e envia e-mail ao usuário com o resultado.

O Redis já fazia parte da infraestrutura do projeto (docker-compose), o que eliminou a necessidade de adicionar um novo serviço.

### Alternativas consideradas

| Alternativa                | Motivo de descarte                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Processamento síncrono** | Inviável para arquivos grandes; estouraria timeout e bloquearia o event loop                                                                  |
| **RabbitMQ**               | Mais robusto para cenários de múltiplos consumidores e roteamento complexo, mas infraestrutura adicional desnecessária para o volume esperado |
| **AWS SQS**                | Solução gerenciada válida para produção, mas adiciona dependência de cloud e custo operacional fora do escopo do desafio                      |
| **Bull (v3)**              | Versão anterior do BullMQ, sem suporte ativo; BullMQ é o sucessor oficial com melhor tipagem TypeScript                                       |

### Consequências

- **Positivas:** Requisições de upload retornam em milissegundos independente do tamanho do arquivo; retries automáticos em caso de falha; fila persistente no Redis sobrevive a reinicializações; fácil escalar workers horizontalmente.
- **Negativas:** O usuário não recebe o resultado imediatamente — depende de notificação por e-mail; dependência de Redis como infraestrutura adicional; maior complexidade de observabilidade (necessário monitorar o estado da fila).

---

## ADR-004 — Armazenamento de arquivos em disco local via Multer

**Status:** Aceita  
**Data:** 2026-05

### Contexto

A plataforma recebe uploads de arquivos PDF e PNG de até 25 MB. Os arquivos precisam ser armazenados de forma que o worker de processamento assíncrono consiga acessá-los após a requisição HTTP ter sido encerrada. A decisão de onde armazenar esses arquivos tem implicações diretas em escalabilidade, custo e simplicidade operacional.

### Decisão

Utilizar **armazenamento em disco local** via configuração `diskStorage` do Multer com geração de nomes únicos (UUID + nome original sanitizado). Os arquivos são salvos em `./uploads/` e o caminho é persistido no banco de dados. A pasta `uploads/` é ignorada pelo Git e deve ser excluída do versionamento.

Para o escopo do desafio, o armazenamento local é suficiente e elimina dependências externas de cloud. Em um ambiente de produção real com múltiplas instâncias, a decisão seria revisada.

### Alternativas consideradas

| Alternativa                                  | Motivo de descarte                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Amazon S3 / Google Cloud Storage**         | Correto para produção com múltiplas instâncias, mas adiciona custo, dependência de cloud e configuração de credenciais fora do escopo do desafio |
| **Armazenamento em memória (memoryStorage)** | Inviável para arquivos grandes (25 MB × N uploads simultâneos esgotaria RAM); usado apenas para o upload de XML que precisa de parsing imediato  |
| **Banco de dados (BYTEA / GridFS)**          | Anti-pattern para arquivos binários grandes; degrada performance das queries e aumenta desnecessariamente o tamanho do banco                     |

### Consequências

- **Positivas:** Zero dependência de serviços externos; simplicidade de configuração; sem latência de rede para leitura pelo worker.
- **Negativas:** Não escala horizontalmente — múltiplas instâncias da API não compartilham o mesmo sistema de arquivos sem um volume compartilhado (NFS, EFS); ausência de redundância e backup automático dos arquivos; necessidade de política de retenção e limpeza manual.

> **Em produção:** migrar `diskStorage` para um provider de object storage (S3, GCS ou MinIO self-hosted) seria a primeira evolução arquitetural, alterando apenas a configuração do Multer sem impactar o restante da aplicação.

---

## ADR-005 — Autenticação stateless com JWT

**Status:** Aceita  
**Data:** 2026-05

### Contexto

A plataforma possui três cargos com permissões distintas (OPERATOR, MANAGER, ADMIN) e precisa de um mecanismo de autenticação que seja simples de implementar, compatível com o NestJS e que não exija infraestrutura adicional para armazenar estado de sessão.

### Decisão

Utilizar **JWT (JSON Web Token) stateless** com o pacote `@nestjs/jwt`. O token é gerado no login, assinado com uma chave secreta configurada via variável de ambiente, e validado em cada requisição pelo `JwtAuthGuard` global. O payload carrega `sub` (userId) e `role`, permitindo controle de acesso por cargos sem consulta ao banco a cada requisição.

### Alternativas consideradas

| Alternativa                                   | Motivo de descarte                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sessões com armazenamento em banco**        | Exigiria infraestrutura de sessão e consulta ao banco a cada requisição autenticada — complexidade sem benefício claro para o escopo                          |
| **OAuth2 / OpenID Connect (Auth0, Keycloak)** | Solução robusta para SSO e múltiplos clients, mas overhead de configuração e infraestrutura desproporcional para uma API interna com usuários pré-cadastrados |
| **API Keys estáticas**                        | Adequado para integrações máquina-a-máquina, não para autenticação de usuários humanos com cargos                                                             |

### Consequências

- **Positivas:** Sem estado no servidor — qualquer instância valida o token sem coordenação; simples de implementar com `@nestjs/jwt`; o cargo é lido direto do payload sem consulta ao banco.
- **Negativas:** Tokens não podem ser revogados antes da expiração sem uma blocklist (Redis); se a chave secreta for comprometida, todos os tokens ativos ficam inválidos somente após rotação; sem refresh token implementado, o usuário precisa fazer login ao expirar.

---

## ADR-006 — Extração de conteúdo com bibliotecas locais (pdf-parse + tesseract.js)

**Status:** Aceita  
**Data:** 2026-05

### Contexto

O requisito do desafio exige extração de texto de documentos PDF e imagens PNG, com identificação de pelo menos dois padrões estruturados. A decisão foi construir a solução mais simples que cumpra o requisito, reconhecendo que para uso em produção real outras abordagens seriam mais adequadas.

### Decisão

Utilizar **pdf-parse** para extração de texto de PDFs e **tesseract.js** para OCR em imagens PNG. Ambas as bibliotecas rodam localmente, sem dependência de APIs externas, e são suficientes para o volume e os tipos de documentos esperados no desafio. O processamento ocorre dentro do worker BullMQ, isolado da API.

Os padrões identificados — datas (`dd/mm/aaaa`), valores monetários (R$), CPFs e CNPJs — são extraídos via expressões regulares aplicadas ao texto normalizado.

### Alternativas consideradas

| Alternativa                           | Motivo de descarte                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **AWS Textract / Google Document AI** | Alta precisão, especialmente para documentos escaneados; mas adiciona custo por requisição, latência de rede e dependência de cloud                    |
| **LLM para extração estruturada**     | Abordagem moderna e flexível para extrair entidades sem regex; mas custo de API, latência e complexidade de integração estão fora do escopo do desafio |
| **Apache Tika**                       | Extração robusta de múltiplos formatos; exige JVM como dependência de runtime — complexidade operacional desnecessária                                 |
| **pdfjs-dist (direto)**               | Base do pdf-parse v2; mais controle, mas maior verbosidade de código para o mesmo resultado                                                            |

### Consequências

- **Positivas:** Zero custo por documento processado; sem dependência de serviços externos; processamento offline; simples de testar localmente.
- **Negativas:** A qualidade do OCR com tesseract.js depende fortemente da resolução e qualidade da imagem; documentos escaneados em baixa qualidade ou com fontes não-padrão terão extração imprecisa; a identificação de padrões por regex falha em variações de formatação não previstas (ex: CPF sem pontuação).
