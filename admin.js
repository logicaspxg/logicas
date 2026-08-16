(() => {
  const cfg=window.LOGICAS_PXG_CONFIG||{};
  const REPORTS_ENABLED=false; // Reative junto com o GRANT INSERT documentado na migração V3.6.1.
  const configured=cfg.supabaseUrl&&cfg.supabaseAnonKey&&!cfg.supabaseUrl.includes('COLE_AQUI')&&!cfg.supabaseAnonKey.includes('COLE_AQUI');
  const db=configured&&window.supabase?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
  const $=id=>document.getElementById(id); const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); const coverMap={red:'cover-red',yellow:'cover-yellow',blue:'cover-blue',purple:'cover-purple',green:'cover-green',dark:'cover-dark'};
  const toast=$('toast'); const showToast=m=>{toast.textContent=m;toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove('show'),2600)};
  let posts=[];
  let users=[];
  let userSearchResults=[];
  let currentAdminId=null;
  const MAX_COVER_BYTES=8*1024*1024;
  const ALLOWED_COVER_TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif']);

  async function boot(){
    // Fail closed: a página inteira permanece invisível até o Supabase confirmar role = admin.
    $('adminShell').hidden=true;
    $('logoutBtn').hidden=true;

    const deny=()=>location.replace('index.html');
    if(!db) return deny();

    try {
      const {data:{session},error:sessionError}=await db.auth.getSession();
      if(sessionError||!session) return deny();

      currentAdminId=session.user.id;
      const {data:profile,error}=await db.from('profiles').select('role').eq('id',session.user.id).single();
      if(error||profile?.role!=='admin') return deny();

      // Só a partir daqui o HTML administrativo se torna visível.
      document.body.classList.add('admin-authorized');
      $('adminShell').hidden=false;
      $('logoutBtn').hidden=false;
      setDefaultDate();
      if(REPORTS_ENABLED)$('reportsCard').hidden=false;
      await Promise.all([loadPosts(),loadComments(),loadStories(),REPORTS_ENABLED?loadReports():Promise.resolve(),loadUsers()]);
    } catch (err) {
      console.error('Falha ao validar acesso administrativo:', err);
      deny();
    }
  }

  function setDefaultDate(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());$('publishedAt').value=d.toISOString().slice(0,16)}
  function draft(){return {title:$('title').value.trim(),category:$('category').value.trim(),author:$('author').value.trim()||'Redação Lógicas PXG',score:Number($('score').value)||0,icon:$('icon').value.trim()||'📰',cover:$('cover').value,summary:$('summary').value.trim(),content:$('content').value.trim(),featured:$('featured').checked,published:$('published').checked,cover_image_url:$('coverImageUrl').value.trim()||null,published_at:new Date($('publishedAt').value).toISOString()};}
  function slugify(t){return t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||`materia-${Date.now()}`}

  function renderCurrentCover(url){
    const box=$('coverImageCurrent');
    if(!url){box.hidden=true;box.innerHTML='';return;}
    box.hidden=false;box.innerHTML=`<img src="${esc(url)}" alt="Capa atual"><div><span>${esc(url)}</span><button type="button" class="mini-btn danger cover-image-remove" id="removeCoverImage">Remover imagem</button></div>`;
    $('removeCoverImage').addEventListener('click',()=>{$('coverImageUrl').value='';$('coverImage').value='';renderCurrentCover('');showToast('A imagem será removida ao salvar.');});
  }
  async function uploadCoverIfNeeded(slug){
    const file=$('coverImage').files?.[0];
    if(!file)return $('coverImageUrl').value.trim()||null;
    if(!ALLOWED_COVER_TYPES.has(file.type))throw new Error('Use JPG, PNG, WEBP ou GIF.');
    if(file.size>MAX_COVER_BYTES)throw new Error('A imagem deve ter no máximo 8 MB.');
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
    const path=`${slug}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const {error}=await db.storage.from('post-images').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(error)throw error;
    const {data}=db.storage.from('post-images').getPublicUrl(path);
    return data.publicUrl;
  }
  function imagePreviewMarkup(p){
    if(p.cover_image_url)return `<img class="cover-image" src="${esc(p.cover_image_url)}" alt="Capa: ${esc(p.title)}"><em>${esc(p.category).toUpperCase()}</em><i class="article-image-hint">Imagem de capa</i>`;
    return `<span>${esc(p.icon)}</span><em>${esc(p.category).toUpperCase()}</em>`;
  }

  async function loadPosts(){const {data,error}=await db.from('posts').select('*').order('published_at',{ascending:false});if(error)return showToast('Erro ao carregar matérias.');posts=data||[];renderPosts();}
  function renderPosts(){$('postCount').textContent=`${posts.length} matéria${posts.length===1?'':'s'}`;$('adminPostList').innerHTML=posts.length?posts.map(p=>`<article class="admin-post-item"><div class="admin-post-icon ${coverMap[p.cover]||'cover-dark'}">${esc(p.icon||'📰')}</div><div class="admin-post-copy"><div class="post-meta"><span>${esc(p.category)}</span><time>${new Date(p.published_at).toLocaleDateString('pt-BR')}</time>${p.featured?'<b>DESTAQUE</b>':''}${!p.published?'<b>RASCUNHO</b>':''}</div><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p></div><div class="admin-item-actions"><button class="mini-btn" data-edit="${p.id}">Editar</button><button class="mini-btn danger" data-delete="${p.id}">Excluir</button></div></article>`).join(''):'<div class="empty-state" style="display:block">Nenhuma matéria.</div>'}

  async function save(e){
    e.preventDefault(); const p=draft(); if(!p.title||!p.summary||!p.content)return showToast('Preencha os campos obrigatórios.');
    const id=$('editingId').value; const existing=id?posts.find(x=>String(x.id)===String(id)):null; const slug=existing?.slug||slugify(p.title);
    const saveBtn=$('saveBtn'); const oldText=saveBtn.textContent; saveBtn.disabled=true; saveBtn.textContent='Salvando...';
    try{
      p.cover_image_url=await uploadCoverIfNeeded(slug);
      if(p.featured)await db.from('posts').update({featured:false}).neq('featured',false);
      let error;
      if(id)({error}=await db.from('posts').update(p).eq('id',id));
      else{p.slug=slug;({error}=await db.from('posts').insert(p));}
      if(error)throw error;
      showToast(id?'Matéria atualizada!':'Matéria publicada!'); clearForm(); await loadPosts();
    }catch(err){console.error(err);showToast(`Erro ao salvar: ${err.message||err}`)}
    finally{saveBtn.disabled=false;saveBtn.textContent=$('editingId').value?'Salvar alterações':'Publicar matéria';if(saveBtn.textContent==='')saveBtn.textContent=oldText;}
  }
  function fill(p){$('editingId').value=p.id;$('title').value=p.title;$('category').value=p.category;$('author').value=p.author;$('score').value=p.score;$('icon').value=p.icon;$('cover').value=p.cover;$('summary').value=p.summary;$('content').value=p.content;$('coverImage').value='';$('coverImageUrl').value=p.cover_image_url||'';renderCurrentCover(p.cover_image_url||'');$('featured').checked=!!p.featured;$('published').checked=!!p.published;const d=new Date(p.published_at);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());$('publishedAt').value=d.toISOString().slice(0,16);$('formTitle').textContent='Editar matéria';$('saveBtn').textContent='Salvar alterações';scrollTo({top:0,behavior:'smooth'})}
  function clearForm(){$('postForm').reset();$('editingId').value='';$('author').value='Redação Lógicas PXG';$('score').value='85';$('icon').value='🧠';$('coverImage').value='';$('coverImageUrl').value='';renderCurrentCover('');$('published').checked=true;$('formTitle').textContent='Criar matéria';$('saveBtn').textContent='Publicar matéria';setDefaultDate()}

  async function loadComments(){const {data,error}=await db.from('comments').select('id,user_id,post_id,content,created_at,profiles(username),posts(title)').order('created_at',{ascending:false}).limit(40);if(error){console.error(error);return}$('moderationList').innerHTML=(data||[]).length?data.map(c=>`<article class="admin-post-item"><div class="admin-post-icon cover-dark">💬</div><div class="admin-post-copy"><div class="post-meta"><span>${esc(c.profiles?.username||'Usuário')}</span><time>${new Date(c.created_at).toLocaleString('pt-BR')}</time></div><h3>${esc(c.posts?.title||'Matéria')}</h3><p>${esc(c.content)}</p></div><div class="admin-item-actions"><button class="mini-btn danger" data-mod-delete="${c.id}">Excluir</button></div></article>`).join(''):'<div class="empty-state" style="display:block">Nenhum comentário.</div>'}

  const storyStatusLabel={new:'Nova',read:'Lida',used:'Aproveitada',archived:'Arquivada'};
  async function loadStories(){
    const {data,error}=await db.from('story_submissions').select('id,user_id,subject,story,status,created_at,profiles!story_submissions_user_id_fkey(username)').order('created_at',{ascending:false}).limit(100);
    if(error){console.error(error);$('storyList').innerHTML='<div class="empty-state" style="display:block">A fila ficará disponível após aplicar a migração V3.7.</div>';return;}
    const stories=data||[], fresh=stories.filter(s=>s.status==='new').length;
    $('storyCount').textContent=`${stories.length} história${stories.length===1?'':'s'}`;$('storyTabCount').textContent=fresh?`(${fresh})`:'';
    $('storyList').innerHTML=stories.length?stories.map(s=>`<article class="admin-post-item story-item"><div class="admin-post-icon ${s.status==='new'?'cover-yellow':'cover-dark'}">💡</div><div class="admin-post-copy"><div class="post-meta"><span>${esc(storyStatusLabel[s.status]||s.status)}</span><time>${new Date(s.created_at).toLocaleString('pt-BR')}</time></div><h3>${esc(s.subject)}</h3><p><strong>${esc(s.profiles?.username||'Usuário removido')}:</strong> ${esc(s.story)}</p></div><div class="admin-item-actions">${s.status==='new'?`<button class="mini-btn" data-story-status="read" data-story-id="${s.id}">Marcar lida</button>`:''}${s.status!=='used'?`<button class="mini-btn" data-story-status="used" data-story-id="${s.id}">Aproveitar</button>`:''}${s.status!=='archived'?`<button class="mini-btn danger" data-story-status="archived" data-story-id="${s.id}">Arquivar</button>`:''}</div></article>`).join(''):'<div class="empty-state" style="display:block">Nenhuma história recebida.</div>';
  }

  function setAdminTab(tab){document.querySelectorAll('[data-admin-tab]').forEach(b=>{const active=b.dataset.adminTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});document.querySelectorAll('[data-admin-panel]').forEach(p=>p.hidden=p.dataset.adminPanel!==tab);}

  const reportReasonLabel={inappropriate_content:'Conteúdo impróprio',harassment:'Assédio ou ameaça',spam:'Spam',impersonation:'Falsidade ideológica',other:'Outro motivo'};
  async function loadReports(){
    const {data,error}=await db.from('profile_reports').select('id,reported_profile_id,source_comment_id,reason,details,status,created_at,reported:profiles!profile_reports_reported_profile_id_fkey(username),reporter:profiles!profile_reports_reporter_id_fkey(username),comments(content)').eq('status','pending').order('created_at',{ascending:false}).limit(100);
    if(error){console.error(error);$('reportList').innerHTML='<div class="empty-state" style="display:block">Execute a MIGRATION-V3.6.sql para ativar as denúncias.</div>';return;}
    const reports=data||[]; $('reportCount').textContent=`${reports.length} pendente${reports.length===1?'':'s'}`;
    $('reportList').innerHTML=reports.length?reports.map(r=>`<article class="admin-post-item report-item"><div class="admin-post-icon cover-red">⚠️</div><div class="admin-post-copy"><div class="post-meta"><span>${esc(reportReasonLabel[r.reason]||r.reason)}</span><time>${new Date(r.created_at).toLocaleString('pt-BR')}</time></div><h3>${esc(r.reported?.username||'Perfil removido')}</h3><p><strong>Denunciado por:</strong> ${esc(r.reporter?.username||'Usuário')}<br>${r.details?`<strong>Detalhes:</strong> ${esc(r.details)}<br>`:''}${r.comments?.content?`<strong>Comentário relacionado:</strong> “${esc(r.comments.content)}”`:''}</p></div><div class="admin-item-actions"><button class="mini-btn" data-report-status="dismissed" data-report-id="${r.id}">Descartar</button><button class="mini-btn danger" data-report-status="actioned" data-report-id="${r.id}">Resolver</button></div></article>`).join(''):'<div class="empty-state" style="display:block">Nenhuma denúncia pendente.</div>';
  }

  function userCard(u,{searchResult=false}={}){
    const self=u.id===currentAdminId; const isAdmin=u.role==='admin';
    const action=self?'<span class="self-role">Seu acesso</span>':`<button class="mini-btn ${isAdmin?'danger':''}" data-role-user="${u.id}" data-role-target="${isAdmin?'user':'admin'}">${isAdmin?'Remover admin':'Tornar admin'}</button>`;
    const avatar=u.avatar_url?`<img src="${esc(u.avatar_url)}" alt="Foto de perfil de ${esc(u.username)}" loading="lazy">`:(isAdmin?'🛡️':'👤');
    return `<article class="admin-post-item user-item"><div class="admin-post-icon user-avatar ${isAdmin?'cover-yellow':'cover-dark'}">${avatar}</div><div class="admin-post-copy"><div class="post-meta"><span>${isAdmin?'ADMINISTRADOR':'USUÁRIO'}</span><time>${new Date(u.created_at).toLocaleDateString('pt-BR')}</time>${self?'<b>VOCÊ</b>':''}${searchResult&&isAdmin?'<b>JÁ É ADMIN</b>':''}</div><h3>${esc(u.username)}</h3><p>${isAdmin?'Pode publicar, moderar e gerenciar acessos.':'Pode reagir e comentar nas matérias.'}</p></div><div class="admin-item-actions">${action}</div></article>`;
  }

  async function loadUsers(){
    // A tela principal de acessos mostra somente administradores. Usuários comuns são buscados sob demanda.
    const {data,error}=await db.from('profiles').select('id,username,avatar_url,role,created_at').eq('role','admin').order('created_at',{ascending:true});
    if(error){console.error(error);return showToast('Erro ao carregar administradores.')}
    users=data||[];
    $('userCount').textContent=`${users.length} administrador${users.length===1?'':'es'}`;
    $('userList').innerHTML=users.length?users.map(u=>userCard(u)).join(''):'<div class="empty-state" style="display:block">Nenhum administrador.</div>';
  }

  async function searchUsers(){
    const q=$('userSearch').value.trim();
    const status=$('userSearchStatus'), results=$('userSearchResults');
    results.innerHTML='';
    if(q.length<2){status.textContent='Digite pelo menos 2 caracteres para pesquisar.';return;}
    status.textContent='Pesquisando...';
    const safe=q.replace(/[%,]/g,'');
    const {data,error}=await db.from('profiles').select('id,username,avatar_url,role,created_at').ilike('username',`%${safe}%`).order('username',{ascending:true}).limit(20);
    if(error){console.error(error);status.textContent='Não foi possível pesquisar usuários agora.';return;}
    const found=data||[];
    userSearchResults=found;
    status.textContent=found.length?`${found.length} resultado${found.length===1?'':'s'}.`:'Nenhum usuário encontrado.';
    results.innerHTML=found.map(u=>userCard(u,{searchResult:true})).join('');
  }

  function preview(){const p=draft();$('previewHero').className=`article-hero ${coverMap[p.cover]||'cover-dark'} ${p.cover_image_url?'has-image':''}`;$('previewHero').innerHTML=imagePreviewMarkup(p);$('previewMeta').innerHTML=`<span>${esc(p.category)}</span><span>${new Date(p.published_at).toLocaleDateString('pt-BR')}</span><span>${esc(p.author)}</span>`;$('previewTitle').textContent=p.title||'Título da matéria';$('previewSummary').textContent=p.summary||'Resumo';$('previewScore').innerHTML=`<div><span>Índice de Lógica PXG™</span><strong>${p.score}%</strong></div><div class="meter"><span style="width:${p.score}%"></span></div>`;$('previewText').innerHTML=(p.content||'Texto da matéria.').split(/\n\s*\n/).map(x=>`<p>${esc(x)}</p>`).join('');$('previewModal').classList.add('open');document.body.classList.add('modal-open')}
  function closePreview(){$('previewModal').classList.remove('open');document.body.classList.remove('modal-open')}


  $('coverImage').addEventListener('change',()=>{const file=$('coverImage').files?.[0];if(!file)return;if(!ALLOWED_COVER_TYPES.has(file.type)){showToast('Use JPG, PNG, WEBP ou GIF.');$('coverImage').value='';return;}if(file.size>MAX_COVER_BYTES){showToast('A imagem deve ter no máximo 8 MB.');$('coverImage').value='';return;}const url=URL.createObjectURL(file);renderCurrentCover(url);});
  $('postForm').addEventListener('submit',save);$('clearBtn').addEventListener('click',clearForm);$('previewBtn').addEventListener('click',preview);$('previewClose').addEventListener('click',closePreview);$('previewModal').addEventListener('click',e=>{if(e.target.matches('[data-close-preview]'))closePreview()});
  $('adminPostList').addEventListener('click',async e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit){const p=posts.find(x=>x.id===edit.dataset.edit);if(p)fill(p)}if(del&&confirm('Excluir esta matéria e seus comentários/reações?')){const {error}=await db.from('posts').delete().eq('id',del.dataset.delete);if(error)return showToast(error.message);showToast('Matéria excluída.');await Promise.all([loadPosts(),loadComments()])}});
  $('moderationList').addEventListener('click',async e=>{const b=e.target.closest('[data-mod-delete]');if(!b||!confirm('Excluir este comentário?'))return;const {error}=await db.from('comments').delete().eq('id',b.dataset.modDelete);if(error)return showToast(error.message);showToast('Comentário removido.');await loadComments()});
  document.querySelectorAll('[data-admin-tab]').forEach(b=>b.addEventListener('click',()=>setAdminTab(b.dataset.adminTab)));
  $('storyList').addEventListener('click',async e=>{const b=e.target.closest('[data-story-status]');if(!b)return;b.disabled=true;const {error}=await db.from('story_submissions').update({status:b.dataset.storyStatus,reviewed_at:new Date().toISOString(),reviewed_by:currentAdminId}).eq('id',b.dataset.storyId);if(error){b.disabled=false;return showToast(error.message||'Não foi possível atualizar a história.');}showToast('História atualizada.');await loadStories();});
  $('reportList').addEventListener('click',async e=>{const b=e.target.closest('[data-report-status]');if(!b)return;const verb=b.dataset.reportStatus==='actioned'?'marcar como resolvida':'descartar';if(!confirm(`Deseja ${verb} esta denúncia?`))return;b.disabled=true;const {error}=await db.from('profile_reports').update({status:b.dataset.reportStatus,reviewed_at:new Date().toISOString(),reviewed_by:currentAdminId}).eq('id',b.dataset.reportId);if(error){b.disabled=false;return showToast(error.message||'Não foi possível atualizar a denúncia.');}showToast('Denúncia atualizada.');await loadReports();});
  async function handleRoleChange(e){
    const b=e.target.closest('[data-role-user]'); if(!b)return;
    const user=[...users,...userSearchResults].find(u=>u.id===b.dataset.roleUser); if(!user)return;
    const target=b.dataset.roleTarget;
    const action=target==='admin'?'promover a administrador':'remover o acesso administrativo de';
    if(!confirm(`Deseja ${action} ${user.username}?`))return;
    b.disabled=true;
    const {error}=await db.from('profiles').update({role:target}).eq('id',user.id);
    if(error){console.error(error);showToast(error.message||'Não foi possível alterar o acesso.');b.disabled=false;return;}
    showToast(target==='admin'?`${user.username} agora é administrador.`:`Acesso administrativo de ${user.username} removido.`);
    await loadUsers();
    if($('userSearch').value.trim().length>=2) await searchUsers();
  }
  $('userList').addEventListener('click',handleRoleChange);
  $('userSearchResults').addEventListener('click',handleRoleChange);
  $('userSearchBtn').addEventListener('click',searchUsers);
  $('userSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchUsers();}});
  let userSearchTimer=null;
  $('userSearch').addEventListener('input',()=>{
    clearTimeout(userSearchTimer);
    userSearchTimer=setTimeout(()=>{
      if($('userSearch').value.trim().length>=2) searchUsers();
      else { userSearchResults=[]; $('userSearchStatus').textContent=''; $('userSearchResults').innerHTML=''; }
    },350);
  });
  $('logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();location.href='index.html'});
  boot();
})();

