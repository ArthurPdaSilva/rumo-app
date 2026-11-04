# Rumo

Aplicativo React Native (Expo) para acompanhar vícios e organizar rotinas. É **100% offline**: sem conta, sem login, sem servidor. Os dados ficam no aparelho, em SQLite.

## Status

Nome definitivo: **Rumo**. O projeto Expo está criado e validado (typecheck, Biome, 298 testes e export do bundle Android). Já existem o banco com a migration inicial, os repositories de perfil e vícios, o cálculo de dias sem ceder, o toast de confirmação, o **onboarding, a tela de Perfil e a tela de Vícios** (lista, cadastro, detalhe, recaída e exclusão), a **importação e o backup em `.db`** (um formato só, com pré-visualização) a **tela de Rotina** (dia, tarefas e metas, com criação e edição de blocos) a **tela de Foco** (Pomodoro 25/5/15, histórico de sessões e progresso das metas semanais) e as **notificações locais** (marcos, lembretes da rotina, mensagem diária e avisos do foco). As funcionalidades das telas vêm nas próximas etapas do roadmap. Os documentos de contexto estão em [`AGENTS.md`](AGENTS.md) e os arquivos de exemplo em [`seed/`](seed).

## Como rodar

```bash
npm install
npx expo prebuild --platform android   # primeira vez, gera a pasta android/
npm run android                         # development build no aparelho ou emulador
```

O app usa módulos nativos (SQLite e notificações), então roda em development build, não no Expo Go.

## Escopo da primeira versão

### 1. Perfil

- Escolha de **nome de usuário** (único dado obrigatório, sem senha).
- Esse nome entra nas notificações personalizadas (`{username}`).
- Preferências de notificação: ligar/desligar, horário da mensagem diária, modo discreto.
- Importação de um arquivo `.db` para **preencher o perfil automaticamente**, e o mesmo formato como **backup** (ver abaixo).

### 2. Vícios

- Cadastro de **vários vícios** ao mesmo tempo, cada um com nome, ícone e data e hora em que parou.
- Lista com todos os vícios e o contador de cada um; ao abrir um deles, o detalhe.
- Tela de detalhe com o contador de **dias sem ceder**, mostrando também horas e o melhor período.
- Registro de recaída sem culpa: reinicia a contagem, guarda o histórico e uma nota opcional.
- Marcos de 1, 3, 7, 14, 30, 60, 90, 180 e 365 dias; o card mostra o progresso até o próximo e a notificação chega com as notificações locais.
- Exclusão com confirmação, que apaga também o histórico de recaídas.

### 3. Rotinas e cronograma

- Grade semanal com blocos de horário: **dia útil**, **sábado** e **domingo**.
- Visão do dia atual com o bloco em andamento destacado.
- Criação e edição manual de blocos, além dos importados.
- Tarefas com marcação de concluído (vindas das listas `- [ ]` dos `.md` convertidos em `.db`).
- Lembrete de notificação **10 minutos antes** de cada bloco (padrão, ajustável por bloco e nas preferências).
- Metas semanais de horas por atividade, com progresso calculado pelo tempo realmente feito no Pomodoro.

### 4. Pomodoro

- Temporizador de foco integrado com tempos **fixos na primeira versão**: 25 min de foco, 5 de pausa e pausa longa de 15 min a cada 4 ciclos (o Cronograma importado também usa 25/5). Tempos configuráveis ficam para uma versão futura.
- Pode ser iniciado a partir de um bloco da rotina ou de uma tarefa, e o tempo de foco conta para a meta semanal da atividade.
- Notificação local ao fim de cada foco e de cada pausa, funcionando com o app em segundo plano.
- Ao terminar um foco ligado a uma tarefa, o app **pergunta** se ela foi concluída. Em Configurações há a opção "Ao concluir um foco": _Perguntar_ (padrão) ou _Marcar tarefa como feita automaticamente_.
- Histórico de sessões por dia e por atividade.

### Fora do escopo agora

Login, sincronização em nuvem, backend, ranking ou comunidade, anúncios, iOS e bloqueio por PIN ou biometria (pode entrar depois como opcional).

## Importação e backup: um formato só (`.db`)

