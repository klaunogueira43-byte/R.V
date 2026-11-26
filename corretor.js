/* ÁREA DO CORRETOR: login, cadastro/edição de imóveis, textos do site, perfil e publicação. */
/* ===== LOGIN ===== */
$('#loginBtn').onclick=()=>{
 if(user)return;
 $('#dt').textContent='Entrar como corretor';
 $('#dbody').innerHTML=`<form id="lf"><label>Usuário<input id="lu" autocomplete="username" autocapitalize="none" required></label><label>Senha<input id="ls" type="password" autocomplete="current-password" required></label><p class="err" id="le" hidden>Usuário ou senha incorretos.</p><div class="fl"><button class="btn" type="submit">Entrar</button></div></form>`;
 $('#lf').onsubmit=e=>{e.preventDefault();const u=$('#lu').value.trim().toLowerCase(),c=CORRETORES.find(x=>x.login===u);
  if(c&&c.senha===$('#ls').value){user=c;sessionStorage.setItem('user',c.id);abrirRascunho();dlg.close();desenhar()}else $('#le').hidden=false};
 dlg.showModal();
};
$('#sair').onclick=()=>{user=null;draft=null;sessionStorage.removeItem('user');barra();desenhar()};

/* ===== CADASTRO / EDIÇÃO ===== */
$('#novo').onclick=()=>formImovel();
function formImovel(id){
 const i=id?draft.find(x=>x.id===id):{status:'venda',corretor:user.admin?'maria':user.id,fotos:[]};
 const opt=(v,t,s)=>`<option value="${v}"${v===s?' selected':''}>${t}</option>`;
 $('#dt').textContent=id?'Editar imóvel':'Novo imóvel';
 $('#dbody').innerHTML=`<form id="f">
 <label>Título<input name="titulo" required value="${esc(i.titulo)}" placeholder="Ex.: Apartamento com varanda"></label>
 <div class="row"><label>Bairro<input name="bairro" required value="${esc(i.bairro)}"></label><label>Preço (R$)<input name="preco" type="number" min="0" required value="${i.preco??''}"></label></div>
 <div class="row"><label>Quartos<input name="quartos" type="number" min="0" required value="${i.quartos??''}"></label><label>Banheiros<input name="banheiros" type="number" min="0" required value="${i.banheiros??''}"></label></div>
 <div class="row"><label>Vagas<input name="vagas" type="number" min="0" required value="${i.vagas??0}"></label><label>Área (m²)<input name="area" type="number" min="0" required value="${i.area??''}"></label></div>
 <div class="row"><label>Situação<select name="status">${Object.entries(ST).map(([k,v])=>opt(k,v,i.status)).join('')}</select></label>
 <label>Corretor<select name="corretor">${CORRETORES.filter(c=>!c.admin).map(c=>opt(c.id,esc(nomeDe(c.id)),i.corretor)).join('')}</select></label></div>
 <label>Descrição<textarea name="descricao">${esc(i.descricao)}</textarea></label>
 <label>Fotos (um link por linha)<textarea name="fotos" placeholder="fotos/sala.jpg">${esc((i.fotos||[]).join('\n'))}</textarea></label>
 <p class="hint">Dica: envie as imagens para o GitHub junto com os outros arquivos e escreva só o nome, como sala.jpg. Ou envie arquivos abaixo (ficam só neste navegador até você exportar).</p>
 <label>Enviar fotos do computador<input id="up" type="file" accept="image/*" multiple></label>
 <div class="fl"><button class="btn sec" type="button" id="cn">Cancelar</button><button class="btn" type="submit">Salvar imóvel</button></div></form>`;
 $('#cn').onclick=()=>dlg.close();
 $('#f').onsubmit=async e=>{
  e.preventDefault();const d=new FormData(e.target);
  const fotos=d.get('fotos').split('\n').map(s=>s.trim()).filter(Boolean);
  for(const f of $('#up').files)fotos.push(await reduzir(f));
  const o={...i,id:i.id||'i'+Date.now(),titulo:d.get('titulo').trim(),bairro:d.get('bairro').trim(),preco:+d.get('preco'),quartos:+d.get('quartos'),banheiros:+d.get('banheiros'),vagas:+d.get('vagas'),area:+d.get('area'),status:d.get('status'),corretor:d.get('corretor'),descricao:d.get('descricao').trim(),fotos};
  const k=draft.findIndex(x=>x.id===o.id);k>=0?draft[k]=o:draft.unshift(o);
  salvar();dlg.close();desenhar();
 };
 dlg.showModal();
}
function reduzir(file){return new Promise(res=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,900/im.width),c=document.createElement('canvas');c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.7))};im.src=r.result};r.readAsDataURL(file)})}

