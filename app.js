/* CATÁLOGO: o que o cliente vê (lista, filtros e detalhe do imóvel).
   Os dados vêm do Supabase. Quando o corretor salva, o banco já é atualizado e o site do cliente também. */
/* ===== ESTADO ===== */
const $=s=>document.querySelector(s);
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ST={venda:'À venda',reservado:'Reservado',vendido:'Vendido'};
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let imoveis=[],corretores=[],cfgAtual={...CFG0},user=null,erroCarga=null;
const cfg=()=>cfgAtual;
const corr=id=>corretores.find(x=>x.id===id)||{};
const nomeDe=id=>corr(id).nome||'—';
const lista=()=>imoveis;
const pode=()=>!!user;
const escurecer=h=>'#'+[1,3,5].map(k=>Math.round(parseInt(h.substr(k,2),16)*.8).toString(16).padStart(2,'0')).join('');
const luz=h=>{const [r,g,b]=[1,3,5].map(k=>parseInt(h.substr(k,2),16)/255);return .2126*r+.7152*g+.0722*b};
const doBanco=r=>({...r,corretor:r.corretor_id,preco:+r.preco,area:+r.area,fotos:r.fotos||[]});
function aplicar(){
 const c=cfg(),r=document.documentElement.style;
 $('#brand').textContent=c.marca;$('#hTitulo').textContent=c.titulo;$('#hSub').textContent=c.sub;$('#rodape').textContent=c.rodape;
 r.setProperty('--ac',c.cor);r.setProperty('--acd',escurecer(c.cor));r.setProperty('--acink',luz(c.cor)>.55?'#0f172a':'#fff');
}

/* ===== CARGA DOS DADOS ===== */
async function carregar(){
 const [a,b,c]=await Promise.all([
  sb.from('imoveis').select('*').order('created_at',{ascending:false}),
  sb.from('corretores').select('id,nome,whats').order('nome'),
  sb.from('site_config').select('*').eq('id',1).maybeSingle()
 ]);
 const e=a.error||b.error||c.error;if(e)throw e;
 imoveis=a.data.map(doBanco);corretores=b.data;cfgAtual={...CFG0,...(c.data||{})};
}
async function recarregar(){try{await carregar();erroCarga=null}catch(e){console.error(e);erroCarga=e}desenhar()}

/* Quando alguém edita (corretor), as telas abertas dos clientes se atualizam sozinhas */
let tRt;
function ouvirMudancas(){
 sb.channel('rv-mudancas').on('postgres_changes',{event:'*',schema:'public'},()=>{clearTimeout(tRt);tRt=setTimeout(recarregar,300)}).subscribe();
}

/* ===== SESSÃO DO CORRETOR ===== */
async function carregarUsuario(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){user=null;barra();return}
 const {data,error}=await sb.from('corretores_acesso').select('corretor_id,nome,admin').eq('user_id',session.user.id).maybeSingle();
 if(error||!data){await sb.auth.signOut();user=null;barra();return false}
 user={uid:session.user.id,id:data.corretor_id,nome:data.nome,admin:data.admin};
 barra();return true;
}
function barra(){
 $('#bar').hidden=!user;$('#loginBtn').textContent=user?'Modo corretor ativo':'Área do corretor';
 if(user){$('#who').textContent='Modo corretor: '+user.nome;$('#perfil').hidden=!user.id}
}
async function init(){
 $('#grid').innerHTML='<div class="empty">Carregando imóveis…</div>';
 aplicar();
 await recarregar();
 await carregarUsuario();desenhar();
 ouvirMudancas();
}

/* ===== FOTOS NO STORAGE ===== */
const caminhoFoto=u=>{const m=String(u).split('/object/public/'+BUCKET+'/')[1];return m?decodeURIComponent(m.split('?')[0]):null};
async function apagarFotos(urls){const p=(urls||[]).map(caminhoFoto).filter(Boolean);if(p.length)await sb.storage.from(BUCKET).remove(p)}