Importar e fazer backup usam **o mesmo arquivo**: um banco SQLite com o mesmo esquema do `rumo.db` (extensão `.db`). Não há mais importação direta de `.md` dentro do app.

| Arquivo                                   | O que tem                                                                      | Como o app trata                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `seed/rumo-seed.db`                       | Rotina (59 blocos), tarefas (80) e metas semanais (16), gerado dos `.md`       | **Arquivo de plano**: substitui só rotina, tarefas e metas |
| Backup (`rumo-backup-AAAA-MM-DD-HHMM.db`) | Tudo: perfil, preferências, vícios, recaídas, rotina, tarefas, metas e sessões | **Backup completo**: o app fica igual ao arquivo           |

Os `.md` continuam em [`seed/`](seed) como **fonte de edição**. Para atualizar o plano, edite os `.md` e rode:

```bash
npm run seed:build
```

O script (`tools/seed/`) lê `Cronograma.md` e `Rota_de_estudos.md` e escreve `seed/rumo-seed.db`. Um teste falha se o `.db` versionado ficar diferente dos `.md`.

Regras de leitura dos `.md` (usadas só pelo script):

- Título `##` seguido de tabela com colunas `Horário` e `Atividade` vira um conjunto de blocos. O dia é inferido do título: "Dia útil (segunda a sexta)", "Sábado", "Domingo".
- Intervalos como `09:40–10:40` viram início e fim; o travessão e o hífen são aceitos.
- Linhas `- [ ]` e `- [x]` viram tarefas, agrupadas pelo título da seção. Itens sem `[ ]` não viram tarefa.
- Tabelas com coluna de horas por semana viram metas semanais. Formatos aceitos: `4h`, `3h30`, `45 min`, `1h40 (20 min por dia útil)`; textos extras viram nota.
- Front-matter e callouts do Obsidian são ignorados.

### Como a importação e o backup funcionam hoje

- Perfil → "Abrir importação e backup" (`/data`).
- **Importar**: escolher o `.db` → pré-visualização (o que o arquivo traz e quanto será substituído) → "Importar". Se algo atual for substituído, há uma confirmação extra. Nada é gravado antes de confirmar e a importação é uma transação única.
- **Cada categoria que o arquivo traz substitui a atual** (perfil, vícios com recaídas, blocos de rotina, tarefas, metas, sessões de foco). O que o arquivo não traz fica como está.
- Em **arquivo de plano** (sem vícios nem perfil), tarefas já concluídas continuam concluídas. Em **backup completo**, o resultado é uma cópia exata.
- Arquivos de versões antigas do esquema são atualizados antes da leitura. Arquivos de versão mais nova que o app e arquivos que não são do Rumo são recusados com aviso.
- **Backup**: "Fazer backup" gera `rumo-backup-….db` a partir do banco atual e abre a folha de compartilhamento do Android (Drive, Arquivos, etc.). O backup **não é criptografado** e contém nomes de vícios e anotações: guarde em lugar seguro. O arquivo é lido e gravado só no aparelho; o app nunca o envia.
- Dias da semana são guardados numa máscara de bits que segue `Date#getDay()`: domingo = 1, segunda = 2, terça = 4, quarta = 8, quinta = 16, sexta = 32, sábado = 64 (dia útil = 62).
- Blocos importados ganham o lembrete padrão de 10 minutos antes. O agendamento em si vem com as notificações locais.
- A tabela `imports` e as colunas `import_id` ficam reservadas e hoje não são usadas.

### Como a Rotina funciona hoje

- A aba **Rotina** tem três partes: **Dia**, **Tarefas** e **Metas**.
- **Dia**: seletor de Dom a Sáb (abre no dia de hoje) e a lista dos blocos daquele dia, por horário. Em hoje, o bloco em andamento aparece destacado com "Agora" e o primeiro que ainda vai começar com "Próximo"; os já passados ficam esmaecidos. Blocos que terminam às 00:00 valem até o fim do dia, e um bloco sem horário de fim vale até o início do seguinte.
- **Criar e editar blocos** (`/blocks/new` e `/blocks/[id]`): nome, início, fim opcional, dias da semana, lembrete em minutos antes (padrão 10; 0 desliga) e anotações. Excluir pede confirmação. Os blocos importados e os criados à mão são tratados igual.
- **Tarefas**: agrupadas por seção com contagem (ex.: "Português (1/13)"); tocar marca ou desmarca, com toast. O estado concluído sobrevive a reimportar um arquivo de plano.
- **Metas**: horas por semana de cada atividade, com a observação do arquivo. O progresso real (tempo feito no Pomodoro) aparece na aba Foco.
- Importar um arquivo `.db` recarrega a Rotina automaticamente.