/* ===== TEXTOS DO SITE E PERFIL ===== */
$('#site').onclick=()=>{
 const c=draftCfg;
 $('#dt').textContent='Editar textos e aparência do site';
 $('#dbody').innerHTML=`<form id="sf">
 <label>Nome do site (topo)<input name="marca" required value="${esc(c.marca)}"></label>
 <label>Título principal<input name="titulo" required value="${esc(c.titulo)}"></label>
 <label>Texto abaixo do título<textarea name="sub">${esc(c.sub)}</textarea></label>
 <label>Texto do rodapé<textarea name="rodape">${esc(c.rodape)}</textarea></label>
 <label>Mensagem do WhatsApp<textarea name="zap">${esc(c.zap)}</textarea></label>
 <p class="hint">Use {titulo}, {bairro} e {preco} para o sistema preencher sozinho.</p>
 <label>Cor principal<input name="cor" type="color" value="${esc(c.cor)}" style="height:44px;padding:4px"></label>
 <div class="fl"><button class="btn sec" type="button" id="cn">Cancelar</button><button class="btn" type="submit">Salvar alterações</button></div></form>`;
 $('#cn').onclick=()=>dlg.close();
 $('#sf').onsubmit=e=>{e.preventDefault();draftCfg={...draftCfg,...Object.fromEntries(new FormData(e.target))};salvar();dlg.close();desenhar()};
 dlg.showModal();
};
$('#perfil').onclick=()=>{
 const p=corr(user.id);
 $('#dt').textContent='Meu perfil';
 $('#dbody').innerHTML=`<form id="pf"><label>Nome<input name="nome" required value="${esc(p.nome)}"></label><label>WhatsApp<input name="whats" inputmode="numeric" value="${esc(p.whats||'')}" placeholder="5511999999999"></label><p class="hint">Só números: 55 + DDD + número. É para este contato que o cliente será levado.</p><div class="fl"><button class="btn sec" type="button" id="cn">Cancelar</button><button class="btn" type="submit">Salvar perfil</button></div></form>`;
 $('#cn').onclick=()=>dlg.close();
 $('#pf').onsubmit=e=>{e.preventDefault();const d=new FormData(e.target);draftCfg.perfis={...draftCfg.perfis,[user.id]:{nome:d.get('nome').trim(),whats:d.get('whats').replace(/\D/g,'')}};salvar();dlg.close();desenhar()};
 dlg.showModal();
};

/* ===== PUBLICAR (exportar/importar) ===== */
$('#exp').onclick=()=>{
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({config:draftCfg,imoveis:draft},null,2)],{type:'application/json'}));a.download='imoveis.json';a.click();
 alert('Arquivo imoveis.json baixado. Envie-o para o repositório no GitHub (substituindo o antigo) para os clientes verem as mudanças.');
};
$('#imp').onclick=()=>$('#impf').click();
$('#impf').onchange=async e=>{try{const d=norm(JSON.parse(await e.target.files[0].text()));draft=d.imoveis;draftCfg=mescla(d.config);salvar();desenhar()}catch(x){alert('Arquivo inválido. Use um imoveis.json exportado por este sistema.')}e.target.value=''};
$('#rst').onclick=()=>{if(confirm('Descartar suas alterações e voltar à versão publicada?')){localStorage.removeItem('imoveis_rascunho');draft=JSON.parse(JSON.stringify(pub));draftCfg=mescla(JSON.parse(JSON.stringify(pubCfg)));desenhar()}};

init();
