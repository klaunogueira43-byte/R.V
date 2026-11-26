/* CATÁLOGO: o que o cliente vê (lista, filtros e detalhe do imóvel). */
/* ===== ESTADO ===== */
const $=s=>document.querySelector(s);
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ST={venda:'À venda',reservado:'Reservado',vendido:'Vendido'};
let pub=[],pubCfg={...CFG0},draft=null,draftCfg=null,user=null;
const cfg=()=>user?draftCfg:pubCfg;
const norm=d=>Array.isArray(d)?{config:{},imoveis:d}:{config:d.config||{},imoveis:d.imoveis||[]};
const mescla=c=>({...CFG0,...c,perfis:{...(c.perfis||{})}});
const corr=id=>({...(CORRETORES.find(x=>x.id===id)||{}),...((cfg().perfis||{})[id]||{})});
const nomeDe=id=>corr(id).nome||'—';
const lista=()=>user?draft:pub;
const pode=()=>!!user;
const escurecer=h=>'#'+[1,3,5].map(k=>Math.round(parseInt(h.substr(k,2),16)*.8).toString(16).padStart(2,'0')).join('');
const salvar=()=>{try{localStorage.setItem('imoveis_rascunho',JSON.stringify({config:draftCfg,imoveis:draft}))}catch(e){alert('Memória do navegador cheia. Use links de foto em vez de enviar arquivos.')}};
const luz=h=>{const [r,g,b]=[1,3,5].map(k=>parseInt(h.substr(k,2),16)/255);return .2126*r+.7152*g+.0722*b};
function aplicar(){
 const c=cfg(),r=document.documentElement.style;
 $('#brand').textContent=c.marca;$('#hTitulo').textContent=c.titulo;$('#hSub').textContent=c.sub;$('#rodape').textContent=c.rodape;
 r.setProperty('--ac',c.cor);r.setProperty('--acd',escurecer(c.cor));r.setProperty('--acink',luz(c.cor)>.55?'#0f172a':'#fff');
}

async function init(){
 try{const r=await fetch('imoveis.json',{cache:'no-store'});if(!r.ok)throw 0;const d=norm(await r.json());pub=d.imoveis;pubCfg=mescla(d.config)}catch(e){pub=EXEMPLOS;pubCfg=mescla({})}
 aplicar();
 const u=sessionStorage.getItem('user');if(u){user=CORRETORES.find(c=>c.id===u);if(user)abrirRascunho()}
 desenhar();
}
function abrirRascunho(){
 let d=null;try{d=JSON.parse(localStorage.getItem('imoveis_rascunho'))}catch(e){}
 if(d){d=norm(d);draft=d.imoveis;draftCfg=mescla(d.config)}
 else{draft=JSON.parse(JSON.stringify(pub));draftCfg=mescla(JSON.parse(JSON.stringify(pubCfg)))}
 barra();
}
function barra(){$('#bar').hidden=!user;$('#loginBtn').textContent=user?'Modo corretor ativo':'Área do corretor';if(user)$('#who').textContent='Modo corretor: '+user.nome}

/* ===== LISTA ===== */
function desenhar(){
 aplicar();
 const q=$('#fq').value.toLowerCase(),b=+$('#fb').value||0,p=+$('#fp').value||1e12;
 const r=lista().filter(i=>(!q||(i.titulo+' '+i.bairro).toLowerCase().includes(q))&&i.quartos>=b&&i.preco<=p);
 $('#count').textContent=r.length===1?'1 imóvel encontrado':r.length+' imóveis encontrados';
 $('#grid').innerHTML=r.length?r.map(card).join(''):'<div class="empty">Nenhum imóvel com esses filtros. Tente ampliar a busca.</div>';
}
function card(i){
 const img=i.fotos&&i.fotos[0]?`<img class="cv" src="${esc(i.fotos[0])}" alt="${esc(i.titulo)}" loading="lazy">`:'<div class="ph">Foto em breve</div>';
 const ed=pode()?`<div class="edit"><button data-e="${i.id}">Editar</button><button class="del" data-d="${i.id}">Excluir</button></div>`:'';
 return `<article class="card" data-id="${i.id}"><div class="pic">${img}<span class="tag ${i.status}">${ST[i.status]||''}</span></div><div class="body"><div class="price">${brl(i.preco)}</div><div class="name">${esc(i.titulo)}</div><div class="loc">${esc(i.bairro)}</div><div class="facts"><span>${i.quartos} <small>quartos</small></span><span>${i.banheiros} <small>banh.</small></span><span>${i.vagas} <small>vagas</small></span><span>${i.area} <small>m²</small></span></div><div class="by">Corretor: ${esc(nomeDe(i.corretor))}</div>${ed}</div></article>`;
}
$('#grid').addEventListener('click',e=>{
 const be=e.target.closest('[data-e]'),bd=e.target.closest('[data-d]');
 if(be){e.stopPropagation();return formImovel(be.dataset.e)}
 if(bd){e.stopPropagation();if(confirm('Excluir este imóvel?')){draft=draft.filter(i=>i.id!==bd.dataset.d);salvar();desenhar()}return}
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