### Como o Perfil funciona hoje

- Na primeira abertura, se não houver nome de usuário, o app leva ao **onboarding** (`/onboarding`), onde a pessoa escolhe o nome (2 a 24 caracteres).
- A aba **Perfil** permite editar o nome e o horário da mensagem diária (`HH:MM`), ligar ou desligar as notificações e ativar o modo discreto. Cada ação mostra um toast de confirmação ou de erro.
- O botão "Abrir importação e backup" leva à tela `/data`, descrita em "Como a importação e o backup funcionam hoje".
- As preferências já ficam salvas em `profile`; o agendamento das notificações que as usa entra na etapa de notificações.

### Como o Foco funciona hoje

- **Tempos fixos**: 25 min de foco, 5 de pausa e 15 de pausa longa depois de 4 focos. Ao acabar um foco a pausa começa sozinha; ao acabar a pausa o app espera você iniciar o próximo foco. Os quatro pontinhos mostram o ciclo.
- **No que focar**: o bloco da rotina em andamento (se houver) vem selecionado, seguido das atividades das metas semanais e das seções de tarefas; "Foco livre" não conta para nenhuma meta. Dá para escolher uma tarefa aberta da atividade.
- **O relógio usa horário, não contagem de ticks**: se o app ficar em segundo plano, ao voltar a fase vencida é fechada com a duração certa. Com o app fechado, o aviso de fim de foco e de pausa chega como notificação local (agendada ao iniciar o foco).
- **Só o foco é gravado** em `pomodoro_sessions`, com `activity`, bloco e tarefa. Foco cancelado fica com `completed = 0` e não conta. Se o app for fechado no meio de um foco, a sessão aberta é encerrada na próxima abertura sem contar tempo.
- **Metas**: o progresso da semana (segunda a domingo) soma os minutos de focos concluídos por atividade, comparando o nome da atividade com o da meta.
- **Fim do foco com tarefa**: no modo `ask` o app pergunta se concluiu; em `auto_complete` marca como feita. A chave fica na própria tela de Foco.

## Notificações personalizadas

Todas locais, agendadas no aparelho (`expo-notifications`). Exemplos de modelo:

| Tipo                  | Exemplo                                                    |
| --------------------- | ---------------------------------------------------------- |
| Marco                 | "Parabéns, {username}! {days} dias sem {addiction}."       |
| Apoio diário          | "Bom dia, {username}. Hoje é mais um dia de cada vez."     |
| Rotina (10 min antes) | "{username}, em 10 minutos: {activity}."                   |
| Pomodoro              | "Foco concluído, {username}! Pausa de 5 minutos."          |
| Após recaída          | "{username}, recomeçar faz parte. Hoje é o dia 1 de novo." |

O modo discreto troca o nome do vício por um texto genérico na tela bloqueada.

### Como as notificações funcionam hoje

