# Rumo — Contexto do Projeto

## Visão Geral

App React Native (Expo) 100% offline para acompanhar vícios (dias sem ceder, vários ao mesmo tempo), organizar rotinas/cronogramas e focar com Pomodoro. Não há conta, login, backend nem rede: tudo fica em SQLite no aparelho. O usuário escolhe um nome de usuário no perfil, usado para personalizar as notificações locais. O app importa e exporta **um formato só**, um arquivo `.db` (mesmo esquema do `rumo.db`), usado como backup e para preencher rotina, tarefas e metas; os `.md` de `seed/` são convertidos em `seed/rumo-seed.db` por script. UI em português brasileiro. Android é a plataforma inicial; iOS depois.

## Estrutura

```
src/
  components/    # Componentes compartilhados de UI
  database/      # SQLite, migrations e repositories
  features/      # Módulos por domínio
    addictions/    # Vícios, contador de dias, recaídas, marcos
    routine/       # Rotinas e cronograma semanal
    profile/       # Nome de usuário e preferências de notificação
    notifications/ # Agendamento de notificações locais
    focus/         # Temporizador de foco (25/5/15), sessões e progresso das metas
    dataTransfer/  # Importação e backup em um único arquivo .db
  app/           # Rotas do Expo Router (arquivos finos que reexportam as telas)
  styles/        # Design tokens
  utils/         # Utilitários globais
  types.ts       # Tipos e constantes de negócio
  __tests__/     # Testes espelhando a source
seed/            # .md de origem e rumo-seed.db gerado a partir deles
tools/seed/      # Conversor de .md em .db (npm run seed:build)
App.tsx          # Raiz do app
```

## Stack

Expo + React Native + TypeScript estrito (development build), Expo Router, `expo-sqlite`, Zustand, React Hook Form + Zod, `expo-notifications`, `expo-document-picker` + `expo-file-system`, `date-fns` (pt-BR), Biome, Jest + React Native Testing Library, EAS Build. Detalhes no `README.md`.

## Convenções de Código

- **Named exports exclusivamente** — sem `export default`. Única exceção: arquivos de rota em `src/app/`, que o Expo Router exige como `export default`; eles só reexportam a tela nomeada de `features/`
- **PascalCase**: componentes, screens, stores, arquivos de rota
- **camelCase**: utilitários, schemas, variáveis, funções
- **SCREAMING_SNAKE_CASE**: constantes imutáveis compartilhadas e chaves de configuração
- **Alias `@/`** mapeando `src/` (`import { X } from "@/components/X"`)
- **Indentação**: tab · **Aspas**: duplas (Biome)
- **Idioma**: português brasileiro em toda UI, mensagens de validação, placeholders e textos de notificação
- **Nomes de variáveis, funções e parâmetros em inglês** — português apenas em strings de UI
- **Props interface**: `ComponentNameProps`

## Padrões Específicos

### Estado (Zustand)

- Stores em memória, hidratadas e sincronizadas pelos repositories do Expo SQLite
- Hook exportado como `use[Nome]Store`
- Reset em testes: `use[Nome]Store.setState({ ... })` no `beforeEach`

### Banco Local (SQLite)

- `SQLiteProvider` na raiz, banco `rumo.db`
- Migrations versionadas por `PRAGMA user_version` em `src/database/migrations/`
- Telas e stores não executam SQL diretamente; repositories ficam em `src/database/repositories/`
- Acesso por repositories com SQL, sem ORM
- Datas guardadas em ISO 8601 (UTC); o fuso do aparelho só é aplicado na exibição
- Alterações de schema por migrations testadas, sem apagar ou substituir dados do usuário silenciosamente
- Dias sem ceder são **calculados** a partir de `quit_at` (ou da última recaída), nunca armazenados como contador

### Runtime Offline

- Sem autenticação, Firebase, analytics, anúncios ou qualquer chamada de rede
- A abertura depende apenas da hidratação do SQLite
- Notificações são **locais** (`expo-notifications`), agendadas no aparelho
- Importação e backup usam o seletor de arquivos e a folha de compartilhamento do sistema; o `.db` é lido e gravado localmente e nunca enviado

### Importação e backup (.db)

- Formato único: SQLite com o esquema do `rumo.db`; backup completo e arquivo de plano (`seed/rumo-seed.db`) são lidos pelo mesmo código em `features/dataTransfer/`
- O arquivo é aberto em banco temporário (`deserializeDatabaseAsync`), atualizado pelas migrations e só então lido; nunca se escreve nele nem se abre o `rumo.db` por cima
- Cada categoria presente no arquivo substitui a atual, numa transação; mostrar sempre a pré-visualização antes de aplicar
- Os `.md` de `seed/` são a fonte de edição; `npm run seed:build` (em `tools/seed/`) regenera `rumo-seed.db`, e um teste garante que ele está em dia
- Nunca registrar em log nomes de vícios, anotações nem o conteúdo importado

### Notificações

