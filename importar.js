/* IMPORTAR PASTA: o corretor escolhe uma pasta (ou .zip) com uma subpasta por imóvel.
   Em cada subpasta: as fotos + um arquivo info.txt (ou .json) com os dados.
   O sistema separa cada imóvel, organiza as fotos, mostra uma prévia e só então salva no Supabase. */

/* ================= LEITURA E ORGANIZAÇÃO (funções puras) ================= */
const IMP_IMG=/\.(jpe?g|png|webp|gif|bmp)$/i, IMP_HEIC=/\.(heic|heif)$/i, IMP_INFO=/\.(txt|json|md)$/i;
const impSem=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const impChave=s=>impSem(s).replace(/[^a-z0-9]/g,'');
const impNat=(a,b)=>a.localeCompare(b,'pt-BR',{numeric:true,sensitivity:'base'});

/* nomes aceitos para cada campo no arquivo de informações */
const IMP_ALIAS={};
[['titulo','titulo','nome','anuncio','imovel','nomedoimovel'],
 ['bairro','bairro','localizacao','regiao','local'],
 ['preco','preco','valor','valordevenda','precodevenda'],
 ['quartos','quartos','quarto','dormitorios','dormitorio','dorms'],
 ['banheiros','banheiros','banheiro','banhos','wc'],
 ['vagas','vagas','vaga','garagem'],
 ['area','area','areautil','metragem','m2','tamanho'],
 ['status','status','situacao'],
 ['corretor','corretor','corretora','responsavel'],
 ['descricao','descricao','detalhes','observacoes','obs','sobre','texto']
].forEach(([campo,...nomes])=>nomes.forEach(n=>IMP_ALIAS[n]=campo));

/* "R$ 890.000,00" | "890.000" | "890 mil" | "1,2 milhão" | "105 m²" | "68,5"  ->  número */
function impNumero(s){
 if(s==null)return null;
 const t=impSem(s);
 const mult=/milh(ao|oes)/.test(t)?1e6:/\bmil\b/.test(t)?1e3:1;
 const m=t.match(/\d[\d.,]*/);if(!m)return null;
 let n=m[0].replace(/[.,]+$/,'');
 if(n.includes('.')&&n.includes(','))n=n.replace(/\./g,'').replace(',','.');
 else if(n.includes(','))n=n.replace(',','.');
 else if(/^\d{1,3}(\.\d{3})+$/.test(n))n=n.replace(/\./g,'');
 const v=parseFloat(n);return isNaN(v)?null:v*mult;
}

/* lê o texto do info.txt / info.json e devolve {titulo, bairro, preco, ...} (tudo texto) */
function impLerInfo(texto,nomeArquivo){
 const txt=String(texto||'').replace(/^\uFEFF/,''),o={};
 if(/\.json$/i.test(nomeArquivo||'')){
  const j=JSON.parse(txt);
  for(const k of Object.keys(j)){const c=IMP_ALIAS[impChave(k)];if(c&&j[k]!=null&&typeof j[k]!=='object')o[c]=String(j[k])}
  return o;
 }
 let atual=null;
 for(const linha of txt.split(/\r?\n/)){
  const m=linha.match(/^\s*[-*•]?\s*([^:=\n]{1,30}?)\s*[:=]\s*(.*)$/),c=m&&IMP_ALIAS[impChave(m[1])];
  if(c){atual=c;o[c]=m[2].trim()}
  else if(linha.trim()||atual==='descricao'){ /* texto solto vira descrição; linhas em branco separam parágrafos */
   if(atual!=='descricao'){atual='descricao';o.descricao=o.descricao||''}
   o.descricao+=(o.descricao?'\n':'')+linha.trim();
  }
 }
 if(o.descricao)o.descricao=o.descricao.replace(/\n{3,}/g,'\n\n').trim();
 return o;
}

