(function(){
  var C = window.PLENA, ENV = window.PLENA_ENVIO;
  var $ = function(s,r){return (r||document).querySelector(s)};
  var logo = function(nome,alt,cls){return '<img src="assets/logos/'+nome+'.svg" alt="'+alt+'" class="'+(cls||'')+'">'};
  var btnLista = function(txt,cls){return '<button type="button" class="btn '+(cls||'')+'" data-abrir-lista>'+txt+'</button>'};
  var leaf = '<svg class="folha" viewBox="0 0 100 100" aria-hidden="true"><path d="M53.5 90A52.79 52.79 0 0 1 90 24A52.79 52.79 0 0 1 53.5 90Z"/><path d="M46.5 90A45.63 45.63 0 0 1 10 36A45.63 45.63 0 0 1 46.5 90Z"/></svg>';
  var campo = function(id,rot,tipo,extra){return '<div class="campo"><label for="'+id+'">'+rot+'</label><input id="'+id+'" name="'+id.split('-')[0]+'" type="'+tipo+'" '+(extra||'')+' required><p class="erro" id="'+id+'-erro" role="alert"></p></div>'};
  var form = function(pref,origem,botao){
    return '<form class="form" novalidate data-origem="'+origem+'">'+
      campo(pref+'-nome','Nome','text','autocomplete="name"')+
      campo(pref+'-whatsapp','WhatsApp (com DDD)','tel','autocomplete="tel" inputmode="tel" placeholder="(11) 90000-0000"')+
      campo(pref+'-email','E-mail','email','autocomplete="email" inputmode="email"')+
      '<input class="isca" type="text" name="site" tabindex="-1" autocomplete="off" aria-hidden="true">'+
      '<div class="campo check"><input id="'+pref+'-ok" type="checkbox" required><label for="'+pref+'-ok">'+C.formulario.consentimento+'</label><p class="erro" id="'+pref+'-ok-erro" role="alert"></p></div>'+
      '<button class="btn" type="submit">'+botao+'</button><p class="status" role="status" aria-live="polite"></p></form>';
  };

  // Cabeçalho
  $('#topo').innerHTML = '<div class="cx topo-in"><a href="#" class="marca" aria-label="Plena, início"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/logos/plena-logo-negativo.svg"><img src="assets/logos/plena-logo-mono.svg" alt="Plena"></picture></a>'+
    '<nav aria-label="Principal"><ul>'+C.menu.map(function(m){return '<li><a href="'+m[1]+'">'+m[0]+'</a></li>'}).join('')+'</ul></nav>'+
    btnLista(C.botaoLista,'btn-topo')+'</div>';

  var a = C.abertura, p = C.paraQuem, j = C.jornada, r = C.recebe, e = C.equipe, pod = C.podcast, f = C.fundadora, g = C.guia, q = C.perguntas, fe = C.fechamento;
  var html = '';
  html += '<section class="abertura"><div class="cx grade2"><div><h1>'+a.titulo+'</h1><p class="lead">'+a.subtitulo+'</p>'+btnLista(C.botaoLista)+'</div>'+
    '<figure class="foto" role="img" aria-label="'+a.fotoAlt+'"><span class="foto-rotulo">'+a.fotoRotulo+'</span>'+leaf+'</figure></div></section>';

  html += '<section id="para-quem" class="sec"><div class="cx"><h2>'+p.titulo+'</h2><p class="lead">'+p.texto+'</p>'+
    '<ul class="cards">'+p.momentos.map(function(m){return '<li class="card"><h3>'+m[0]+'</h3><p>'+m[1]+'</p></li>'}).join('')+'</ul>'+
    '<div class="bloco-damasco"><h3>'+p.conquistasTitulo+'</h3><ul class="chips">'+p.conquistas.map(function(c){return '<li>'+c+'</li>'}).join('')+'</ul></div></div></section>';

  html += '<section id="como-funciona" class="sec sec-alt"><div class="cx"><h2>'+j.titulo+'</h2><p class="lead">'+j.texto+'</p>'+
    '<ol class="arvore">'+j.ciclos.map(function(c,i){return '<li class="ciclo" style="--cor:var(--fase-'+c.fase+')"><span class="no" aria-hidden="true">'+(i+1)+'</span>'+
      '<div class="card"><p class="parte">'+c.parte+' · '+c.duracao+'</p><h3>'+c.nome+'</h3><p>'+c.texto+'</p></div></li>'}).join('')+'</ol></div></section>';

  html += '<section id="programa" class="sec"><div class="cx"><h2>'+r.titulo+'</h2><ul class="cards cards3">'+
    r.itens.map(function(i){return '<li class="card"><h3>'+i[0]+'</h3><p>'+i[1]+'</p></li>'}).join('')+'</ul></div></section>';

  html += '<section id="equipe" class="sec sec-alt"><div class="cx"><h2>'+e.titulo+'</h2><div class="equipe">'+
    e.pessoas.map(function(x){return '<article class="card pessoa"><div class="avatar" role="img" aria-label="'+x.fotoAlt+'"><span>foto a definir</span></div><h3>'+x.nome+'</h3><p class="parte">'+x.papel+'</p><p>'+x.bio+'</p></article>'}).join('')+'</div></div></section>';

  html += '<section id="podcast" class="sec"><div class="cx"><div class="bloco-damasco bloco-podcast"><div><h2>'+pod.titulo+'</h2><p class="lead">'+pod.texto+'</p></div><div class="botoes">'+
    pod.botoes.map(function(b,i){return '<a class="btn '+(i?'btn-sec':'')+'" href="'+C.contato[b[1]]+'" target="_blank" rel="noopener">'+b[0]+'</a>'}).join('')+'</div></div></div></section>';

  html += '<section id="turma" class="sec sec-alt"><div class="cx grade2"><div><h2>'+f.titulo+'</h2><p class="lead">'+f.texto+'</p><p class="vagas"><span class="selo">'+f.vagas+'</span> <strong>'+f.preco+'</strong></p>'+
    '<p class="aviso">'+f.aviso+'</p>'+btnLista(C.botaoLista)+'</div>'+
    '<div class="card"><h3>O que inclui</h3><ul class="lista-ok">'+f.inclui.map(function(i){return '<li>'+i+'</li>'}).join('')+'</ul></div></div></section>';

  html += '<section id="guia" class="sec"><div class="cx grade2"><div><h2>'+g.titulo+'</h2><p class="lead">'+g.texto+'</p></div><div class="card">'+form('guia','guia-gratuito',g.botao)+'</div></div></section>';

  html += '<section id="perguntas" class="sec sec-alt"><div class="cx cx-estreito"><h2>'+q.titulo+'</h2>'+
    q.itens.map(function(i){return '<details class="faq"><summary>'+i[0]+'</summary><p>'+i[1]+'</p></details>'}).join('')+'</div></section>';

  html += '<section class="fechamento"><div class="cx"><h2>'+fe.titulo+'</h2>'+btnLista(fe.botao,'btn-claro')+'</div></section>';
  $('#conteudo').innerHTML = html;

  // Rodapé
  var ct = C.contato;
  $('#rodape').innerHTML = '<div class="cx rodape-in">'+logo('plena-logo-negativo','Plena')+
    '<ul class="contatos"><li><a href="'+ct.instagram+'" target="_blank" rel="noopener">Instagram '+ct.instagramRotulo+'</a></li>'+
    '<li><a href="https://wa.me/'+ct.whatsappNumero+'" target="_blank" rel="noopener">WhatsApp</a></li>'+
    '<li><a href="mailto:'+ct.email+'">'+ct.email+'</a></li></ul><p class="aviso-rodape">'+C.rodape.aviso+'</p></div>';
  $('#zap').href = 'https://wa.me/'+ct.whatsappNumero+'?text='+encodeURIComponent(ct.whatsappMensagem);

  // Modal da lista
  var modal = $('#modal');
  modal.innerHTML = '<div class="modal-in"><button type="button" class="fechar" aria-label="Fechar" data-fechar>×</button><h2 id="modal-titulo">'+C.formulario.tituloModal+'</h2><p>'+C.formulario.textoModal+'</p>'+form('lista','lista-de-espera','Entrar na lista')+'</div>';
  document.addEventListener('click',function(ev){
    if(ev.target.closest('[data-abrir-lista]')){ if(modal.showModal) modal.showModal(); }
    if(ev.target.closest('[data-fechar]') || ev.target===modal){ modal.close(); }
  });

  // Validação e envio
  function msg(form,id,txt){var el=$('#'+id+'-erro',form); if(el) el.textContent=txt||''; var i=$('#'+id,form); if(i) i.setAttribute('aria-invalid',txt?'true':'false');}
  function validar(form){
    var ok=true, ids={}; form.querySelectorAll('input[id]').forEach(function(i){ids[i.id.split('-')[1]]=i});
    var pref=Object.keys(ids).length&&form.querySelector('input[id]').id.split('-')[0];
    var nome=ids.nome.value.trim(), zap=ids.whatsapp.value.replace(/\D/g,''), mail=ids.email.value.trim();
    function chk(k,cond,t){msg(form,pref+'-'+k,cond?'':t); if(!cond) ok=false;}
    chk('nome',nome.length>=2,'Conte seu nome.');
    chk('whatsapp',zap.length>=10&&zap.length<=13,'Informe o WhatsApp com DDD.');
    chk('email',/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail),'Confira o e-mail.');
    chk('ok',ids.ok.checked,'Precisamos do seu aceite para entrar em contato.');
    if(!ok){var bad=form.querySelector('[aria-invalid="true"]'); if(bad) bad.focus();}
    return ok?{nome:nome,whatsapp:ids.whatsapp.value.trim(),email:mail,origem:form.dataset.origem}:null;
  }
  function enviar(d){
    if(ENV.provider==='none'){console.warn('[Plena] envio não configurado (js/config.js). Dados:',d);return Promise.resolve();}
    if(ENV.provider==='google'){
      var fd=new FormData(); Object.keys(ENV.googleCampos).forEach(function(k){fd.append(ENV.googleCampos[k],d[k])});
      return fetch(ENV.endpoint,{method:'POST',mode:'no-cors',body:fd});
    }
    return fetch(ENV.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(d)})
      .then(function(r){if(!r.ok) throw new Error(r.status)});
  }
  document.addEventListener('submit',function(ev){
    var form=ev.target; if(!form.classList.contains('form')) return; ev.preventDefault();
    var st=$('.status',form); st.textContent=''; st.className='status';
    if(form.elements.site&&form.elements.site.value) return;
    var d=validar(form); if(!d) return;
    var b=$('button[type=submit]',form); b.disabled=true;
    enviar(d).then(function(){form.reset();st.textContent=C.formulario.sucesso;st.classList.add('ok');})
      .catch(function(){st.textContent=C.formulario.erroEnvio;st.classList.add('falha');})
      .then(function(){b.disabled=false;});
  });
})();
