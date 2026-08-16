(() => {
  const cfg = window.LOGICAS_PXG_CONFIG;
  const $ = id => document.getElementById(id);
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey || !window.supabase) {
    document.body.innerHTML = '<p style="color:white;padding:30px">Configuração do Supabase não encontrada.</p>';
    return;
  }

  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  let user = null;
  let profile = null;
  let avatarFile = null;
  let removeAvatar = false;

  function status(message, type='') {
    const el = $('profileStatus');
    el.textContent = message;
    el.className = `profile-status ${type}`.trim();
  }

  function safeExt(file) {
    const map = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
    return map[file.type] || 'jpg';
  }

  function renderAvatar(url, username) {
    const box = $('avatarPreview');
    box.innerHTML = '';
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `Avatar de ${username || 'usuário'}`;
      box.appendChild(img);
    } else {
      const span = document.createElement('span');
      span.id = 'avatarInitial';
      span.textContent = (username || '?').slice(0,1).toUpperCase();
      box.appendChild(span);
    }
  }

  function renderCooldown() {
    const el = $('usernameCooldown');
    if (!profile?.username_changed_at) {
      el.textContent = 'Você ainda não utilizou sua troca de nome. Depois de alterar, haverá uma espera de 7 dias para trocar novamente.';
      return;
    }

    const changed = new Date(profile.username_changed_at);
    const next = new Date(changed.getTime() + 7*24*60*60*1000);
    const now = new Date();

    if (next <= now) {
      el.textContent = 'Troca de nome disponível.';
      return;
    }

    const diff = next - now;
    const days = Math.floor(diff / 86400000);
    const hours = Math.ceil((diff % 86400000) / 3600000);
    el.textContent = `Próxima troca de nome disponível em aproximadamente ${days} dia(s) e ${hours} hora(s).`;
  }

  async function load() {
    const {data:{session}} = await db.auth.getSession();
    user = session?.user || null;
    if (!user) {
      location.replace('index.html');
      return;
    }

    const {data, error} = await db
      .from('profiles')
      .select('id,username,avatar_url,bio,role,created_at,username_changed_at')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      document.body.innerHTML = '<p style="color:white;padding:30px">Não foi possível carregar o perfil.</p>';
      return;
    }

    profile = data;
    $('profileUsername').value = profile.username || '';
    $('profileBio').value = profile.bio || '';
    $('bioCount').textContent = (profile.bio || '').length;
    $('profileEmail').value = user.email || '';
    $('profileDisplayName').textContent = profile.username || 'Meu perfil';
    $('profileRole').textContent = profile.role === 'admin' ? 'Administrador' : 'Usuário';
    $('profileCreated').textContent = `Membro desde ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(new Date(profile.created_at))}`;
    renderAvatar(profile.avatar_url, profile.username);
    renderCooldown();
    $('profileApp').hidden = false;
  }

  $('profileBio').addEventListener('input', () => {
    $('bioCount').textContent = $('profileBio').value.length;
  });

  $('avatarInput').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) {
      status('Formato de imagem não permitido.', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 3*1024*1024) {
      status('O avatar pode ter no máximo 3 MB.', 'error');
      e.target.value = '';
      return;
    }
    avatarFile = file;
    removeAvatar = false;
    renderAvatar(URL.createObjectURL(file), $('profileUsername').value);
    status('Novo avatar selecionado. Clique em Salvar alterações.', '');
  });

  $('removeAvatarBtn').addEventListener('click', () => {
    avatarFile = null;
    removeAvatar = true;
    $('avatarInput').value = '';
    renderAvatar(null, $('profileUsername').value);
    status('O avatar será removido ao salvar.', '');
  });

  $('profileUsername').addEventListener('input', () => {
    if (!avatarFile && (removeAvatar || !profile?.avatar_url)) {
      renderAvatar(null, $('profileUsername').value);
    }
  });

  $('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!user || !profile) return;

    const btn = $('saveProfileBtn');
    const username = $('profileUsername').value.trim();
    const bio = $('profileBio').value.trim();

    if (!/^[A-Za-zÀ-ÿ0-9_. \-]+$/.test(username)) {
      status('Use apenas letras, números, espaço, ponto, underline ou hífen no nome.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Salvando...';
    status('Validando alterações...');

    try {
      const usernameChanged = username.toLowerCase() !== (profile.username || '').trim().toLowerCase();

      if (usernameChanged) {
        const {data:available, error:availabilityError} = await db.rpc('username_available', {candidate: username});
        if (availabilityError) throw availabilityError;
        if (!available) {
          status('Esse nome de usuário já está em uso.', 'error');
          return;
        }
      }

      let avatarUrl = profile.avatar_url || null;

      if (removeAvatar || avatarFile) {
        const {data:existing} = await db.storage.from('avatars').list(user.id, {limit:100});
        const paths = (existing || []).map(f => `${user.id}/${f.name}`);
        if (paths.length) {
          const {error:removeError} = await db.storage.from('avatars').remove(paths);
          if (removeError) throw removeError;
        }
        avatarUrl = null;
      }

      if (avatarFile) {
        const path = `${user.id}/avatar-${Date.now()}.${safeExt(avatarFile)}`;
        const {error:uploadError} = await db.storage.from('avatars').upload(path, avatarFile, {
          cacheControl:'3600',
          upsert:false,
          contentType:avatarFile.type
        });
        if (uploadError) throw uploadError;

        const {data:publicData} = db.storage.from('avatars').getPublicUrl(path);
        avatarUrl = publicData.publicUrl;
      }

      const update = {username, bio: bio || null, avatar_url: avatarUrl};
      const {data:updated, error:updateError} = await db
        .from('profiles')
        .update(update)
        .eq('id', user.id)
        .select('id,username,avatar_url,bio,role,created_at,username_changed_at')
        .single();

      if (updateError) throw updateError;

      profile = updated;
      avatarFile = null;
      removeAvatar = false;
      $('profileDisplayName').textContent = profile.username;
      renderAvatar(profile.avatar_url, profile.username);
      renderCooldown();
      status('Perfil atualizado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      const msg = err?.message || '';
      if (/7 dias|7 days|novamente após/i.test(msg)) {
        status('Você ainda está no período de espera de 7 dias para trocar o nome.', 'error');
      } else if (/duplicate|unique/i.test(msg)) {
        status('Esse nome de usuário já está em uso.', 'error');
      } else if (/row-level security|policy/i.test(msg)) {
        status('O Supabase bloqueou esta alteração por política de segurança. Confira a MIGRATION-V3.6.sql.', 'error');
      } else {
        status(`Não foi possível salvar: ${msg || 'erro desconhecido'}`, 'error');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar alterações';
    }
  });

  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) location.replace('index.html');
  });

  load();
})();
