(() => {
  const cfg = window.LOGICAS_PXG_CONFIG || {};
  const configured = cfg.supabaseUrl && cfg.supabaseAnonKey && !cfg.supabaseUrl.includes('COLE_AQUI') && !cfg.supabaseAnonKey.includes('COLE_AQUI');
  const db = configured && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const demoPosts = Array.isArray(window.LOGICAS_PXG_POSTS) ? [...window.LOGICAS_PXG_POSTS] : [];
  let posts = [];
  let currentUser = null;
  let currentProfile = null;
  let activeFilter = 'Todos';
  let activePost = null;
  let lastFocused = null;
  let reactionStats = {};

  const $ = id => document.getElementById(id);
  const postsGrid = $('postsGrid'), filtersEl = $('categorias'), searchInput = $('searchInput'), emptyState = $('emptyState'), featuredEl = $('featuredPost'), articleModal = $('articleModal'), authModal = $('authModal'), toast = $('toast');
  const coverMap = {red:'cover-red',yellow:'cover-yellow',blue:'cover-blue',purple:'cover-purple',green:'cover-green',dark:'cover-dark'};
  const esc = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const showToast = m => { toast.textContent=m; toast.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>toast.classList.remove('show'),2800); };
  const formatDate = iso => new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${iso}T12:00:00`)).replace('.','').toUpperCase();
  const normalizePost = p => ({...p, content:Array.isArray(p.content)?p.content:String(p.content||'').split(/\n\s*\n/).filter(Boolean)});
  const coverImage = (p, cls='cover-image') => p.cover_image_url ? `<img class="${cls}" src="${esc(p.cover_image_url)}" alt="Capa da matéria: ${esc(p.title)}" loading="lazy">` : '';
  const renderCover = (p, type='card') => {
    const base=coverMap[p.cover]||'cover-dark';
    if(p.cover_image_url){
      const cls=type==='featured'?'featured-visual':type==='article'?'article-hero':'post-cover';
      const hint=type==='article'?'<i class="article-image-hint">🔍 Clique para ampliar</i>':'';
      return `<div class="${cls} ${base} has-image" data-cover-lightbox="${type==='article'?'1':'0'}">${coverImage(p)}<em>${esc(p.category).toUpperCase()}</em>${hint}</div>`;
    }
    if(type==='featured') return `<div class="featured-visual ${base}"><div class="orb orb-one"></div><div class="orb orb-two"></div><span class="visual-icon">${esc(p.icon||'📰')}</span></div>`;
    if(type==='article') return `<div class="article-hero ${base}"><span>${esc(p.icon||'📰')}</span><em>${esc(p.category).toUpperCase()}</em></div>`;
    return `<div class="post-cover ${base}"><span>${esc(p.icon||'📰')}</span><em>${esc(p.category).toUpperCase()}</em></div>`;
  };

  async function loadPosts(){
    if(!db){ posts=demoPosts.map(normalizePost); reactionStats={}; renderAll(); return; }
    const {data,error}=await db.from('posts').select('*').eq('published',true).order('published_at',{ascending:false});
    if(error){ console.error(error); posts=demoPosts.map(normalizePost); reactionStats={}; showToast('Banco indisponível. Exibindo conteúdo de demonstração.'); }
    else posts=(data||[]).map(normalizePost);
    await loadReactionStats();
    renderAll();
  }

  async function loadReactionStats(){
    reactionStats={};
    if(!db||!posts.length) return;
    const ids=posts.map(p=>p.id).filter(Boolean);
    if(!ids.length) return;
    const {data,error}=await db.from('reactions').select('post_id,reaction').in('post_id',ids);
    if(error){ console.error('Erro ao carregar contadores de reações:',error); return; }
    (data||[]).forEach(r=>{
      const stat=reactionStats[r.post_id]||(reactionStats[r.post_id]={like:0,love:0,funny:0});
      if(Object.prototype.hasOwnProperty.call(stat,r.reaction)) stat[r.reaction]++;
    });
  }
  const reactionStat = id => reactionStats[id] || {like:0,love:0,funny:0};

  function renderAll(){ renderFeatured(); renderFilters(); renderPosts(); }
  function renderFeatured(){
    if(!featuredEl) return;
    if(!posts.length){ featuredEl.innerHTML='<div class="featured-content"><span class="tag">AGUARDANDO CONTEÚDO</span><h2>Nenhuma matéria publicada ainda.</h2><p>O silêncio da lógica é ensurdecedor.</p></div>'; return; }
    const p=posts.find(x=>x.featured)||posts[0]; featuredEl.dataset.postId=p.id;
    featuredEl.innerHTML=`<div class="featured-badge">EM DESTAQUE</div>${renderCover(p,'featured')}<div class="featured-content"><span class="tag">${esc(p.category).toUpperCase()}</span><h2>${esc(p.title)}</h2><p>${esc(p.summary)}</p><div class="read-hint">Ler matéria completa <span>→</span></div><div class="logic-row"><span>Índice de Lógica PXG™</span><strong>${Number(p.score)||0}%</strong></div><div class="meter"><span style="width:${Math.min(100,Math.max(0,Number(p.score)||0))}%"></span></div></div>`;
  }
  function renderFilters(){
    const cats=['Todos',...new Set(posts.map(p=>p.category).filter(Boolean))];
    filtersEl.innerHTML=cats.map(c=>`<button class="filter ${c===activeFilter?'active':''}" data-filter="${esc(c)}">${esc(c)}</button>`).join('');
  }
  function renderPosts(){
    const q=(searchInput?.value||'').trim().toLowerCase();
    const visible=posts.filter(p=>activeFilter==='Todos'||p.category===activeFilter).filter(p=>[p.title,p.summary,p.category,p.author,...(p.content||[])].join(' ').toLowerCase().includes(q));
    postsGrid.innerHTML=visible.map(p=>{const r=reactionStat(p.id);return `<article class="post-card" tabindex="0" data-post-id="${esc(p.id)}">${renderCover(p,'card')}<div class="post-body"><div class="post-meta"><span>${esc(p.category)}</span><time>${formatDate((p.published_at||p.date||'').slice(0,10))}</time></div><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p><div class="post-footer-row"><div class="logic-score"><span>🧠 Lógica PXG</span><b>${Number(p.score)||0}%</b></div><div class="card-reactions" aria-label="Reações da matéria"><span title="Curtidas">👍 <b>${r.like}</b></span><span title="Amei">❤️ <b>${r.love}</b></span><span title="Engraçado">😂 <b>${r.funny}</b></span></div><span class="read-more">LER →</span></div></div></article>`}).join('');
    emptyState.style.display=visible.length?'none':'block';
  }

  async function openPost(id){
    const p=posts.find(x=>String(x.id)===String(id)); if(!p)return; activePost=p; lastFocused=document.activeElement;
    $('modalHero').outerHTML=renderCover(p,'article').replace('<div class="article-hero','<div id="modalHero" class="article-hero');
    const date=(p.published_at||p.date||'').slice(0,10); $('modalMeta').innerHTML=`<span>${esc(p.category)}</span><span>${date?formatDate(date):''}</span><span>${esc(p.author||'Redação Lógicas PXG')}</span>`;
    $('modalTitle').textContent=p.title; $('modalSummary').textContent=p.summary; $('modalScore').innerHTML=`<div><span>Índice de Lógica PXG™</span><strong>${Number(p.score)||0}%</strong></div><div class="meter"><span style="width:${Math.min(100,Math.max(0,Number(p.score)||0))}%"></span></div>`;
    $('modalText').innerHTML=(p.content||[]).map(x=>`<p>${esc(x)}</p>`).join('');
    articleModal.classList.add('open'); document.body.classList.add('modal-open'); articleModal.setAttribute('aria-hidden','false');
    await loadCommunity();
  }
  function openImageLightbox(url,alt='Imagem da matéria'){
    if(!url)return;
    const lb=$('imageLightbox'), img=$('imageLightboxImg'); img.src=url; img.alt=alt; lb.classList.add('open'); lb.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
  }
  function closeImageLightbox(){const lb=$('imageLightbox');lb.classList.remove('open');lb.setAttribute('aria-hidden','true');$('imageLightboxImg').removeAttribute('src');if(!articleModal.classList.contains('open')&&!authModal.classList.contains('open'))document.body.classList.remove('modal-open');}
  function closePost(){ articleModal.classList.remove('open'); document.body.classList.remove('modal-open'); articleModal.setAttribute('aria-hidden','true'); activePost=null; lastFocused?.focus?.(); }

  async function loadCommunity(){
    const hint=$('interactionHint'), form=$('commentForm');
    if(!db){ $('likeCount').textContent='0'; $('loveCount').textContent='0'; $('funnyCount').textContent='0'; $('reactionTotal').textContent='Modo demonstração'; $('commentsList').innerHTML='<div class="comment-empty">Conecte o Supabase para ativar contas, reações e comentários.</div>'; $('commentCount').textContent='0 comentários'; form.hidden=true; hint.textContent='Recursos da comunidade serão ativados após configurar o banco.'; return; }
    form.hidden=!currentUser; hint.innerHTML=currentUser?'':`<button class="text-link" id="inlineLogin">Entre ou crie uma conta</button> para reagir e comentar.`;
    $('inlineLogin')?.addEventListener('click',openAuth);
    document.querySelectorAll('.reaction-btn').forEach(b=>b.classList.remove('selected'));
    const [{data:reactions,error:rErr},{data:comments,error:cErr}]=await Promise.all([
      db.from('reactions').select('user_id,reaction').eq('post_id',activePost.id),
      db.from('comments').select('id,user_id,content,created_at,profiles(username)').eq('post_id',activePost.id).order('created_at',{ascending:false})
    ]);
    if(rErr) console.error(rErr); if(cErr) console.error(cErr);
    const rs=reactions||[], cs=comments||[]; const likes=rs.filter(r=>r.reaction==='like').length, loves=rs.filter(r=>r.reaction==='love').length, funnies=rs.filter(r=>r.reaction==='funny').length;
    $('likeCount').textContent=likes; $('loveCount').textContent=loves; $('funnyCount').textContent=funnies; const total=likes+loves+funnies; $('reactionTotal').textContent=`${total} reaç${total===1?'ão':'ões'}`;
    const mine=currentUser&&rs.find(r=>r.user_id===currentUser.id); if(mine) document.querySelector(`[data-reaction="${mine.reaction}"]`)?.classList.add('selected');
    $('commentCount').textContent=`${cs.length} comentário${cs.length===1?'':'s'}`;
    $('commentsList').innerHTML=cs.length?cs.map(c=>`<article class="comment"><div class="comment-avatar">${esc((c.profiles?.username||'?').slice(0,1).toUpperCase())}</div><div class="comment-body"><div><strong>${esc(c.profiles?.username||'Usuário')}</strong><time>${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(c.created_at))}</time></div><p>${esc(c.content)}</p>${currentUser&&(c.user_id===currentUser.id||currentProfile?.role==='admin')?`<button class="delete-comment" data-comment-id="${c.id}">Excluir</button>`:''}</div></article>`).join(''):'<div class="comment-empty">Ainda não há comentários. Um acontecimento raro na internet.</div>';
  }

  async function react(type){
    if(!db)return showToast('Configure o Supabase primeiro.'); if(!currentUser)return openAuth(); if(!activePost)return;
    const {data:existing}=await db.from('reactions').select('reaction').eq('post_id',activePost.id).eq('user_id',currentUser.id).maybeSingle();
    let error;
    if(existing?.reaction===type) ({error}=await db.from('reactions').delete().eq('post_id',activePost.id).eq('user_id',currentUser.id));
    else ({error}=await db.from('reactions').upsert({post_id:activePost.id,user_id:currentUser.id,reaction:type},{onConflict:'post_id,user_id'}));
    if(error)return showToast('Não foi possível registrar a reação.'); await loadCommunity(); await loadReactionStats(); renderPosts();
  }

  async function submitComment(e){
    e.preventDefault(); if(!currentUser)return openAuth(); const input=$('commentInput'), content=input.value.trim(); if(!content||!activePost)return;
    const {error}=await db.from('comments').insert({post_id:activePost.id,user_id:currentUser.id,content});
    if(error)return showToast('Não foi possível publicar o comentário.'); input.value=''; showToast('Comentário publicado.'); await loadCommunity();
  }

  function openAuth(){ if(!db)return showToast('Configure o Supabase para ativar contas.'); authModal.classList.add('open'); authModal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); }
  function closeAuth(){ authModal.classList.remove('open'); authModal.setAttribute('aria-hidden','true'); if(!articleModal.classList.contains('open'))document.body.classList.remove('modal-open'); $('authMessage').textContent=''; }
  function setAuthTab(tab){ document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===tab)); $('loginForm').hidden=tab!=='login'; $('signupForm').hidden=tab!=='signup'; $('authMessage').textContent=''; if(tab==='login') refreshLoginLock(); }

  // Proteção progressiva local contra repetição de tentativas de login.
  // É uma camada de UX/abuso no navegador; a proteção de servidor continua sendo o rate limit do Supabase Auth.
  const LOGIN_GUARD_KEY='logicasPXG.loginGuard.v1';
  const LOGIN_RESET_AFTER=30*60*1000;
  const LOGIN_DELAYS=[0,0,0,10,30,60,300,900]; // 1-3 livres; depois 10s, 30s, 1m, 5m, 15m.
  let loginTimer=null;

  function readLoginGuard(){
    try{
      const raw=JSON.parse(localStorage.getItem(LOGIN_GUARD_KEY)||'{}');
      const state={fails:Number(raw.fails)||0,unlockAt:Number(raw.unlockAt)||0,lastFailure:Number(raw.lastFailure)||0};
      if(state.lastFailure && Date.now()-state.lastFailure>LOGIN_RESET_AFTER){ resetLoginGuard(); return {fails:0,unlockAt:0,lastFailure:0}; }
      return state;
    }catch(_){ return {fails:0,unlockAt:0,lastFailure:0}; }
  }
  function writeLoginGuard(state){ try{ localStorage.setItem(LOGIN_GUARD_KEY,JSON.stringify(state)); }catch(_){} }
  function resetLoginGuard(){ try{ localStorage.removeItem(LOGIN_GUARD_KEY); }catch(_){} clearInterval(loginTimer); loginTimer=null; refreshLoginLock(); }
  function formatWait(seconds){
    if(seconds<60)return `${seconds} segundo${seconds===1?'':'s'}`;
    const m=Math.ceil(seconds/60); return `${m} minuto${m===1?'':'s'}`;
  }
  function refreshLoginLock(){
    const btn=$('loginSubmitBtn'), hint=$('loginSecurityHint'); if(!btn||!hint)return false;
    clearInterval(loginTimer); loginTimer=null;
    const state=readLoginGuard(), remaining=Math.max(0,Math.ceil((state.unlockAt-Date.now())/1000));
    if(remaining>0){
      btn.disabled=true; btn.textContent=`Aguarde ${remaining}s`;
      hint.textContent=`Muitas tentativas consecutivas. Nova tentativa em ${formatWait(remaining)}.`;
      loginTimer=setInterval(()=>{
        const st=readLoginGuard(), left=Math.max(0,Math.ceil((st.unlockAt-Date.now())/1000));
        if(left<=0){ clearInterval(loginTimer); loginTimer=null; btn.disabled=false; btn.textContent='Entrar'; hint.textContent='Você já pode tentar novamente.'; $('authMessage').textContent=''; }
        else { btn.textContent=`Aguarde ${left}s`; hint.textContent=`Muitas tentativas consecutivas. Nova tentativa em ${formatWait(left)}.`; }
      },1000);
      return true;
    }
    btn.disabled=false; btn.textContent='Entrar';
    hint.textContent=state.fails>=3?'A próxima falha ativará uma espera progressiva.':'Proteção contra tentativas repetidas ativa.';
    return false;
  }
  function registerLoginFailure(forceSeconds=0){
    const state=readLoginGuard(); state.fails+=1; state.lastFailure=Date.now();
    const idx=Math.min(state.fails-1,LOGIN_DELAYS.length-1);
    const seconds=Math.max(forceSeconds,LOGIN_DELAYS[idx]||0);
    state.unlockAt=seconds?Date.now()+seconds*1000:0; writeLoginGuard(state); refreshLoginLock();
    return seconds;
  }

  async function syncSession(){
    if(!db){ $('accountBtn').textContent='Entrar'; return; }
    const {data:{session}}=await db.auth.getSession(); currentUser=session?.user||null; currentProfile=null;
    if(currentUser){ const {data}=await db.from('profiles').select('id,username,role').eq('id',currentUser.id).single(); currentProfile=data||null; }
    renderAccount(); if(activePost) await loadCommunity();
  }
  function renderAccount(){
    const btn=$('accountBtn'), menu=$('accountMenu');
    if(!currentUser){ btn.textContent='Entrar'; menu.hidden=true; return; }
    btn.textContent=`👤 ${currentProfile?.username||'Minha conta'}`;
    $('accountName').textContent=currentProfile?.username||'Usuário';
    $('accountEmail').textContent=currentUser.email||'';
    // O link administrativo só existe no DOM quando o banco confirma role = admin.
    document.getElementById('adminLink')?.remove();
    if(currentProfile?.role==='admin'){
      const adminLink=document.createElement('a');
      adminLink.id='adminLink';
      adminLink.href='admin.html';
      adminLink.textContent='⚙ Painel administrativo';
      menu.insertBefore(adminLink, $('logoutBtn'));
    }
  }

  $('accountBtn').addEventListener('click',()=>{ if(!currentUser)openAuth(); else $('accountMenu').hidden=!$('accountMenu').hidden; });
  $('logoutBtn').addEventListener('click',async()=>{ await db?.auth.signOut(); $('accountMenu').hidden=true; showToast('Você saiu da conta.'); });
  document.addEventListener('click',e=>{ if(!e.target.closest('.account-area')) $('accountMenu').hidden=true; });
  document.querySelectorAll('[data-auth-tab]').forEach(b=>b.addEventListener('click',()=>setAuthTab(b.dataset.authTab)));
  $('authClose').addEventListener('click',closeAuth); authModal.addEventListener('click',e=>{if(e.target.matches('[data-close-auth]'))closeAuth();});
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    if(refreshLoginLock()) return;
    const btn=$('loginSubmitBtn'); btn.disabled=true; btn.textContent='Entrando...'; $('authMessage').textContent='Validando acesso...';
    const {error}=await db.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});
    if(error){
      const isRateLimit=Number(error.status)===429 || /rate limit|too many/i.test(error.message||'');
      const wait=registerLoginFailure(isRateLimit?900:0);
      $('authMessage').textContent=isRateLimit?'Muitas solicitações foram detectadas pelo servidor. Aguarde antes de tentar novamente.':wait?`E-mail ou senha incorretos. Aguarde ${formatWait(wait)} antes da próxima tentativa.`:'E-mail ou senha incorretos.';
      refreshLoginLock(); return;
    }
    resetLoginGuard(); closeAuth(); showToast('Login realizado!');
  });
  $('signupForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const username=$('signupUsername').value.trim();
    if(!/^[A-Za-zÀ-ÿ0-9_. \-]+$/.test(username)){
      $('authMessage').textContent='Use apenas letras, números, espaço, ponto, underline ou hífen no nome de usuário.';
      return;
    }
    $('authMessage').textContent='Verificando nome de usuário...';
    const {data:available,error:availabilityError}=await db.rpc('username_available',{candidate:username});
    if(availabilityError){ console.error(availabilityError); $('authMessage').textContent='Não foi possível validar o nome de usuário agora.'; return; }
    if(!available){ $('authMessage').textContent='Esse nome de usuário já está em uso. Escolha outro.'; return; }
    $('authMessage').textContent='Criando conta...';
    const {data,error}=await db.auth.signUp({email:$('signupEmail').value.trim(),password:$('signupPassword').value,options:{data:{username}}});
    if(error){
      const msg=error.message||'';
      $('authMessage').textContent=/already registered|email.*registered/i.test(msg)?'Não foi possível criar a conta com esses dados. Tente entrar ou use outro e-mail.':/duplicate|unique|saving new user/i.test(msg)?'Esse nome de usuário já está em uso. Escolha outro.':msg;
      return;
    }
    // Com confirmação de e-mail ativa, o Supabase pode devolver uma resposta ofuscada
    // quando o endereço já existe. Nessa situação não anunciamos falsamente uma nova conta.
    const identities=Array.isArray(data?.user?.identities)?data.user.identities:null;
    if(data?.user && identities && identities.length===0){
      $('authMessage').textContent='Não foi possível concluir um novo cadastro com esses dados. Tente entrar na conta ou use outro e-mail.';
      return;
    }
    if(data.session){closeAuth();showToast('Conta criada!');}
    else $('authMessage').textContent='Cadastro recebido. Confira seu e-mail para confirmar a conta antes de entrar.';
  });
  db?.auth.onAuthStateChange(()=>setTimeout(syncSession,0));

  filtersEl.addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;activeFilter=b.dataset.filter;renderFilters();renderPosts();});
  searchInput.addEventListener('input',renderPosts);
  postsGrid.addEventListener('click',e=>{const c=e.target.closest('[data-post-id]');if(c)openPost(c.dataset.postId)}); postsGrid.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-post-id]')){e.preventDefault();openPost(e.target.dataset.postId)}});
  featuredEl.addEventListener('click',()=>openPost(featuredEl.dataset.postId)); featuredEl.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPost(featuredEl.dataset.postId)}});
  $('randomPostBtn').addEventListener('click',()=>posts.length&&openPost(posts[Math.floor(Math.random()*posts.length)].id));
  $('modalClose').addEventListener('click',closePost); articleModal.addEventListener('click',e=>{if(e.target.matches('[data-close-modal]'))closePost(); const hero=e.target.closest('#modalHero.has-image'); if(hero&&activePost?.cover_image_url)openImageLightbox(activePost.cover_image_url,`Capa da matéria: ${activePost.title}`);});
  $('imageLightboxClose').addEventListener('click',closeImageLightbox); $('imageLightbox').addEventListener('click',e=>{if(e.target.matches('[data-close-image]'))closeImageLightbox();});
  document.querySelectorAll('.reaction-btn').forEach(b=>b.addEventListener('click',()=>react(b.dataset.reaction))); $('commentForm').addEventListener('submit',submitComment);
  $('commentsList').addEventListener('click',async e=>{const b=e.target.closest('[data-comment-id]');if(!b||!confirm('Excluir este comentário?'))return;const {error}=await db.from('comments').delete().eq('id',b.dataset.commentId);if(error)return showToast('Não foi possível excluir.');await loadCommunity();});
  $('menuBtn').addEventListener('click',()=>$('mainNav').classList.toggle('open'));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('imageLightbox').classList.contains('open'))closeImageLightbox();else if(authModal.classList.contains('open'))closeAuth();else if(articleModal.classList.contains('open'))closePost();}});

  loadPosts(); syncSession();
})();