/* ===== LISTA ===== */
function desenhar(){
 aplicar();
 if(erroCarga){$('#count').textContent='';$('#grid').innerHTML='<div class="empty">Não foi possível carregar os imóveis agora. Tente novamente em instantes.</div>';return}
 const q=$('#fq').value.toLowerCase(),b=+$('#fb').value||0,p=+$('#fp').value||1e12;
 const r=lista().filter(i=>(!q||(i.titulo+' '+i.bairro).toLowerCase().includes(q))&&i.quartos>=b&&i.preco<=p);
 $('#count').textContent=r.length===1?'1 imóvel encontrado':r.length+' imóveis encontrados';
 $('#grid').innerHTML=r.length?r.map(card).join(''):'<div class="empty">Nenhum imóvel com esses filtros. Tente ampliar a busca.</div>';
}
function card(i){
 const img=i.fotos&&i.fotos[0]?`<img class="cv" src="${esc(i.fotos[0])}" alt="${esc(i.titulo)}" loading="lazy">`:'<div class="ph">Foto em breve</div>';
 const ed=pode()?`<div class="edit"><button data-e="${esc(i.id)}">Editar</button><button class="del" data-d="${esc(i.id)}">Excluir</button></div>`:'';
 return `<article class="card" data-id="${esc(i.id)}"><div class="pic">${img}<span class="tag ${i.status}">${ST[i.status]||''}</span></div><div class="body"><div class="price">${brl(i.preco)}</div><div class="name">${esc(i.titulo)}</div><div class="loc">${esc(i.bairro)}</div><div class="facts"><span>${i.quartos} <small>quartos</small></span><span>${i.banheiros} <small>banh.</small></span><span>${i.vagas} <small>vagas</small></span><span>${i.area} <small>m²</small></span></div><div class="by">Corretor: ${esc(nomeDe(i.corretor))}</div>${ed}</div></article>`;
}
$('#grid').addEventListener('click',async e=>{
 const be=e.target.closest('[data-e]'),bd=e.target.closest('[data-d]');
 if(be){e.stopPropagation();return formImovel(be.dataset.e)}
 if(bd){
  e.stopPropagation();
  if(!confirm('Excluir este imóvel? Isso some do site dos clientes na hora.'))return;
  const id=bd.dataset.d,fotos=(imoveis.find(i=>i.id===id)||{}).fotos;
  const {error}=await sb.from('imoveis').delete().eq('id',id);
  if(error){alert('Não foi possível excluir: '+error.message);return}
  apagarFotos(fotos).catch(console.error);
  await recarregar();return;
 }
 const c=e.target.closest('.card');if(c)detalhe(c.dataset.id);
});
['#fq','#fb','#fp'].forEach(s=>$(s).addEventListener('input',desenhar));

/* ===== DETALHE ===== */
const dlg=$('#dlg');
$('#dx').onclick=()=>dlg.close();
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
function detalhe(id){
 const i=lista().find(x=>x.id===id);if(!i)return;
 const f=i.fotos||[],cor=corr(i.corretor);
 const msg=encodeURIComponent(cfg().zap.replace('{titulo}',i.titulo).replace('{bairro}',i.bairro).replace('{preco}',brl(i.preco)));
 $('#dt').textContent=i.titulo;
 $('#dbody').innerHTML=`<div class="gal">${f.length?`<img id="big" src="${esc(f[0])}" alt="">`:'<div class="ph" style="border-radius:12px;aspect-ratio:16/10">Foto em breve</div>'}${f.length>1?`<div class="thumbs">${f.map((u,k)=>`<img src="${esc(u)}" alt="" class="${k?'':'on'}">`).join('')}</div>`:''}</div>
 <div class="dp">${brl(i.preco)}</div><div class="loc">${esc(i.bairro)} · ${ST[i.status]||''}</div>
 <div class="facts"><span>${i.quartos} <small>quartos</small></span><span>${i.banheiros} <small>banheiros</small></span><span>${i.vagas} <small>vagas</small></span><span>${i.area} <small>m²</small></span></div>
 <p class="desc">${esc(i.descricao)}</p>
 <div class="agent"><div><b>${esc(cor.nome||'Corretor')}</b><br><span class="loc">Responsável por este imóvel</span></div>${cor.whats?`<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${cor.whats}?text=${msg}">Chamar no WhatsApp</a>`:''}</div>`;
 const th=$('#dbody .thumbs');if(th)th.addEventListener('click',e=>{if(e.target.tagName==='IMG'){$('#big').src=e.target.src;th.querySelectorAll('img').forEach(x=>x.classList.toggle('on',x===e.target))}});
 dlg.showModal();
}

/* ===== TEMA (claro / noturno) ===== */
function rotuloTema(){$('#themeBtn').textContent=document.documentElement.dataset.theme==='dark'?'☀ Mudar para modo claro':'☾ Mudar para modo noturno'}
$('#themeBtn').onclick=()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;try{localStorage.setItem('tema',t)}catch(e){}rotuloTema()};
rotuloTema();

/* ===== MENU DA ENGRENAGEM ===== */
const menu=$('#menu'),gear=$('#gearBtn');
const fechaMenu=()=>{menu.hidden=true;gear.setAttribute('aria-expanded','false')};
gear.onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden;gear.setAttribute('aria-expanded',String(!menu.hidden))};
menu.addEventListener('click',e=>{if(e.target.closest('button'))fechaMenu()});
document.addEventListener('click',e=>{if(!menu.hidden&&!e.target.closest('#menu'))fechaMenu()});
