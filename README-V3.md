# Lógicas PXG — V3.3

## Novidade: proteção progressiva de login

A V3.3 adiciona uma camada de proteção no navegador para reduzir tentativas repetidas de senha:

- 1ª a 3ª falha: sem espera;
- 4ª falha: 10 segundos;
- 5ª falha: 30 segundos;
- 6ª falha: 1 minuto;
- 7ª falha: 5 minutos;
- 8ª falha em diante: 15 minutos;
- login correto: zera o contador;
- após 30 minutos sem novas falhas, o histórico local é descartado;
- quando o Supabase responder com `429 / Too Many Requests`, o site aplica uma espera local de 15 minutos.

Durante o bloqueio, o botão **Entrar** fica desabilitado e mostra uma contagem regressiva.

### Importante sobre segurança

Essa espera progressiva usa `localStorage`, então ela serve como uma camada adicional de UX e redução de abuso casual. Ela **não substitui uma proteção de servidor**, pois um usuário avançado consegue limpar o armazenamento do navegador. O Supabase Auth continua responsável pelo rate limiting no servidor. Para uma etapa futura de endurecimento, o projeto pode receber CAPTCHA/Turnstile e uma camada server-side/Edge Function.

---


## V3.1 — correção de acesso administrativo

- O link **Painel administrativo** só é exibido quando o perfil autenticado possui `role = admin`.
- O conteúdo de `admin.html` inicia oculto e só é renderizado após o Supabase confirmar o papel de administrador.
- Atributos HTML `hidden` agora têm precedência sobre regras de layout CSS.
- Usuários comuns que digitarem `admin.html` manualmente verão apenas a mensagem de acesso restrito.
- A validação do nome de usuário foi movida para JavaScript para evitar incompatibilidade do atributo `pattern` em navegadores recentes.

# Lógicas PXG — V3

Esta versão transforma o site estático em uma aplicação com **Supabase**.

## O que mudou

- Cadastro de usuários por e-mail e senha.
- Login e sessão persistente.
- Nome de usuário público; e-mail continua privado.
- Reações **👍 Curtir** e **❤️ Amei** em cada matéria.
- Comentários nas matérias.
- Usuário pode apagar o próprio comentário.
- Administrador pode moderar comentários.
- Matérias ficam no banco de dados, não mais no `posts.js`.
- `admin.html` não possui senha escrita no JavaScript.
- O painel só abre quando o banco confirma que a conta possui `role = 'admin'`.
- Criação, edição, destaque, rascunho e exclusão de matérias direto pelo painel.

> `posts.js` continua no pacote apenas como conteúdo de demonstração caso o Supabase ainda não tenha sido configurado.

---

# 1. Criar o projeto no Supabase

1. Entre no Supabase e crie um projeto novo.
2. Aguarde o banco terminar de ser criado.
3. Abra **SQL Editor**.
4. Abra o arquivo `database.sql` deste pacote.
5. Copie TODO o conteúdo e execute no SQL Editor.

Esse SQL cria:

- `profiles`
- `posts`
- `reactions`
- `comments`
- políticas de Row Level Security (RLS)
- criação automática do perfil após cadastro
- permissões de administrador
- as matérias de exemplo da V2

---

# 2. Conectar o site ao Supabase

No painel do Supabase, encontre a **Project URL** e a **Publishable key** (em projetos antigos ela pode aparecer como `anon key`).

Abra:

`supabase-config.js`

Você encontrará:

```js
window.LOGICAS_PXG_CONFIG = {
  supabaseUrl: "COLE_AQUI_A_URL_DO_PROJETO",
  supabaseAnonKey: "COLE_AQUI_A_PUBLISHABLE_KEY"
};
```

Substitua os dois valores.

### IMPORTANTE

A **Publishable/anon key** pode ficar no navegador. A proteção real é feita pelas regras RLS do banco.

**NUNCA coloque a `service_role` key em nenhum arquivo do site.** Ela ignora as regras de segurança e deve permanecer secreta.

---

# 3. Criar sua conta

1. Abra `index.html`.
2. Clique em **Entrar**.
3. Selecione **Criar conta**.
4. Informe nome de usuário, e-mail e senha.

