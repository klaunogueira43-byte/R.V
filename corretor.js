/* ÁREA DO CORRETOR: login, cadastro/edição de imóveis, textos do site e perfil.
   Tudo que o corretor salva vai direto para o Supabase e aparece na hora para os clientes. */

/* ===== LOGIN ===== */
$('#loginBtn').onclick=()=>{
 if(user)return;
 $('#dt').textContent='Entrar como corretor';
 $('#dbody').innerHTML=`<form id="lf"><label>E-mail<input id="lu" type="email" autocomplete="username" autocapitalize="none" required></label><label>Senha<input id="ls" type="password" autocomplete="current-password" required></label><p class="err" id="le" hidden>E-mail ou senha incorretos.</p><div class="fl"><button class="btn" type="submit" id="lb">Entrar</button></div></form>`;
 $('#lf').onsubmit=async e=>{
  e.preventDefault();const b=$('#lb');b.disabled=true;$('#le').hidden=true;
  const {error}=await sb.auth.signInWithPassword({email:$('#lu').value.trim().toLowerCase(),password:$('#ls').value});
  if(error){$('#le').textContent='E-mail ou senha incorretos.';$('#le').hidden=false;b.disabled=false;return}
  const ok=await carregarUsuario();
  if(!ok){$('#le').textContent='Esta conta ainda não tem permissão de corretor. Fale com o administrador.';$('#le').hidden=false;b.disabled=false;return}
  dlg.close();desenhar();
 };
 dlg.showModal();
};
$('#sair').onclick=async()=>{await sb.auth.signOut();user=null;barra();desenhar()};