- **Tudo é recalculado do banco**: ao abrir o app, ao voltar para ele e (com 0,5 s de espera) sempre que perfil, vícios ou rotina mudam, o app cancela o que estava agendado e agenda de novo (`syncNotifications`). Isso cobre nome de usuário, recaída, vício novo, bloco editado, importação de `.db` e as chaves do Perfil.
- **Marcos**: para cada vício ativo, os próximos 3 marcos (1, 3, 7, 14, 30, 60, 90, 180 e 365 dias) como avisos de data. Marco que cai entre 22h e 8h é entregue às 8h. Uma recaída muda o início da contagem e os marcos são recalculados.
- **Mensagem diária**: todo dia no horário do Perfil (padrão 08:30).
- **Rotina**: um lembrete semanal por dia de cada bloco, `reminder_minutes` antes do início (padrão 10; **0 desliga**). Lembrete que cai antes da meia-noite vai para o dia anterior.
- **Foco**: ao iniciar, agenda o fim do foco (com o tamanho da pausa que vem depois, 5 ou 15 min) e o fim dessa pausa. Cancelar o foco ou pular a pausa cancela esses avisos. Com o app aberto eles não aparecem (a tela já avisa por toast).
- **Modo discreto**: o texto do marco não cita o vício.
- **Permissões**: o app pede a permissão de notificações uma vez por abertura quando ela ainda não foi decidida. No Perfil, se o sistema bloqueou as notificações ou negou o alarme exato (Android 12+), aparece um aviso com o botão certo. Sem o alarme exato os avisos continuam, só podem atrasar alguns minutos.
- **Canais do Android**: "Lembretes da rotina", "Marcos e mensagem diária" e "Foco e pausas", que dá para silenciar separadamente nos ajustes do sistema.
- **Não implementado**: o texto "Após recaída" da tabela acima ainda não é enviado, e o iOS limita a 64 agendamentos (o Android, plataforma inicial, não).

## Modelo de dados (SQLite, `rumo.db`)

| Tabela                 | Campos principais                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `profile`              | `id`, `username`, `notifications_enabled`, `daily_message_time`, `discreet_mode`                                     |
| `addictions`           | `id`, `name`, `icon`, `quit_at`, `created_at`, `archived_at`                                                         |
| `relapses`             | `id`, `addiction_id`, `occurred_at`, `note`                                                                          |
| `routine_blocks`       | `id`, `weekdays` (máscara), `start_time`, `end_time`, `title`, `notes`, `import_id`, `reminder_minutes` (padrão 10)  |
| `tasks`                | `id`, `section`, `title`, `done`, `import_id`                                                                        |
| `weekly_goals`         | `id`, `activity`, `target_minutes`, `note`, `import_id`                                                              |
| `app_state` (Pomodoro) | `pomodoro_on_focus_end` (`ask` ou `auto_complete`, padrão `ask`); tempos 25/5/15 e 4 ciclos são constantes no código |
| `pomodoro_sessions`    | `id`, `started_at`, `ended_at`, `kind` (foco/pausa), `routine_block_id`, `task_id`, `activity`, `completed`          |
| `imports`              | `id`, `file_name`, `content_hash`, `imported_at`                                                                     |
| `app_state`            | `theme_mode`, `onboarding_done`                                                                                      |

Dias sem ceder = agora − (última recaída ou `quit_at`). Nenhum contador é gravado, então mudar o fuso ou o relógio não corrompe os dados.

## Stack e ferramentas

| Camada            | Escolha                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Base              | Expo + React Native + TypeScript estrito, com development build (`expo-dev-client`); versão do SDK fixada ao criar o projeto            |
| Navegação         | Expo Router (rotas por arquivo em `src/app/`, abas e pilhas, rotas tipadas)                                                             |
| Dados             | `expo-sqlite` (`rumo.db`) com migrations por `PRAGMA user_version` e repositories com SQL                                               |
| Estado            | Zustand                                                                                                                                 |
| Formulários       | React Hook Form + Zod                                                                                                                   |
| Notificações      | `expo-notifications` (somente locais)                                                                                                   |
| Importar e backup | `.db` único: `expo-document-picker`, `expo-file-system`, `expo-sharing` e `expo-sqlite` (`serializeAsync` / `deserializeDatabaseAsync`) |
| Datas             | `date-fns` com locale pt-BR                                                                                                             |
| UI                | `StyleSheet` com design tokens, `@expo/vector-icons`, componente de toast reaproveitado do VCampos                                      |
| Qualidade         | Biome, `tsc`, Jest + React Native Testing Library, GitHub Actions                                                                       |
| Build             | EAS Build (AAB para Android); iOS depois                                                                                                |

### Alarmes no Android 14+

Lembretes de rotina (10 min antes) e fim de foco do Pomodoro precisam de horário certo. O app declara `SCHEDULE_EXACT_ALARM`, verifica a permissão antes de agendar e, quando ela falta, leva a pessoa à tela de ajustes do sistema. Se a permissão for negada, o app segue funcionando com horário aproximado e avisa isso na tela. `USE_EXACT_ALARM` não será usado, porque a Play Store o reserva para apps de despertador e calendário.

