# Keltech — Plataforma de Gestão de Documentos

API REST para recepção, processamento e gestão de documentos PDF e PNG com extração automática de dados, controle de acesso por cargos e notificações por e-mail.

---

## Índice

- [Visão geral](#visão-geral)
- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Decisões arquiteturais](#decisões-arquiteturais)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e execução](#instalação-e-execução)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Endpoints principais](#endpoints-principais)
- [Controle de acesso por cargos](#controle-de-acesso-por-cargos)

---

## Visão geral

A plataforma permite que operadores façam upload de documentos (PDF ou PNG), que são processados de forma assíncrona: o texto é extraído automaticamente, padrões estruturados são identificados (datas, CPFs, CNPJs, valores monetários) e o resultado é persistido. O usuário recebe uma notificação por e-mail quando o processamento é concluído. Gestores têm acesso a relatórios, quantitativos e exportação em CSV. Administradores gerenciam usuários e têm acesso irrestrito.

```
Upload (OPERATOR)
  └── Salva arquivo em disco
  └── Cria registro no PostgreSQL (status: PENDING)
  └── Enfileira job no Redis (BullMQ)
  └── Retorna imediatamente ←── resposta HTTP

[Background] Worker BullMQ
  └── PDF  → pdf-parse → texto
  └── PNG  → tesseract.js (OCR) → texto
  └── Normaliza texto → extrai padrões
  └── Salva análise no MongoDB
  └── Atualiza status no PostgreSQL (PROCESSED | ERROR)
  └── Envia e-mail ao usuário
```

---

## Tecnologias utilizadas

| Tecnologia | Função | Justificativa |
|---|---|---|
| **NestJS** | Framework principal da API | Estrutura modular, DI nativa, guards/pipes/decorators prontos, integrações oficiais com todas as libs utilizadas |
| **TypeScript** | Linguagem | Tipagem estática reduz erros em tempo de desenvolvimento; essencial com NestJS e Prisma |
| **PostgreSQL** | Banco relacional | Armazena entidades do domínio (usuários, documentos, status); garantias ACID e suporte a agregações SQL para relatórios |
| **Prisma ORM** | Acesso ao PostgreSQL | Migrations com versionamento, client type-safe gerado, suporte a enums e JSON |
| **MongoDB** | Banco de documentos | Armazena texto extraído e padrões identificados — estrutura semi-estruturada e de tamanho variável que se adapta mal a schema fixo |
| **Mongoose** | Acesso ao MongoDB | Integração oficial com NestJS via `@nestjs/mongoose`, schemas com decorators |
| **Redis** | Broker de filas | Infraestrutura leve e de alta performance para persistência de jobs; já presente no docker-compose |
| **BullMQ** | Sistema de filas | Processamento assíncrono de documentos pesados sem travar a API; retries automáticos; substituto oficial do Bull v3 com TypeScript nativo |
| **JWT** | Autenticação | Stateless, sem infraestrutura de sessão adicional; o cargo é lido direto do payload sem consulta ao banco |
| **bcryptjs** | Hash de senhas | Hashing seguro sem dependência de binários nativos |
| **Multer** | Upload de arquivos | Integrado ao NestJS; `diskStorage` para PDF/PNG, `memoryStorage` para XML |
| **pdf-parse** | Extração de texto em PDF | Biblioteca local sem custo por requisição; suficiente para o volume do desafio |
| **tesseract.js** | OCR em imagens PNG | Engine Tesseract portada para JS/Node; sem dependência de binários externos |
| **fast-xml-parser + Zod** | Parse e validação de XML | Parser rápido sem dependências nativas; Zod já utilizado no projeto para validação de env |
| **Nodemailer** | Envio de e-mails | Biblioteca consolidada compatível com qualquer SMTP; zero dependências externas de cloud |
| **class-validator** | Validação de DTOs | Integração nativa com `ValidationPipe` do NestJS |
| **Docker + docker-compose** | Infraestrutura local | PostgreSQL, MongoDB e Redis provisionados com um único comando |
| **Zod** | Validação de variáveis de ambiente | Schema de env tipado e validado na inicialização da aplicação |

---

## Decisões arquiteturais

Resumo das principais decisões. Documento completo em [`docs/adr.md`](docs/adr.md).

| ADR | Decisão | Resumo |
|---|---|---|
| [ADR-001](docs/adr.md#adr-001--nestjs-como-framework-principal-da-api) | NestJS | Framework opinativo reduz decisões de baixo nível sem sacrificar flexibilidade |
| [ADR-002](docs/adr.md#adr-002--estratégia-dual-de-banco-de-dados-postgresql--mongodb) | Dual DB | PostgreSQL para dados relacionais/estruturados; MongoDB para conteúdo extraído de tamanho variável |
| [ADR-003](docs/adr.md#adr-003--processamento-assíncrono-via-fila-bullmq--redis) | BullMQ | Arquivos grandes processados em background para não bloquear a API nem estourar timeout |
| [ADR-004](docs/adr.md#adr-004--armazenamento-de-arquivos-em-disco-local-via-multer) | Disco local | Simples para o escopo do desafio; em produção evoluiria para object storage (S3/GCS) |
| [ADR-005](docs/adr.md#adr-005--autenticação-stateless-com-jwt) | JWT stateless | Sem estado no servidor; cargo embutido no token elimina consulta ao banco por requisição |
| [ADR-006](docs/adr.md#adr-006--extração-de-conteúdo-com-bibliotecas-locais-pdf-parse--tesseractjs) | Extração local | pdf-parse + tesseract.js cumprem o requisito sem custo por requisição ou dependência de cloud |

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) >= 20 (apenas para desenvolvimento local)

---

## Instalação e execução

### Opção A — Docker (recomendado)

Sobe toda a stack (API + PostgreSQL + MongoDB + Redis) com um único comando.

**1. Clone o repositório**

```bash
git clone <url-do-repositorio>
cd keltech-desafio
```

**2. Configure as variáveis de ambiente**

```bash
cp api/.env.example api/.env
```

Edite `api/.env` preenchendo `JWT_SECRET` e as credenciais SMTP. As demais variáveis já estão configuradas para os serviços do docker-compose.

**3. Suba toda a stack**

```bash
docker-compose up -d
```

O docker-compose irá:
- Construir a imagem da API
- Aguardar os serviços de banco ficarem saudáveis (`healthcheck`)
- Aplicar as migrations automaticamente na inicialização
- Expor a API em `http://localhost:3333`

**4. Popule o banco com usuários de seed**

```bash
docker-compose exec api npx prisma db seed
```

**Comandos úteis:**

```bash
# Ver logs da API em tempo real
docker-compose logs -f api

# Parar todos os serviços
docker-compose down

# Parar e remover volumes (apaga dados dos bancos)
docker-compose down -v

# Reconstruir a imagem após alterações no código
docker-compose up -d --build api
```

---

### Opção B — Desenvolvimento local

**1. Suba apenas a infraestrutura**

```bash
docker-compose up -d db mongodb redis
```

**2. Configure as variáveis de ambiente**

```bash
cp api/.env.example api/.env
# Edite api/.env com JWT_SECRET e credenciais SMTP
```

**3. Instale as dependências**

```bash
cd api
npm install
```

**4. Execute as migrations e popule o banco**

```bash
npx prisma migrate dev
npx prisma db seed
```

**5. Inicie a API com hot reload**

```bash
npm run start:dev
```

A API estará disponível em `http://localhost:3333`.

A API estará disponível em `http://localhost:3333`.

---

## Variáveis de ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `NODE_ENV` | Ambiente de execução | `development` |
| `PORT` | Porta da API | `3333` |
| `DATABASE_URL` | Connection string do PostgreSQL | `postgresql://postgres:postgres@localhost:5432/keltech_db?schema=public` |
| `JWT_SECRET` | Chave secreta para assinar tokens (mín. 32 chars) | `zVKf5jQ8DcHTaRlHlzFJNjSvC0kHsNzG` |
| `JWT_EXPIRES_IN` | Tempo de expiração do token | `1d` |
| `MONGODB_URI` | Connection string do MongoDB | `mongodb://root:example@localhost:27017/keltech_db?authSource=admin` |
| `REDIS_HOST` | Host do Redis | `localhost` |
| `REDIS_PORT` | Porta do Redis | `6379` |
| `REDIS_PASSWORD` | Senha do Redis | — |
| `SMTP_HOST` | Host do servidor SMTP | `sandbox.smtp.mailtrap.io` |
| `SMTP_PORT` | Porta SMTP | `587` |
| `SMTP_USER` | Usuário SMTP | — |
| `SMTP_PASS` | Senha SMTP | — |
| `SMTP_FROM` | Endereço remetente | `"Keltech <no-reply@keltech.com>"` |

> **Dica para desenvolvimento:** use o [Mailtrap](https://mailtrap.io) para capturar e-mails sem enviá-los de verdade.

---

## Endpoints principais

### Autenticação

#### `POST /auth/login`
Autentica um usuário e retorna o token JWT.

**Usuários disponíveis após o seed:**

| E-mail | Senha | Cargo |
|---|---|---|
| operator@keltech.com | password123 | OPERATOR |
| manager@keltech.com | password123 | MANAGER |
| admin@keltech.com | password123 | ADMIN |

---

### Documentos

#### `POST /document/upload`
Faz upload de um ou mais arquivos PDF ou PNG (máx. 25 MB cada).  
**Cargo:** OPERATOR

#### `POST /document/:id/xml`
Enriquece um documento existente com metadados em XML.  
**Cargo:** OPERATOR

#### `GET /document`
Lista documentos com filtros opcionais.  
**Cargo:** OPERATOR, MANAGER, ADMIN

**Query params:**

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `status` | `PENDING \| PROCESSED \| ERROR` | Filtra por status de processamento |
| `from` | `YYYY-MM-DD` | Data de criação inicial |
| `to` | `YYYY-MM-DD` | Data de criação final |
| `hasMetadata` | `true \| false` | Filtra por presença de XML enriquecido |
| `page` | `number` | Página (padrão: 1) |
| `limit` | `number` | Itens por página (padrão: 20, máx: 100) |

#### `GET /document/stats`
Retorna totais por status e por período (hoje, semana, mês).  
**Cargo:** MANAGER, ADMIN

#### `GET /document/report`
Exporta os documentos em formato CSV.  
**Cargo:** MANAGER, ADMIN  
Aceita os mesmos filtros do `GET /document` (exceto `page` e `limit`).

---

### Saúde

#### `GET /health`
Verifica se a API está no ar. Rota pública.

---

## Controle de acesso por cargos

| Rota | OPERATOR | MANAGER | ADMIN |
|---|:---:|:---:|:---:|
| `POST /auth/login` | ✅ | ✅ | ✅ |
| `GET /health` | ✅ | ✅ | ✅ |
| `POST /document/upload` | ✅ | ❌ | ❌ |
| `POST /document/:id/xml` | ✅ | ❌ | ❌ |
| `GET /document` | ✅ | ✅ | ✅ |
| `GET /document/stats` | ❌ | ✅ | ✅ |
| `GET /document/report` | ❌ | ✅ | ✅ |