/* entradas: [{path:'Pasta/Apto 1/foto.jpg', file}]  ->  grupos, um por imóvel */
function impAgrupar(entradas,nomeRaiz){
 const lim=entradas.map(e=>({file:e.file,segs:String(e.path).replace(/\\/g,'/').split('/').filter(Boolean)}))
  .filter(e=>e.segs.length&&!e.segs.some(s=>s.startsWith('.')||s==='__MACOSX')&&!/^(thumbs\.db|desktop\.ini)$/i.test(e.segs[e.segs.length-1]));
 if(!lim.length)return [];
 let pref=lim[0].segs.slice(0,-1);                  /* pasta(s) em comum: a "raiz" escolhida */
 for(const e of lim){const d=e.segs.slice(0,-1);let k=0;while(k<pref.length&&k<d.length&&pref[k]===d[k])k++;pref=pref.slice(0,k)}
 const raiz=pref[pref.length-1]||nomeRaiz||'Imóvel';
 const mapa=new Map();
 for(const e of lim){
  const rel=e.segs.slice(pref.length),sub=rel.length>1?rel[0]:'';
  if(!mapa.has(sub))mapa.set(sub,{nome:sub||raiz,imgs:[],heic:[],infos:[]});
  const g=mapa.get(sub),nome=rel[rel.length-1],item={name:nome,path:rel.join('/'),file:e.file};
  if(IMP_IMG.test(nome))g.imgs.push(item);else if(IMP_HEIC.test(nome))g.heic.push(item);else if(IMP_INFO.test(nome))g.infos.push(item);
 }
 let raizG=mapa.get('');mapa.delete('');
 let grupos=[...mapa.values()].sort((a,b)=>impNat(a.nome,b.nome));
 if(raizG){
  if(raizG.infos.length&&grupos.length&&grupos.every(g=>!g.infos.length)){   /* info na raiz + subpastas só de fotos = 1 imóvel */
   grupos.forEach(g=>{raizG.imgs.push(...g.imgs);raizG.heic.push(...g.heic)});grupos=[raizG];
  }else if(raizG.imgs.length||(raizG.infos.length&&!grupos.length))grupos.unshift(raizG);
  /* raiz sem fotos e com outras pastas: arquivos soltos são ignorados */
 }
 const CAPA=/^(capa|cover|principal|destaque)$/i,PREF=/^(info|informacoes|dados|imovel|detalhes|descricao)$/i;
 const semExt=n=>n.replace(/\.[^.]+$/,'');
 for(const g of grupos){
  g.imgs.sort((a,b)=>(CAPA.test(semExt(b.name))-CAPA.test(semExt(a.name)))||impNat(a.path,b.path));  /* capa primeiro, resto em ordem natural (2 antes de 10) */
  g.info=[...g.infos].sort((a,b)=>(PREF.test(impChave(semExt(b.name)))-PREF.test(impChave(semExt(a.name))))||impNat(a.path,b.path))[0]||null;
 }
 return grupos.filter(g=>g.imgs.length||g.info||g.heic.length);
}

const impBonito=s=>String(s||'').replace(/[_]+/g,' ').replace(/\s*-\s*/g,' - ').replace(/\s+/g,' ').trim();
function impStatus(s){const t=impSem(s);return /vendid/.test(t)?'vendido':/reserv/.test(t)?'reservado':'venda'}
function impAchaCorretor(txt,corretores){
 const t=impChave(txt);if(!t)return null;
 const c=corretores.find(x=>impChave(x.id)===t||impChave(x.nome)===t)      /* id ou nome completo */
  ||corretores.find(x=>impChave(x.nome).startsWith(t));                      /* só o primeiro nome */
 return c?c.id:null;
}

/* grupo + texto do info  ->  imóvel pronto para a prévia */
function impMontar(g,texto,ctx){
 const av=[];let d={};
 if(g.info){try{d=impLerInfo(texto,g.info.name)}catch(e){av.push('Não consegui ler "'+g.info.name+'". Confira se o arquivo está correto e preencha abaixo.')}}
 else av.push('Sem arquivo de informações (info.txt): preencha os campos abaixo.');
 if(!g.imgs.length)av.push('Nenhuma foto encontrada nesta pasta.');
 if(g.heic.length)av.push(g.heic.length+' foto(s) HEIC/HEIF ignorada(s): converta para JPG e tente de novo.');
 let corretor=impAchaCorretor(d.corretor,ctx.corretores);
 if(d.corretor&&!corretor)av.push('Corretor "'+d.corretor+'" não encontrado: usei '+(ctx.padraoNome||'o padrão')+'.');
 const n=k=>{const v=impNumero(d[k]);return v==null?0:v};
 const o={pasta:g.nome,imgs:g.imgs,
  titulo:(d.titulo||'').trim()||impBonito(g.nome),bairro:(d.bairro||'').trim(),preco:Math.round(n('preco')),
  quartos:Math.round(n('quartos')),banheiros:Math.round(n('banheiros')),vagas:Math.round(n('vagas')),area:n('area'),
  status:impStatus(d.status),corretor_id:corretor||ctx.padrao||null,descricao:(d.descricao||'').trim(),avisos:av};
 if(g.info&&!d.titulo)av.push('Sem "Título" no arquivo: usei o nome da pasta.');
 if(g.info&&!o.bairro)av.push('Falta o bairro.');
 if(g.info&&!o.preco)av.push('Falta o preço.');
 const chaveI=x=>impChave(x.titulo)+'|'+impChave(x.bairro);
 o.duplicado=(ctx.existentes||[]).some(x=>chaveI(x)===chaveI(o));
 if(o.duplicado)av.push('Parece que este imóvel já está cadastrado (mesmo título e bairro). Desmarcado por segurança.');
 o.marcado=!o.duplicado&&o.imgs.length+(g.info?1:0)>0;
 return o;
}