## Estrutura

```text
src/
  components/
  database/            migrations e repositories
  features/
    addictions/
    routine/
    profile/
    notifications/
    focus/
    dataTransfer/
  app/                 rotas do Expo Router (arquivos finos que reexportam as telas)
  styles/
  utils/
  __tests__/           espelha a source
tools/seed/            conversor de .md em rumo-seed.db (npm run seed:build)
seed/                  Cronograma.md, Rota_de_estudos.md e rumo-seed.db
```

## Roadmap

- [x] Criar o projeto Expo com Expo Router, TypeScript, Biome, Jest e alias `@/`
- [x] SQLiteProvider, migration 001 e repositories
- [x] Perfil: nome de usuário e onboarding
- [x] Vícios: cadastro, contador, recaída e exclusão (as notificações de marco entram com as notificações locais)
- [x] Notificações locais com `{username}` (marcos, mensagem diária, modo discreto, permissão de alarme exato)
- [x] Rotina: visão por dia da semana, bloco em andamento, criação, edição e exclusão de blocos, tarefas e metas
- [x] Lembrete 10 minutos antes de cada bloco (ajustável por bloco; 0 desliga)
- [x] Pomodoro fixo 25/5/15: temporizador, sessões gravadas no banco e opção perguntar/automático
- [x] Aviso de fim de foco e de pausa com o app em segundo plano
- [x] Metas semanais de horas com progresso vindo do Pomodoro
- [x] Conversor de `.md` em `.db` (`npm run seed:build`) com testes sobre os arquivos de `seed/`
- [x] Importação de `.db` com pré-visualização e preenchimento automático do perfil (rotina, tarefas e metas semanais)
- [x] Tarefas importadas das listas `- [ ]` (a tela para ver e marcar as tarefas vem com a Rotina)
- [x] Backup e restauração em um único arquivo `.db` (mesmo formato da importação)
- [x] Ícone (letra R com seta) e splash
- [ ] Modo escuro: revisão visual das telas

## Decisões tomadas

- Vários vícios ao mesmo tempo.
- Importação e backup usam **um formato só**, o `.db`; os `.md` viram `seed/rumo-seed.db` por script e preenchem rotina, tarefas e metas semanais de horas.
- Lembrete de rotina 10 minutos antes do bloco.
- O app inclui um Pomodoro fixo em 25/5/15 (pausa longa a cada 4 ciclos) na primeira versão.
- Ao fim de um foco, o app pergunta se a tarefa foi concluída; Configurações permite trocar para marcar automaticamente.
- O nome definitivo é Rumo.
- Acesso ao SQLite por repositories com SQL, sem ORM.
- Navegação com Expo Router.
- Alarmes exatos via `SCHEDULE_EXACT_ALARM` com pedido guiado e degradação para horário aproximado.

## Perguntas em aberto

1. Bloqueio opcional por PIN ou biometria para proteger dados sensíveis, mesmo sem login.

## Aviso

O Rumo é uma ferramenta de acompanhamento pessoal e não substitui apoio profissional. Em situação de crise, o CVV atende pelo 188, 24 horas por dia.

## Qualidade

```bash
npm run lint:fix      # Biome
npm run typecheck     # tsc --noEmit
npm test -- --runInBand
```

Os testes de banco usam um SQLite real em memória (`node:sqlite`, Node 22 ou superior), com a mesma API assíncrona do `expo-sqlite`.

## Licença

A licença do projeto ainda será definida.

## Ícone do app

Letra **R** em branco, com a perna em turquoise terminando em seta para a direita ("seguir em frente"), sobre gradiente teal (`#14938A` → `#0B5A55`) e acento `#2DD4BF`. Os arquivos em `assets/images/` são `icon`, `android-icon-{foreground,background,monochrome}`, `splash-icon` e `favicon`. O adaptive icon usa fundo `#0F766E`; o ícone temático (monochrome) é o R em silhueta. Para ver o ícone novo é preciso gerar um novo development build (`npm run android`).