- Textos com `{username}` e variáveis (`{days}`, `{addiction}`, `{activity}`) substituídas no agendamento
- Tipos: marco de dias sem ceder, acolhimento após recaída (2 h depois, sem citar o vício), lembrete de bloco da rotina, mensagem de apoio diária, fim de foco e de pausa do Pomodoro
- Lembrete de rotina padrão: **10 minutos antes** do bloco (`reminder_minutes`, ajustável por bloco)
- Alarme exato no Android 14+: declarar `SCHEDULE_EXACT_ALARM`, checar a permissão antes de agendar e levar a pessoa à tela de ajustes quando faltar; se negada, agendar com horário aproximado e avisar na tela. Não usar `USE_EXACT_ALARM`
- Todo agendamento é recalculado ao mudar nome de usuário, vício, rotina ou preferências
- Mensagens nunca culpam, ameaçam ou ridicularizam; recaída é tratada com acolhimento
- Opção de notificação discreta (sem o nome do vício na tela bloqueada)
- Estrutura em `features/notifications/`: `messages.ts` (textos), `planner.ts` (planejamento puro, testável), `notificationsClient.ts` (único arquivo que importa `expo-notifications`), `syncNotifications.ts` (lê o banco e reagenda tudo, em fila), `pomodoroAlerts.ts` (avisos do foco, identificadores `pomodoro:*` preservados pelo sync) e `NotificationSync` no layout raiz
- Marcos entre 22h e 8h são entregues às 8h; lembrete de rotina com `reminder_minutes = 0` não agenda nada

### Pomodoro

- O temporizador guarda o horário de término (timestamp), não um contador em memória, para continuar correto com o app em segundo plano
- Fim de foco e de pausa são agendados como notificações locais ao iniciar a sessão
- Sessões concluídas alimentam o progresso das metas semanais (`weekly_goals`)
- Tempos fixos na primeira versão, como constantes em `types.ts`: foco 25 min, pausa 5 min, pausa longa 15 min a cada 4 ciclos
- Ao fim de um foco ligado a uma tarefa, a preferência `pomodoro_on_focus_end` decide: `ask` (padrão, pergunta se concluiu) ou `auto_complete` (marca como feita); a opção fica em Configurações

### Formulários

- React Hook Form + Zod + `@hookform/resolvers`
- Schema em `features/{feature}/schemas/` (camelCase)
- Controller + FormInput para integração
- Controles inline com atualização imediata de store (sem submit) não precisam virar formulários

### UI

- Design tokens de `@/styles/tokens` (colors, spacing, borderRadius, fontSize, …)
- Componentes compartilhados em `@/components/` (CustomButton, FormInput, ConfirmModal, …)
- Ícones: `@expo/vector-icons` (MaterialCommunityIcons)
- Visual calmo e de baixo estímulo, com modo escuro; telas pequenas em primeiro lugar
- Texto de apoio em tom acolhedor e direto

### Navegação

- **Expo Router** com rotas por arquivo em `src/app/` e `typedRoutes` ativado
- Layout de abas em `src/app/(tabs)/`: **Vícios**, **Rotina**, **Foco** (Pomodoro), **Perfil**
- Arquivos de rota ficam finos: `export { AddictionsScreen as default } from "@/features/addictions/screens/AddictionsScreen"`
- Nomes de arquivo de rota seguem a convenção do Expo Router (minúsculas, `[id].tsx` para parâmetros); a lógica e as telas continuam em PascalCase dentro de `features/`

## Testes

### Mobile (Jest + React Native Testing Library)

- `jest-expo` preset
- `render`, `fireEvent`, `waitFor` de `@testing-library/react-native`
- Rodar com `npm test -- --runInBand`
- Relógio e IDs injetados para testes determinísticos (contagem de dias, marcos, agendamento)
- Imports **relativos** nos testes (não usar `@/`)
- Arquivo: `{SourceName}.test.ts(x)` em `src/__tests__/`
- **Estrutura espelha a source**: `src/features/X/stores/Y.ts` → `src/__tests__/features/X/stores/Y.test.ts`

## Regras de Workflow

Estas regras são obrigatórias em toda interação:

1. **Testes obrigatórios** — toda implementação deve incluir testes para a nova funcionalidade
2. **Suite de testes** — após qualquer alteração, rodar `npm test -- --runInBand` e corrigir falhas
3. **Typecheck + Biome** — após qualquer alteração, rodar `npx tsc --noEmit` e `npx biome check --write` e corrigir todos os erros
4. **README** — toda nova feature, modificação ou correção deve atualizar o `README.md` refletindo o que mudou
5. **Toast de confirmação** — toda ação do usuário que muda dados ou estado (salvar, editar, excluir, importar, registrar recaída etc.) deve mostrar um toast ao terminar, usando `notification` de `@/components/notifications`: `success` ao concluir, `error` com mensagem amigável em português ao falhar e `info` para avisos e bloqueios. Nenhuma ação termina em silêncio. O teste da funcionalidade deve verificar o toast
6. **Privacidade** — não registrar nomes de vícios, notas ou conteúdo de arquivos importados em logs
7. **Dados do usuário** — nunca apagar ou reescrever dados locais sem migration versionada e testes de compatibilidade