async function impAnalisar(entradas,nomeRaiz,ctx){
 const grupos=impAgrupar(entradas,nomeRaiz),itens=[];
 for(const g of grupos){let t='';if(g.info){try{t=await g.info.file.text()}catch(e){}}itens.push(impMontar(g,t,ctx))}
 return itens;
}

const IMP_MODELO=`Título: Apartamento com varanda gourmet
Bairro: Jardins
Preço: 890000
Quartos: 3
Banheiros: 2
Vagas: 2
Área: 105
Situação: venda
Corretor: maria
Descrição: Andar alto, sol da manhã e varanda integrada à sala.
Condomínio com lazer completo e portaria 24h.
`;

/* ================= TELAS (só rodam no navegador) ================= */
let impOcupado=false,impUrls=[];
if(typeof document!=='undefined'){
 const limpaUrls=()=>{impUrls.forEach(u=>URL.revokeObjectURL(u));impUrls=[]};
 const fechaDlg=()=>{limpaUrls();$('#dx').hidden=false;dlg.close()};
 /* enquanto importa, não deixa fechar sem querer (fora, X ou ESC) */
 dlg.addEventListener('click',e=>{if(impOcupado&&e.target===dlg)e.stopImmediatePropagation()},true);
 dlg.addEventListener('cancel',e=>{if(impOcupado)e.preventDefault()});

 $('#importar').onclick=()=>{
  $('#dt').textContent='Importar pasta de imóveis';
  $('#dbody').innerHTML=`<p style="margin-top:0">Escolha uma <b>pasta</b> (ou um arquivo <b>.zip</b>) com <b>uma subpasta para cada imóvel</b>. Dentro de cada subpasta coloque as fotos e um arquivo <b>info.txt</b> com os dados. O sistema separa tudo, organiza as fotos e mostra uma prévia para você conferir antes de salvar.</p>
  <pre class="imp-ex">Meus imóveis/
 ├─ Apto Jardins/
 │   ├─ info.txt
 │   ├─ capa.jpg
 │   └─ sala.jpg, quarto.jpg ...
 └─ Studio Pinheiros/
     ├─ info.txt
     └─ 01.jpg, 02.jpg ...</pre>
  <p class="hint" style="margin-top:0">A foto chamada "capa" vem primeiro; as demais seguem a ordem do nome. Dentro do info.txt use linhas como <b>Título:</b>, <b>Bairro:</b>, <b>Preço:</b>, <b>Quartos:</b>, <b>Banheiros:</b>, <b>Vagas:</b>, <b>Área:</b>, <b>Situação:</b>, <b>Corretor:</b> e <b>Descrição:</b>.</p>
  <p class="err" id="ie" hidden></p>
  <div class="fl" style="justify-content:flex-start;flex-wrap:wrap">
   <button class="btn" type="button" id="iPasta">Escolher pasta</button>
   <button class="btn sec" type="button" id="iZip">Escolher arquivo .zip</button>
   <button class="btn sec" type="button" id="iModelo">Baixar modelo do info.txt</button>
  </div>
  <input type="file" id="pastaIn" webkitdirectory multiple hidden><input type="file" id="zipIn" accept=".zip,application/zip,application/x-zip-compressed" hidden>`;
  $('#iPasta').onclick=()=>$('#pastaIn').click();
  $('#iZip').onclick=()=>$('#zipIn').click();
  $('#iModelo').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([IMP_MODELO],{type:'text/plain;charset=utf-8'}));a.download='info.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  $('#pastaIn').onchange=async e=>{
   const fs=[...e.target.files];e.target.value='';if(!fs.length)return;
   await impComecar(fs.map(f=>({path:f.webkitRelativePath||f.name,file:f})),'');
  };
  $('#zipIn').onchange=async e=>{
   const f=e.target.files[0];e.target.value='';if(!f)return;
   try{
    $('#dbody').innerHTML='<p>Abrindo o arquivo .zip…</p>';
    await impCarregarZip();
    const z=await JSZip.loadAsync(f),ent=[];
    for(const [path,en] of Object.entries(z.files)){if(!en.dir)ent.push({path,file:await en.async('blob')})}
    await impComecar(ent,f.name.replace(/\.zip$/i,''));
   }catch(x){console.error(x);$('#importar').onclick();$('#ie').textContent='Não consegui abrir este .zip: '+(x.message||x);$('#ie').hidden=false}
  };
  dlg.showModal();
 };

 function impCarregarZip(){return new Promise((ok,no)=>{
  if(window.JSZip)return ok();
  const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
  s.onload=ok;s.onerror=()=>no(new Error('Sem internet para carregar o leitor de .zip.'));document.head.appendChild(s);
 })}

 async function impComecar(entradas,nomeRaiz){
  $('#dbody').innerHTML='<p>Lendo as pastas…</p>';
  const padrao=(user&&user.id)||(corretores[0]||{}).id||null;
  const ctx={corretores,padrao,padraoNome:nomeDe(padrao),existentes:imoveis};
  let itens;
  try{itens=await impAnalisar(entradas,nomeRaiz,ctx)}catch(x){console.error(x);itens=[]}
  if(!itens.length){
   $('#importar').onclick();
   $('#ie').textContent='Não encontrei nenhum imóvel nessa seleção. Use uma pasta com subpastas (uma por imóvel) contendo fotos JPG/PNG/WEBP e um info.txt.';$('#ie').hidden=false;return;
  }
  impPrevia(itens);
 }

 function impPrevia(itens){
  limpaUrls();
  $('#dt').textContent='Conferir antes de importar';
  const optC=sel=>corretores.map(c=>`<option value="${esc(c.id)}"${c.id===sel?' selected':''}>${esc(c.nome)}</option>`).join('');
  const fatos=o=>[o.quartos+' quartos',o.banheiros+' banh.',o.vagas+' vagas',o.area+' m²',ST[o.status]].join(' · ');
  $('#dbody').innerHTML=`<form id="imf"><p style="margin-top:0">Encontrei <b>${itens.length}</b> imóvel(is). Confira, corrija o que precisar e desmarque o que não quiser importar.</p>
  ${itens.map((o,k)=>{
   const th=o.imgs.slice(0,5).map(i=>{const u=URL.createObjectURL(i.file);impUrls.push(u);return `<img src="${u}" alt="">`}).join('');
   return `<div class="imp-it" data-k="${k}">
    <label class="imp-top"><input type="checkbox" class="imp-ck"${o.marcado?' checked':''}> <b>${esc(o.pasta)}</b> <span class="imp-n">${o.imgs.length} foto(s)</span></label>
    <div class="row"><label>Título<input data-f="titulo" value="${esc(o.titulo)}"></label><label>Bairro<input data-f="bairro" value="${esc(o.bairro)}"></label></div>
    <div class="row"><label>Preço (R$)<input data-f="preco" type="number" min="0" value="${o.preco||''}"></label><label>Corretor<select data-f="corretor_id">${optC(o.corretor_id)}</select></label></div>
    <div class="imp-res">${esc(fatos(o))}</div>
    ${th?`<div class="imp-th">${th}</div>`:''}
    ${o.avisos.length?`<ul class="imp-av">${o.avisos.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:''}</div>`}).join('')}
  <p class="err" id="ie" hidden></p>
  <div class="fl"><button class="btn sec" type="button" id="icn">Cancelar</button><button class="btn" type="submit" id="iok"></button></div></form>`;
  const rot=()=>{const n=itens.filter(o=>o.marcado).length;$('#iok').textContent=n?`Importar ${n} imóvel(is)`:'Nada marcado';$('#iok').disabled=!n};
  const dados=e=>{const it=e.target.closest('.imp-it');if(!it)return null;return itens[+it.dataset.k]};
  $('#imf').addEventListener('input',e=>{
   const o=dados(e);if(!o)return;
   if(e.target.dataset.f){const f=e.target.dataset.f;o[f]=f==='preco'?+e.target.value||0:e.target.value;e.target.classList.remove('bad')}
  });
  $('#imf').addEventListener('change',e=>{const o=dados(e);if(o&&e.target.classList.contains('imp-ck')){o.marcado=e.target.checked;rot()}});
  $('#icn').onclick=fechaDlg;rot();
  $('#imf').onsubmit=e=>{
   e.preventDefault();
   const sel=itens.filter(o=>o.marcado);let ruim=null;
   document.querySelectorAll('#imf .bad').forEach(x=>x.classList.remove('bad'));
   sel.forEach(o=>{const el=$('#imf .imp-it[data-k="'+itens.indexOf(o)+'"]');
    [['titulo',!o.titulo.trim()],['bairro',!o.bairro.trim()],['preco',!(o.preco>0)]].forEach(([f,mal])=>{if(mal){const i=el.querySelector('[data-f="'+f+'"]');i.classList.add('bad');ruim=ruim||i}})});
   if(ruim){$('#ie').textContent='Preencha título, bairro e preço dos imóveis marcados (campos em vermelho).';$('#ie').hidden=false;ruim.scrollIntoView({block:'center'});ruim.focus();return}
   impImportar(sel);
  };
 }

 async function impImportar(sel){
  impOcupado=true;$('#dx').hidden=true;limpaUrls();
  $('#dt').textContent='Importando…';
  $('#dbody').innerHTML=`<p id="ist" style="margin-top:0">Preparando…</p><progress id="ipg" max="100" value="0" style="width:100%"></progress><p class="hint">Não feche esta janela até terminar.</p>`;
  const ok=[],falhas=[],base=Date.now();
  let totalFotos=sel.reduce((s,o)=>s+o.imgs.length,0),feitas=0;
  const prog=(txt)=>{$('#ist').textContent=txt;$('#ipg').value=totalFotos?Math.round(feitas/totalFotos*100):100};
  for(let k=0;k<sel.length;k++){
   const o=sel[k],id=crypto.randomUUID(),enviados=[],urls=new Array(o.imgs.length);
   try{
    /* fotos de cada imóvel ficam na própria pasta do Storage: imoveis-fotos/<id do imóvel>/01.jpg */
    for(let i=0;i<o.imgs.length;i+=3){
     prog(`Imóvel ${k+1} de ${sel.length}: "${o.titulo}" (enviando fotos…)`);
     await Promise.all(o.imgs.slice(i,i+3).map(async(im,j)=>{
      const n=i+j,blob=await reduzir(im.file),path=`${id}/${String(n+1).padStart(2,'0')}.jpg`;
      const {error}=await sb.storage.from(BUCKET).upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'});
      if(error)throw error;
      enviados.push(path);urls[n]=sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;feitas++;prog(`Imóvel ${k+1} de ${sel.length}: "${o.titulo}" (foto ${feitas} de ${totalFotos})`);
     }));
    }
    const {error}=await sb.from('imoveis').insert({id,titulo:o.titulo.trim(),bairro:o.bairro.trim(),preco:o.preco,quartos:o.quartos,banheiros:o.banheiros,vagas:o.vagas,area:o.area,status:o.status,corretor_id:o.corretor_id||null,descricao:o.descricao,fotos:urls,
     created_at:new Date(base-k*1000).toISOString()});   /* mantém a ordem das pastas na lista */
    if(error)throw error;
    ok.push(o);
   }catch(x){
    console.error(x);
    if(enviados.length)sb.storage.from(BUCKET).remove(enviados).catch(console.error);   /* não deixa foto órfã */
    falhas.push({o,msg:x.message||String(x)});
   }
  }
  impOcupado=false;$('#dx').hidden=false;
  await recarregar();
  $('#dt').textContent='Importação concluída';
  $('#dbody').innerHTML=`<p style="margin-top:0"><b>${ok.length}</b> imóvel(is) importado(s) e já visível(is) para os clientes.</p>
  ${falhas.length?`<p class="err"><b>${falhas.length} não foi(ram) importado(s):</b></p><ul class="imp-av">${falhas.map(f=>`<li><b>${esc(f.o.titulo)}</b>: ${esc(f.msg)}</li>`).join('')}</ul><p class="hint">Os que falharam não deixaram nada pela metade. Você pode tentar de novo só com eles.</p>`:''}
  <div class="fl"><button class="btn" type="button" id="ifim">Fechar</button></div>`;
  $('#ifim').onclick=fechaDlg;
 }
}

if(typeof module!=='undefined')module.exports={impNumero,impLerInfo,impAgrupar,impMontar,impAnalisar,impStatus,impAchaCorretor};