Por padrão, a conta nasce com:

`role = user`

Ela poderá comentar e reagir, mas NÃO poderá publicar matérias.

## Confirmação de e-mail

Para testes locais, você pode desativar temporariamente a confirmação de e-mail nas configurações de Auth do Supabase.

Para o site público, o recomendado é deixar a confirmação ativa e configurar a URL oficial do site nas configurações de autenticação.

---

# 4. Transformar a SUA conta em administrador

Depois de criar sua conta, abra o **SQL Editor** do Supabase e execute APENAS este comando, trocando o e-mail:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where email = 'SEU_EMAIL_AQUI'
);
```

Exemplo:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where email = 'gabriel@exemplo.com'
);
```

Depois faça logout e login novamente no site.

No menu da sua conta aparecerá:

`⚙ Painel administrativo`

Usuários comuns não verão essa opção e, mesmo que descubram o endereço `admin.html`, o painel consulta o banco e bloqueia o acesso se `role` não for `admin`.

---

# 5. Publicar uma matéria

Entre com sua conta de administrador e abra o painel.

Você poderá preencher:

- Título
- Categoria
- Autor
- Índice de Lógica PXG
- Emoji
- Cor da capa
- Data/hora
- Resumo
- Texto completo
- Destaque
- Publicada / rascunho

Clique em **Publicar matéria**.

A matéria será gravada diretamente no Supabase e aparecerá no site. Não é mais necessário baixar um `posts.js` novo.

---

# 6. Curtidas, Amei e comentários

Visitante sem conta:

- pode ler matérias;
- pode ver reações;
- pode ler comentários.

Usuário logado:

- pode escolher `Curtir` ou `Amei`;
- pode trocar/remover sua reação;
- pode comentar;
- pode excluir o próprio comentário.

Administrador:

- possui tudo acima;
- pode excluir comentários de qualquer usuário pelo painel.

Cada usuário possui somente uma reação ativa por matéria: `Curtir` OU `Amei`.

---

# 7. Segurança

A segurança desta V3 não depende de esconder `admin.html`.

Ela funciona em camadas:

1. Supabase Auth valida e-mail e senha.
2. O usuário recebe uma sessão autenticada.
3. A tabela `profiles` informa se ele é `user` ou `admin`.
4. As políticas RLS do PostgreSQL verificam cada operação.
5. Um usuário comum que tentar chamar o banco manualmente para publicar uma matéria será recusado.
6. A coluna `role` não possui permissão de alteração pela API do usuário comum.

As senhas dos usuários não ficam em `script.js`, `admin.js`, `profiles` ou qualquer arquivo público do projeto. Elas são tratadas pelo Supabase Auth.

---

# 8. Testar pelo arquivo no PC

Você ainda pode abrir o `index.html` diretamente no navegador.

Como o site agora consulta o Supabase pela internet, o computador precisa estar conectado à internet.

Se ainda não configurar o `supabase-config.js`, o site entra automaticamente em **modo demonstração**: mostra as matérias antigas, mas login, comentários e reações ficam desativados.

---

# 9. Colocar no GitHub Pages

Depois de testar:

1. Envie todos os arquivos desta pasta para o repositório.
2. Ative GitHub Pages nas configurações do repositório.
3. Configure no Supabase a URL pública do seu GitHub Pages como URL do site/redirect permitido para autenticação.

Arquivos que precisam ser publicados:

- `index.html`
- `admin.html`
- `styles.css`
- `admin.css`
- `script.js`
- `admin.js`
- `supabase-config.js`
- `posts.js` (fallback opcional)

`database.sql` e este README não precisam estar públicos para o site funcionar, embora possam ficar no repositório se você quiser.

---

# 10. Fluxo final

```text
Visitante
   ↓
Lógicas PXG
   ├── lê matérias
   ├── lê comentários
   └── vê reações

Usuário cadastrado
   ↓
Supabase Auth
   ├── Curtir 👍
   ├── Amei ❤️
   ├── Comentar 💬
   └── Excluir próprio comentário

Administrador
   ↓
admin.html
   ├── Criar matéria
   ├── Editar matéria
   ├── Excluir matéria
   ├── Criar rascunho
   ├── Definir destaque
   └── Moderar comentários
```