/* ===== CADASTRO / EDIÇÃO ===== */
$('#novo').onclick=()=>formImovel();
function formImovel(id){
 const i=id?imoveis.find(x=>x.id===id):{status:'venda',corretor:user.id||(corretores[0]||{}).id,fotos:[]};
 if(!i)return;
 const opt=(v,t,s)=>`<option value="${esc(v)}"${v===s?' selected':''}>${t}</option>`;
 $('#dt').textContent=id?'Editar imóvel':'Novo imóvel';
 $('#dbody').innerHTML=`<form id="f">
 <label>Título<input name="titulo" required value="${esc(i.titulo)}" placeholder="Ex.: Apartamento com varanda"></label>
 <div class="row"><label>Bairro<input name="bairro" required value="${esc(i.bairro)}"></label><label>Preço (R$)<input name="preco" type="number" min="0" required value="${i.preco??''}"></label></div>
 <div class="row"><label>Quartos<input name="quartos" type="number" min="0" required value="${i.quartos??''}"></label><label>Banheiros<input name="banheiros" type="number" min="0" required value="${i.banheiros??''}"></label></div>
 <div class="row"><label>Vagas<input name="vagas" type="number" min="0" required value="${i.vagas??0}"></label><label>Área (m²)<input name="area" type="number" min="0" step="any" required value="${i.area??''}"></label></div>
 <div class="row"><label>Situação<select name="status">${Object.entries(ST).map(([k,v])=>opt(k,v,i.status)).join('')}</select></label>
 <label>Corretor<select name="corretor">${corretores.map(c=>opt(c.id,esc(c.nome),i.corretor)).join('')}</select></label></div>
 <label>Descrição<textarea name="descricao">${esc(i.descricao)}</textarea></label>
 <label>Fotos (um link por linha; a primeira é a capa)<textarea name="fotos" placeholder="https://...">${esc((i.fotos||[]).join('\n'))}</textarea></label>
 <p class="hint">Para tirar uma foto, apague a linha dela. Para mudar a capa, coloque a foto desejada na primeira linha.</p>
 <label>Enviar fotos do computador/celular<input id="up" type="file" accept="image/*" multiple></label>
 <p class="hint">As fotos enviadas ficam guardadas no Supabase e aparecem para os clientes assim que você salvar.</p>
 <p class="err" id="fe" hidden></p>
 <div class="fl"><button class="btn sec" type="button" id="cn">Cancelar</button><button class="btn" type="submit" id="sv">Salvar imóvel</button></div></form>`;
 $('#cn').onclick=()=>dlg.close();
 $('#f').onsubmit=async e=>{
  e.preventDefault();
  const d=new FormData(e.target),btn=$('#sv'),fe=$('#fe');
  btn.disabled=true;fe.hidden=true;btn.textContent='Salvando…';
  const enviados=[];
  try{
   const fotos=d.get('fotos').split('\n').map(s=>s.trim()).filter(Boolean);
   for(const f of $('#up').files){
    btn.textContent='Enviando fotos…';
    const blob=await reduzir(f),path=crypto.randomUUID()+'.jpg';
    const {error:ue}=await sb.storage.from(BUCKET).upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'});
    if(ue)throw ue;
    enviados.push(path);
    fotos.push(sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
   }
   btn.textContent='Salvando…';
   const row={titulo:d.get('titulo').trim(),bairro:d.get('bairro').trim(),preco:+d.get('preco'),quartos:+d.get('quartos'),banheiros:+d.get('banheiros'),vagas:+d.get('vagas'),area:+d.get('area'),status:d.get('status'),corretor_id:d.get('corretor')||null,descricao:d.get('descricao').trim(),fotos};
   const {error}=id?await sb.from('imoveis').update(row).eq('id',id):await sb.from('imoveis').insert(row);
   if(error)throw error;
   if(id)apagarFotos((i.fotos||[]).filter(u=>!fotos.includes(u))).catch(console.error); // limpa do Storage as fotos removidas
   dlg.close();await recarregar();
  }catch(x){
   console.error(x);
   if(enviados.length)sb.storage.from(BUCKET).remove(enviados).catch(console.error); // não deixa foto órfã se o salvamento falhou
   fe.textContent='Não foi possível salvar: '+(x.message||x);fe.hidden=false;
   btn.disabled=false;btn.textContent='Salvar imóvel';
  }
 };
 dlg.showModal();
}
/* Reduz a foto (máx. 1600px) para economizar espaço e carregar rápido */
function reduzir(file){return new Promise((res,rej)=>{
 const r=new FileReader();r.onerror=()=>rej(new Error('Não consegui ler a foto.'));
 r.onload=()=>{const im=new Image();im.onerror=()=>rej(new Error('Arquivo de imagem inválido.'));
  im.onload=()=>{const s=Math.min(1,1600/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);c.toBlob(b=>b?res(b):rej(new Error('Falha ao preparar a foto.')),'image/jpeg',.82)};
  im.src=r.result};
 r.readAsDataURL(file)})}

/* ===== TEXTOS DO SITE E PERFIL ===== */
$('#site').onclick=()=>{
 const c=cfg();
 $('#dt').textContent='Editar textos e aparência do site';
 $('#dbody').innerHTML=`<form id="sf">
 <label>Nome do site (topo)<input name="marca" required value="${esc(c.marca)}"></label>
 <label>Título principal<input name="titulo" required value="${esc(c.titulo)}"></label>
 <label>Texto abaixo do título<textarea name="sub">${esc(c.sub)}</textarea></label>
 <label>Texto do rodapé<textarea name="rodape">${esc(c.rodape)}</textarea></label>
 <label>Mensagem do WhatsApp<textarea name="zap">${esc(c.zap)}</textarea></label>
 <p class="hint">Use {titulo}, {bairro} e {preco} para o sistema preencher sozinho.</p>
 <label>Cor principal<input name="cor" type="color" value="${esc(c.cor)}" style="height:44px;padding:4px"></label>
 <p class="err" id="fe" hidden></p>
 <div class="fl"><button class="btn sec" type="button" id="cn">Cancelar</button><button class="btn" type="submit" id="sv">Salvar alterações</button></div></form>`;
 $('#cn').onclick=()=>dlg.close();
 $('#sf').onsubmit=async e=>{
  e.preventDefault();const btn=$('#sv');btn.disabled=true;$('#fe').hidden=true;
  const v=Object.fromEntries(new FormData(e.target));
  const {error}=await sb.from('site_config').update({marca:v.marca.trim(),titulo:v.titulo.trim(),sub:v.sub.trim(),rodape:v.rodape.trim(),zap:v.zap.trim(),cor:v.cor}).eq('id',1);
  if(error){$('#fe').textContent='Não foi possível salvar: '+error.message;$('#fe').hidden=false;btn.disabled=false;return}
  dlg.close();await recarregar();
 };
 dlg.showModal();
};
$('#perfil').onclick=()=>{
 const p=corr(user.id);
 $('#dt').textContent='Meu perfil';
 $('#dbody').innerHTML=`<form id="pf"><label>Nome<input name="nome" required value="${esc(p.nome)}"></label><label>WhatsApp<input name="whats" inputmode="numeric" value="${esc(p.whats||'')}" placeholder="5511999999999"></label><p class="hint">Só números: 55 + DDD + número. É para este contato que o cliente será levado.</p><p class="err" id="fe" hidden></p><div class="fl"><button class="btn sec" type="button" id="cn">Cancelar</button><button class="btn" type="submit" id="sv">Salvar perfil</button></div></form>`;
 $('#cn').onclick=()=>dlg.close();
 $('#pf').onsubmit=async e=>{
  e.preventDefault();const btn=$('#sv');btn.disabled=true;$('#fe').hidden=true;
  const d=new FormData(e.target);
  const {error}=await sb.from('corretores').update({nome:d.get('nome').trim(),whats:d.get('whats').replace(/\D/g,'')}).eq('id',user.id);
  if(error){$('#fe').textContent='Não foi possível salvar: '+error.message;$('#fe').hidden=false;btn.disabled=false;return}
  dlg.close();await recarregar();
 };
 dlg.showModal();
};

init();