## Próximas melhorias possíveis

A base agora permite adicionar depois: avatar, perfil público, resposta a comentários, denúncias, ranking das matérias mais curtidas, notificações, recuperação de senha, login pelo Google/Discord, paginação e painel de estatísticas.


## Segurança visual do painel (V3.2)

- O link **Painel administrativo** não existe no HTML público por padrão. Ele é criado via JavaScript somente depois que o Supabase confirma `profiles.role = 'admin'`.
- `admin.html` inicia totalmente invisível. Se não houver sessão administrativa válida, o visitante é redirecionado para `index.html` sem visualizar o editor.
- A proteção real continua sendo o RLS do Supabase: esconder a interface não substitui as políticas do banco.


## V3.4 — Engraçado, contadores, admins e usernames únicos

Se você já configurou o banco usando uma versão V3/V3.3, abra o **SQL Editor** do Supabase e execute **MIGRATION-V3.4.sql** uma única vez. Não é necessário executar `database.sql` novamente.

### Reações
Cada conta continua tendo apenas **uma reação por matéria**, mas agora existem três opções: 👍 Curtir, ❤️ Amei e 😂 Engraçado. Clicar na mesma reação novamente remove a reação; escolher outra troca a reação anterior. Os cards da página inicial exibem as três contagens apenas para consulta.

### Gestão de administradores
No `admin.html`, administradores enxergam a área **Usuários e administradores**. Um admin pode promover um usuário comum ou remover o papel de outro admin. A interface não permite alterar o próprio papel, evitando que o administrador se tranque para fora acidentalmente. O banco também valida a alteração por RLS + trigger; esconder o botão não é a proteção principal.

### Nomes de usuário duplicados
O banco agora possui uma restrição única case-insensitive. Portanto `Gabriel`, `gabriel` e ` GABRIEL ` são considerados o mesmo nome. O cadastro consulta a disponibilidade antes de criar a conta e a restrição UNIQUE protege também contra duas tentativas simultâneas.

> Se `MIGRATION-V3.4.sql` acusar erro ao criar o índice de username, provavelmente já existem nomes duplicados no banco. Corrija/renomeie um deles no Table Editor e rode a migração novamente.


## V3.4.1 — cadastro e gestão de acessos

- O painel **Administradores** lista somente contas com `role = admin`.
- Usuários comuns são localizados pelo campo **Pesquisar usuário**, evitando uma lista enorme no painel.
- O Supabase Auth continua garantindo que um mesmo e-mail não crie duas contas reais. Com confirmação de e-mail ativa, o Supabase pode devolver uma resposta ofuscada em tentativas de recadastro; a interface agora detecta esse caso conhecido e não exibe mais a mensagem enganosa de “conta criada”.
- Nomes de usuário continuam protegidos pelo índice único case-insensitive criado na V3.4.
- Esta versão não exige nova migração SQL se a `MIGRATION-V3.4.sql` já foi executada.


## V3.5 — imagens de capa

1. No Supabase, abra **SQL Editor** e execute `MIGRATION-V3.5.sql` uma única vez.
2. Essa migração adiciona `cover_image_url` em `posts` e cria o bucket público `post-images` no Supabase Storage.
3. Somente usuários com `role = admin` podem enviar, alterar ou excluir arquivos nesse bucket; a leitura das capas é pública.
4. No painel administrativo, o campo **Imagem de capa** aceita JPG, PNG, WEBP ou GIF com até 8 MB.
5. Sem imagem, o site continua usando a capa antiga com cor + emoji.
6. Com imagem, ela aparece responsivamente nos cards, no destaque e no topo da matéria usando recorte proporcional (`cover`).
7. Na matéria aberta, clique na capa para visualizar a imagem inteira (`contain`) em um lightbox.

### Importante
Não coloque a `secret key` ou `service_role` no JavaScript. O upload do painel usa a Publishable Key + sessão do administrador, e o Storage é protegido pelas policies da migração.
