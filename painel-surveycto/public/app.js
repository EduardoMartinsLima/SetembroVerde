/* Painel PNP · SurveyCTO — front-end (sem dependências). */
(function () {
  'use strict';

  // ------------------------------------------------------------ estado
  let D = null; // payload do servidor
  let modo = lerPref('painel-modo', 'comparar');
  const tabelas = new Set(); // cartões exibidos como tabela
  const ui = { pendAberto: {}, pendBusca: {} };
  let chavesConhecidas = null;
  let statusAtual = null;
  let sseOk = false;

  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const fmt = (n, d = 0) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const pct = (a, b, d = 0) => (b ? fmt((a / b) * 100, d) + '%' : '—');

  function lerPref(k, def) { try { return localStorage.getItem(k) || def; } catch (e) { return def; } }
  function gravarPref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ------------------------------------------------------------ datas
  const MESES = { jan: 0, feb: 1, fev: 1, mar: 2, apr: 3, abr: 3, may: 4, mai: 4, jun: 5, jul: 6, aug: 7, ago: 7, sep: 8, set: 8, oct: 9, out: 9, nov: 10, dec: 11, dez: 11 };
  function parseData(v) {
    if (!v) return null;
    const s = String(v).trim();
    let m = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})(?:,? (\d{1,2}):(\d{2})(?::(\d{2}))? ?([AP]M)?)?/i.exec(s);
    if (m && MESES[m[1].toLowerCase()] !== undefined) {
      let h = +(m[4] || 0);
      if (m[7]) { const pm = m[7].toUpperCase() === 'PM'; if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
      return new Date(+m[3], MESES[m[1].toLowerCase()], +m[2], h, +(m[5] || 0), +(m[6] || 0));
    }
    m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function relativo(d) {
    if (!d) return '—';
    const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (s < 45) return 'agora';
    if (s < 3600) return `há ${Math.round(s / 60)} min`;
    if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    const dias = Math.floor(s / 86400);
    return dias === 1 ? 'ontem' : `há ${dias} dias`;
  }
  const diaChave = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hora = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataHora = (d) => d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ------------------------------------------------------------ preparo
  function normId(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    const dig = s.replace(/\D/g, '');
    if (dig.length >= 8) return dig;
    return semAcento(s).toLowerCase().replace(/\s+/g, ' ');
  }

  function preparar() {
    const editais = D.config.editais.map((e) => ({ ...e, re: new RegExp(e.padrao, 'i') }));
    const rotuloEdital = (v) => (D.esquema._edital && D.esquema._edital.opcoes && D.esquema._edital.opcoes[v]) || '';
    const qualEdital = (v) => {
      if (!v) return null;
      const t = `${v} ${rotuloEdital(v)}`;
      const e = editais.find((x) => x.re.test(String(v))) || editais.find((x) => x.re.test(t));
      return e ? e.id : null;
    };
    // base DATACAR
    const base = (D.base || []).map((b) => ({ ...b, _g: qualEdital(b.edital), _id: normId(b.id), _nome: normId(b.nome) }));
    const basePorId = new Map();
    for (const b of base) { if (b._id) basePorId.set(b._id, b); if (b._nome) basePorId.set('n:' + b._nome, b); }

    for (const r of D.registros) {
      r._data = parseData(r.SubmissionDate);
      const id = normId(r._idOp), nome = normId(r._nomeOp);
      r._op = id || (nome ? 'n:' + nome : r.KEY);
      r._base = (id && basePorId.get(id)) || (nome && basePorId.get('n:' + nome)) || null;
      r._g = qualEdital(r._edital) || (r._base && r._base._g) || null;
    }
    D.registros.sort((a, b) => (a._data || 0) - (b._data || 0));
    D._base = base;
    D._editais = editais;
  }

  const COR = { e1: 'var(--e1)', e2: 'var(--e2)', todos: 'var(--todos)' };
  function grupos() {
    const E = D._editais;
    const g = (e) => ({ id: e.id, nome: e.nome, descricao: e.descricao, cor: COR[e.id] || 'var(--todos)', regs: D.registros.filter((r) => r._g === e.id), base: D._base.filter((b) => b._g === e.id) });
    if (modo === 'comparar') return E.map(g);
    const e = E.find((x) => x.id === modo);
    if (e) return [g(e)];
    return [{ id: 'todos', nome: 'Todos', descricao: 'Editais 1 e 2', cor: COR.todos, regs: D.registros, base: D._base }];
  }

  // ------------------------------------------------------------ tooltip
  const tip = $('#tip');
  document.addEventListener('mousemove', (ev) => {
    const alvo = ev.target.closest && ev.target.closest('[data-tip]');
    if (!alvo) { tip.classList.remove('on'); return; }
    const linhas = alvo.getAttribute('data-tip').split('\n');
    tip.innerHTML = linhas.map((l, i) => (i === 0 ? `<b>${esc(l)}</b>` : esc(l))).join('<br>');
    tip.classList.add('on');
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
    if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  });

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('on'), 5000);
  }

  // ------------------------------------------------------------ tipos
  function rotuloCampo(v) {
    const e = D.esquema[v.campo];
    return v.titulo || (e && e.rotulo) || v.campo;
  }
  function tipoDe(v, regs) {
    if (v.tipo && v.tipo !== 'auto') return v.tipo;
    const e = D.esquema[v.campo];
    if (e) {
      if (e.tipo === 'select_one') return 'categoria';
      if (e.tipo === 'select_multiple') return 'multipla';
      if (e.tipo === 'integer' || e.tipo === 'decimal') return 'numero';
      if (e.tipo === 'date' && /nasc/i.test(v.campo)) return 'faixa_etaria';
    }
    const vals = regs.map((r) => r[v.campo]).filter((x) => x != null && x !== '');
    if (!vals.length) return 'categoria';
    const distintos = new Set(vals);
    const numerico = vals.every((x) => /^-?\d+([.,]\d+)?$/.test(x));
    if (numerico && distintos.size > 12) return 'numero';
    if (vals.every((x) => /^-?\d+( -?\d+)*$/.test(x)) && vals.some((x) => / /.test(x))) return 'multipla';
    if (distintos.size <= 15 || distintos.size / vals.length < 0.3) return 'categoria';
    return 'nuvem';
  }
  function rotuloOpcao(campo, valor) {
    const e = D.esquema[campo];
    return (e && e.opcoes && e.opcoes[valor]) || valor;
  }

  // ------------------------------------------------------------ agregações
  const FAIXAS = ['Até 20 anos', '21 a 29 anos', '30 a 39 anos', '40 a 49 anos', '50 a 59 anos', '60 a 69 anos', '70 a 79 anos', '80 anos ou mais'];
  function idadeDe(v) {
    const s = String(v).trim();
    if (/^\d{1,3}$/.test(s) && +s < 120) return +s;
    if (/^\d{4}$/.test(s)) return new Date().getFullYear() - +s;
    const d = parseData(s);
    if (!d) return null;
    const hoje = new Date();
    let a = hoje.getFullYear() - d.getFullYear();
    if (hoje.getMonth() < d.getMonth() || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())) a--;
    return a >= 0 && a < 120 ? a : null;
  }
  function faixa(a) {
    if (a <= 20) return FAIXAS[0];
    if (a <= 29) return FAIXAS[1];
    if (a >= 80) return FAIXAS[7];
    return FAIXAS[Math.floor(a / 10) - 1];
  }

  function contarCategorias(regs, campo, tipo) {
    const cont = new Map();
    let resp = 0, vazios = 0;
    const idades = [];
    for (const r of regs) {
      const v = r[campo];
      if (v == null || v === '') { vazios++; continue; }
      let chaves;
      if (tipo === 'multipla') chaves = [...new Set(String(v).trim().split(/\s+/))];
      else if (tipo === 'faixa_etaria') {
        const a = idadeDe(v);
        if (a == null) { vazios++; continue; }
        idades.push(a);
        chaves = [faixa(a)];
      } else chaves = [String(v).trim()];
      resp++;
      for (const k of chaves) cont.set(k, (cont.get(k) || 0) + 1);
    }
    return { cont, resp, vazios, idades };
  }

  function ordenarCategorias(campo, tipo, contagens) {
    const total = new Map();
    for (const c of contagens) for (const [k, n] of c.cont) total.set(k, (total.get(k) || 0) + n);
    if (tipo === 'faixa_etaria') return FAIXAS.slice();
    const e = D.esquema[campo];
    const chaves = [...total.keys()];
    if (e && e.opcoes) {
      const ordem = e.ordem || Object.keys(e.opcoes);
      return chaves.sort((a, b) => {
        const ia = ordem.indexOf(a), ib = ordem.indexOf(b);
        return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || total.get(b) - total.get(a);
      });
    }
    if (chaves.every((k) => /^-?\d+$/.test(k)) && chaves.length <= 15) return chaves.sort((a, b) => a - b);
    return chaves.sort((a, b) => total.get(b) - total.get(a));
  }

  // ------------------------------------------------------------ componentes
  function legenda(gs) {
    if (gs.length < 2) return '';
    return `<div class="legenda">${gs.map((g) => `<span><i class="chip-cor" style="background:${g.cor}"></i>${esc(g.nome)} · ${esc(g.descricao)}</span>`).join('')}</div>`;
  }

  function barrasHtml(cats, gs, valores, rotulo, tipBase) {
    // valores[gi].get(cat) = {n, base}
    return `<div class="barras">${cats.map((c) => {
      const tot = gs.reduce((a, _, gi) => a + ((valores[gi].get(c) || {}).n || 0), 0);
      const linhas = gs.map((g, gi) => {
        const { n = 0, base = 0 } = valores[gi].get(c) || {};
        const p = base ? (n / base) * 100 : 0;
        const tipTxt = `${rotulo(c)}\n${g.nome} (${g.descricao}): ${fmt(n)} de ${fmt(base)} ${tipBase} — ${pct(n, base, 1)}`;
        return `<div class="linha" data-tip="${esc(tipTxt)}"><div class="trilho"><div class="barra-v" style="width:${p.toFixed(2)}%;${n ? 'min-width:2px;' : ''}background:${g.cor}"></div></div><div class="num"><b>${fmt(n)}</b> · ${pct(n, base)}</div></div>`;
      }).join('');
      return `<div><div class="cat-rot"><span>${esc(rotulo(c))}</span>${gs.length > 1 ? `<span class="tot">${fmt(tot)} no total</span>` : ''}</div>${linhas}</div>`;
    }).join('')}</div>`;
  }

  function tabelaHtml(cats, gs, valores, rotulo) {
    const cab = gs.map((g) => `<th>${esc(g.nome)} n</th><th>%</th>`).join('');
    const linhas = cats.map((c) => `<tr><td>${esc(rotulo(c))}</td>${gs.map((g, gi) => { const { n = 0, base = 0 } = valores[gi].get(c) || {}; return `<td>${fmt(n)}</td><td>${pct(n, base, 1)}</td>`; }).join('')}</tr>`).join('');
    return `<div class="tabela-wrap"><table class="tab"><thead><tr><th>Categoria</th>${cab}</tr></thead><tbody>${linhas}</tbody></table></div>`;
  }

  function cartao(id, titulo, campo, corpo, rodape, opts = {}) {
    const btn = opts.semTabela ? '' : `<button class="btn-mini" data-tabela="${esc(id)}" aria-pressed="${tabelas.has(id)}">${esc(opts.rotuloTabela || 'Tabela')}</button>`;
    return `<article class="card ${opts.classe || ''}" id="card-${esc(id)}">
      <div class="card-cab"><div><h3>${esc(titulo)}</h3>${campo ? `<div class="campo">${esc(campo)}</div>` : ''}</div><div class="card-acoes">${btn}</div></div>
      ${corpo}
      ${rodape ? `<div class="card-rod">${rodape}</div>` : ''}
    </article>`;
  }

  function rodapeResp(gs, stats, extra) {
    return gs.map((g, gi) => `<span>${gs.length > 1 ? `<i class="chip-cor" style="background:${g.cor}"></i>` : ''}${esc(g.nome)}: ${fmt(stats[gi].resp)} resp.${stats[gi].vazios ? ` · ${fmt(stats[gi].vazios)} sem resposta` : ''}${extra ? extra(gi) : ''}</span>`).join('');
  }

  // ------------------------------------------------------------ cartões por tipo
  function cardCategoria(v, tipo, gs) {
    const stats = gs.map((g) => contarCategorias(g.regs, v.campo, tipo));
    const id = v.campo;
    const titulo = rotuloCampo(v);
    const respondeu = stats.some((s) => s.resp);
    if (!respondeu) return cartao(id, titulo, v.campo, vazioMsg(v), '', { semTabela: true });
    let cats = ordenarCategorias(v.campo, tipo, stats);
    // até 12 categorias; o restante vira "Outras"
    if (cats.length > 12 && tipo !== 'faixa_etaria') {
      const resto = cats.slice(11);
      cats = cats.slice(0, 11).concat(['__outras']);
      for (const s of stats) {
        let n = 0;
        for (const k of resto) n += s.cont.get(k) || 0;
        s.cont.set('__outras', n);
      }
    }
    const valores = stats.map((s) => new Map(cats.map((c) => [c, { n: s.cont.get(c) || 0, base: s.resp }])));
    const rotulo = (c) => (c === '__outras' ? 'Outras respostas' : tipo === 'faixa_etaria' ? c : rotuloOpcao(v.campo, c));
    const corpo = tabelas.has(id) ? tabelaHtml(cats, gs, valores, rotulo) : legenda(gs) + barrasHtml(cats, gs, valores, rotulo, tipo === 'multipla' ? 'OP (múltipla escolha)' : 'OP');
    let extra = null;
    if (tipo === 'faixa_etaria') {
      extra = (gi) => {
        const ids = stats[gi].idades;
        return ids.length ? ` · idade média ${fmt(ids.reduce((a, b) => a + b, 0) / ids.length, 1)}` : '';
      };
    }
    let rod = rodapeResp(gs, stats, extra);
    if (tipo === 'multipla') rod += '<span>Múltipla escolha: % sobre as OP que responderam (pode somar mais de 100%).</span>';
    if (v.nota) rod += `<span>${esc(v.nota)}</span>`;
    return cartao(id, titulo, v.campo, corpo, rod);
  }

  function vazioMsg(v) {
    if ((D.meta.naoEncontrados || []).includes(v.campo)) return `<div class="vazio">Campo <code>${esc(v.campo)}</code> não encontrado nos dados do SurveyCTO.<br>Confira o nome em <code>config/painel.config.js</code>.</div>`;
    return '<div class="vazio">Ainda sem respostas para este recorte.</div>';
  }

  function estatisticas(nums) {
    if (!nums.length) return null;
    const s = nums.slice().sort((a, b) => a - b);
    const soma = s.reduce((a, b) => a + b, 0);
    const meio = Math.floor(s.length / 2);
    return { n: s.length, soma, media: soma / s.length, mediana: s.length % 2 ? s[meio] : (s[meio - 1] + s[meio]) / 2, min: s[0], max: s[s.length - 1] };
  }
  const numDe = (x) => { if (x == null || x === '') return null; const n = parseFloat(String(x).replace(',', '.')); return isNaN(n) ? null : n; };

  function cardNumero(v, gs) {
    const id = v.campo;
    const titulo = rotuloCampo(v);
    const listas = gs.map((g) => g.regs.map((r) => numDe(r[v.campo])).filter((n) => n != null));
    const est = listas.map(estatisticas);
    if (!est.some(Boolean)) return cartao(id, titulo, v.campo, vazioMsg(v), '', { semTabela: true });
    const max = Math.max(...listas.flat());
    let faixas;
    if (max <= 10) faixas = Array.from({ length: Math.floor(max) + 1 }, (_, i) => [i, i, String(i)]);
    else faixas = [[0, 0, '0'], [1, 5, '1 a 5'], [6, 10, '6 a 10'], [11, 20, '11 a 20'], [21, 50, '21 a 50'], [51, 100, '51 a 100'], [101, Infinity, 'Mais de 100']].filter((f) => f[0] <= max);
    const cats = faixas.map((f) => f[2]);
    const valores = listas.map((l) => {
      const m = new Map();
      for (const f of faixas) m.set(f[2], { n: l.filter((x) => x >= f[0] && x <= f[1] + 0.999999).length, base: l.length });
      return m;
    });

    // relação com outro campo (ex.: associadas / pessoas na gestão)
    let relacao = null;
    if (v.relacao) {
      relacao = gs.map((g) => {
        let a = 0, b = 0;
        for (const r of g.regs) { const x = numDe(r[v.campo]), y = numDe(r[v.relacao.campo]); if (x != null && y != null) { a += x; b += y; } }
        return { a, b };
      });
    }

    const statHtml = gs.map((g, gi) => {
      const e = est[gi];
      if (!e) return `<div class="stat"><div class="rot">${esc(g.nome)}</div><div class="v">—</div></div>`;
      const rel = relacao && relacao[gi].b ? `<div class="d">${esc(v.relacao.rotulo)}: <b>${pct(relacao[gi].a, relacao[gi].b, 1)}</b></div>` : '';
      return `<div class="stat"><div class="rot">${gs.length > 1 ? `<i class="chip-cor" style="background:${g.cor}"></i>` : ''}${esc(g.nome)} · total</div><div class="v">${fmt(e.soma)}</div><div class="d">média ${fmt(e.media, 1)} · mediana ${fmt(e.mediana, 1)} · ${fmt(e.min)}–${fmt(e.max)}</div>${rel}</div>`;
    }).join('');

    let corpo;
    if (tabelas.has(id)) {
      corpo = `<div class="tabela-wrap"><table class="tab"><thead><tr><th>Medida</th>${gs.map((g) => `<th>${esc(g.nome)}</th>`).join('')}</tr></thead><tbody>${
        [['OP que responderam', 'n', 0], ['Total (soma)', 'soma', 0], ['Média por OP', 'media', 1], ['Mediana', 'mediana', 1], ['Mínimo', 'min', 0], ['Máximo', 'max', 0]]
          .map(([r, k, d]) => `<tr><td>${r}</td>${est.map((e) => `<td>${e ? fmt(e[k], d) : '—'}</td>`).join('')}</tr>`).join('')
      }${relacao ? `<tr><td>${esc(v.relacao.rotulo)}</td>${relacao.map((x) => `<td>${pct(x.a, x.b, 1)}</td>`).join('')}</tr>` : ''}</tbody></table></div>` + tabelaHtml(cats, gs, valores, (c) => c);
    } else {
      corpo = `<div class="stats">${statHtml}</div><div class="grupo-tit" style="margin:0 0 8px">Distribuição das OP</div>` + legenda(gs) + barrasHtml(cats, gs, valores, (c) => c, 'OP');
    }
    const stats = gs.map((g, gi) => ({ resp: listas[gi].length, vazios: g.regs.length - listas[gi].length }));
    return cartao(id, titulo, v.campo, corpo, rodapeResp(gs, stats));
  }

  const STOP = new Set(('a o e é de da do das dos em no na nos nas um uma uns umas para pra por com sem que se ao aos à às ou os as como mais menos muito pouco já não sim são ser foi tem ter há quando onde qual quais seu sua seus suas nosso nossa isso este esta esse essa todo toda todos todas também ainda pelo pela pelos pelas sobre entre até após cada outro outra outros outras mesmo mesma lhe eles elas ele ela nós vez vezes etc através forma meio usa usam uso feito feita fazer faz possui possuem pois porém mas então sempre algum alguma alguns algumas nenhum nenhuma' ).split(/\s+/));
  function palavras(texto) {
    return [...new Set(String(texto).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)))];
  }

  function cardNuvem(v, gs) {
    const id = v.campo;
    const titulo = rotuloCampo(v);
    const docs = gs.map((g) => g.regs.filter((r) => r[v.campo] && String(r[v.campo]).trim()).map((r) => ({ r, t: String(r[v.campo]).trim() })));
    if (!docs.some((d) => d.length)) return cartao(id, titulo, v.campo, vazioMsg(v), '', { semTabela: true });
    let corpo;
    if (tabelas.has(id)) {
      const todas = gs.flatMap((g, gi) => docs[gi].map((d) => ({ ...d, g })));
      todas.sort((a, b) => (b.r._data || 0) - (a.r._data || 0));
      corpo = `<div class="tabela-wrap" style="max-height:320px;overflow:auto"><table class="tab"><thead><tr><th>Resposta</th><th>Edital</th></tr></thead><tbody>${todas.map((d) => `<tr><td>${esc(d.t)}</td><td>${esc(d.g.nome)}</td></tr>`).join('')}</tbody></table></div>`;
    } else {
      corpo = `<div class="nuvens">${gs.map((g, gi) => {
        const cont = new Map();
        for (const d of docs[gi]) for (const w of palavras(d.t)) cont.set(w, (cont.get(w) || 0) + 1);
        const top = [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
        const maxN = top.length ? top[0][1] : 1;
        const arr = [];
        top.forEach((w, i) => (i % 2 ? arr.push(w) : arr.unshift(w)));
        const total = docs[gi].length;
        const nuvem = arr.length
          ? arr.map(([w, n], i) => {
            const k = Math.pow(n / maxN, 0.75);
            const size = 12 + k * 26;
            const cor = k > 0.55 ? 'var(--text-primary)' : 'var(--text-secondary)';
            return `<span style="font-size:${size.toFixed(1)}px;color:${cor}" data-tip="${esc(`${w}\n${fmt(n)} OP mencionam — ${pct(n, total, 1)} das ${fmt(total)} respostas (${g.nome})`)}">${esc(w)}</span>`;
          }).join('')
          : '<span class="vazio">Sem respostas</span>';
        return `<div class="nuvem-box">${gs.length > 1 ? `<div class="nuvem-tit"><i class="chip-cor" style="background:${g.cor}"></i>${esc(g.nome)} · ${esc(g.descricao)}</div>` : ''}<div class="nuvem">${nuvem}</div></div>`;
      }).join('')}</div>`;
    }
    const stats = gs.map((g, gi) => ({ resp: docs[gi].length, vazios: g.regs.length - docs[gi].length }));
    return cartao(id, titulo, v.campo, corpo, rodapeResp(gs, stats) + '<span>Tamanho da palavra = nº de OP que a mencionam.</span>', { rotuloTabela: 'Respostas' });
  }

  // ------------------------------------------------------------ seção A
  function kpis(gs) {
    const regs = gs.flatMap((g) => g.regs);
    const hoje = diaChave(new Date());
    const seteDias = Date.now() - 7 * 86400000;
    const nHoje = regs.filter((r) => r._data && diaChave(r._data) === hoje).length;
    const n7 = regs.filter((r) => r._data && r._data.getTime() >= seteDias).length;
    const ops = new Set(regs.map((r) => r._op));
    const base = gs.flatMap((g) => g.base);
    const baseIds = new Set(base.map((b) => b._id || 'n:' + b._nome));
    const cobertas = new Set(regs.filter((r) => r._base).map((r) => r._base._id || 'n:' + r._base._nome));
    const ultima = regs.reduce((m, r) => (r._data && (!m || r._data > m) ? r._data : m), null);
    const temBase = base.length > 0;
    const novosHoje = nHoje ? `<span class="up">+${fmt(nHoje)} hoje</span> · ` : '';
    return [
      { rot: 'Submissões recebidas', val: fmt(regs.length), sub: `${novosHoje}+${fmt(n7)} nos últimos 7 dias` },
      { rot: 'OP que responderam', val: fmt(ops.size), sub: temBase ? `de ${fmt(baseIds.size)} conveniadas na base DATACAR` : 'base DATACAR não carregada' },
      temBase
        ? { rot: 'Cobertura da coleta', val: pct(cobertas.size, baseIds.size, 1), sub: `faltam ${fmt(baseIds.size - cobertas.size)} OP responder` }
        : { rot: 'Ritmo (últimos 7 dias)', val: fmt(n7 / 7, 1), small: '/dia', sub: 'média diária de submissões' },
      { rot: 'Última resposta', val: ultima ? relativo(ultima) : '—', sub: ultima ? dataHora(ultima) : 'nenhuma submissão ainda' },
    ].map((k, i) => `<div class="kpi" id="kpi-${i}"><div class="rot">${esc(k.rot)}</div><div class="val">${esc(k.val)}${k.small ? `<small>${esc(k.small)}</small>` : ''}</div><div class="sub">${k.sub}</div></div>`).join('');
  }

  function cardCobertura(gs) {
    const temBase = D._base.length > 0;
    if (!temBase) {
      const corpo = `<div class="aviso info" style="margin:0 0 14px"><div>Para comparar <b>OP que responderam × OP que não responderam</b>, salve a lista de conveniadas do DATACAR em <code>config/base_conveniadas.csv</code> (colunas <code>edital;cnpj;nome</code>).</div></div>` +
        legenda(gs) + barrasHtml(['subm', 'ops'], gs, gs.map((g) => new Map([['subm', { n: g.regs.length, base: D.registros.length }], ['ops', { n: new Set(g.regs.map((r) => r._op)).size, base: new Set(D.registros.map((r) => r._op)).size }]])), (c) => (c === 'subm' ? 'Submissões' : 'OP distintas'), 'do total');
      return cartao('cobertura', 'OP que responderam × não responderam', '', corpo, '', { semTabela: true });
    }
    const corpo = `<div class="cob">${gs.map((g) => {
      const ids = new Set(g.regs.filter((r) => r._base).map((r) => r._base._id || 'n:' + r._base._nome));
      const total = g.base.length;
      const resp = g.base.filter((b) => ids.has(b._id || 'n:' + b._nome));
      const pend = g.base.filter((b) => !ids.has(b._id || 'n:' + b._nome));
      const semMatch = g.regs.filter((r) => !r._base).length;
      const busca = ui.pendBusca[g.id] || '';
      const filtro = semAcento(busca).toLowerCase();
      const lista = pend.filter((b) => !filtro || semAcento(`${b.nome} ${b.id} ${b.municipio}`).toLowerCase().includes(filtro));
      return `<div>
        <div class="cob-cab"><span class="nome"><i class="chip-cor" style="background:${g.cor}"></i>${esc(g.nome)} · ${esc(g.descricao)}</span><span class="pct">${pct(resp.length, total, 1)}</span></div>
        <div class="cob-barra" data-tip="${esc(`${g.nome}\nResponderam: ${fmt(resp.length)} (${pct(resp.length, total, 1)})\nNão responderam: ${fmt(pend.length)} (${pct(pend.length, total, 1)})`)}">
          <div style="flex-grow:${resp.length};background:${g.cor}"></div><div class="falta" style="flex-grow:${pend.length}"></div>
        </div>
        <div class="cob-det"><span><b>${fmt(resp.length)}</b> responderam</span><span><b>${fmt(pend.length)}</b> não responderam · ${fmt(total)} conveniadas</span></div>
        ${semMatch ? `<div class="cob-det" style="margin-top:4px"><span>${fmt(semMatch)} submissão(ões) sem correspondência na base DATACAR</span></div>` : ''}
        ${pend.length ? `<details class="pend" data-pend="${g.id}" ${ui.pendAberto[g.id] ? 'open' : ''}><summary>Ver OP que ainda não responderam (${fmt(pend.length)})</summary>
          <input type="search" placeholder="Buscar por nome, CNPJ ou município…" data-busca="${g.id}" value="${esc(busca)}">
          <div class="lista-pend">${lista.slice(0, 300).map((b) => `<div><span>${esc(b.nome || b.id)}</span><span class="m">${esc(b.municipio || b.id || '')}</span></div>`).join('') || '<div><span>Nenhuma OP encontrada.</span></div>'}</div>
        </details>` : ''}
      </div>`;
    }).join('')}</div>`;
    return cartao('cobertura', 'OP que responderam × não responderam', 'Comparação com a base DATACAR de conveniadas', corpo, '', { semTabela: true });
  }

  function cardLinhaTempo(gs) {
    return cartao('linha-tempo', 'Submissões por dia', '', `${legenda(gs)}<div class="tl" id="tl"></div>`, '', { semTabela: true, classe: 'span2' });
  }

  function desenharLinhaTempo(gs) {
    const box = $('#tl');
    if (!box) return;
    const W = Math.max(280, box.clientWidth), H = 220, pad = { l: 34, r: 6, t: 10, b: 24 };
    const datas = D.registros.map((r) => r._data).filter(Boolean);
    if (!datas.length) { box.innerHTML = '<div class="vazio">Nenhuma submissão ainda.</div>'; return; }
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let ini = new Date(Math.min(...datas)); ini.setHours(0, 0, 0, 0);
    const maxDias = W < 500 ? 30 : 60;
    if ((hoje - ini) / 86400000 > maxDias - 1) ini = new Date(hoje.getTime() - (maxDias - 1) * 86400000);
    if ((hoje - ini) / 86400000 < 13) ini = new Date(hoje.getTime() - 13 * 86400000);
    const dias = [];
    for (let d = new Date(ini); d <= hoje; d.setDate(d.getDate() + 1)) dias.push(diaChave(d));
    const serie = gs.map((g) => { const m = new Map(); for (const r of g.regs) if (r._data) { const k = diaChave(r._data); m.set(k, (m.get(k) || 0) + 1); } return m; });
    const tot = dias.map((k) => serie.reduce((a, m) => a + (m.get(k) || 0), 0));
    const maxV = Math.max(1, ...tot);
    const passo = maxV <= 4 ? 1 : Math.ceil(maxV / 4 / Math.pow(10, Math.floor(Math.log10(maxV / 4)))) * Math.pow(10, Math.floor(Math.log10(maxV / 4)));
    const topo = Math.ceil(maxV / passo) * passo;
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const bw = iw / dias.length;
    const y = (v) => pad.t + ih - (v / topo) * ih;
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Submissões por dia"><g class="eixo">`;
    for (let v = 0; v <= topo; v += passo) svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
    const cadaRot = Math.ceil(dias.length / Math.max(2, Math.floor(iw / 56)));
    dias.forEach((k, i) => {
      if (i % cadaRot === 0 || i === dias.length - 1) {
        const [, mm, dd] = k.split('-');
        if (i === dias.length - 1 || dias.length - 1 - i >= cadaRot / 2) svg += `<text x="${pad.l + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${dd}/${mm}</text>`;
      }
    });
    svg += '</g>';
    const larg = Math.max(2, Math.min(28, bw - 3));
    dias.forEach((k, i) => {
      let acum = 0;
      const x = pad.l + i * bw + (bw - larg) / 2;
      const partes = gs.map((g, gi) => ({ g, n: serie[gi].get(k) || 0 }));
      const [, mm, dd] = k.split('-');
      const tipTxt = `${dd}/${mm} — ${fmt(tot[i])} submissões${partes.length > 1 ? '\n' + partes.map((p) => `${p.g.nome}: ${fmt(p.n)}`).join('\n') : ''}`;
      partes.forEach((p, pi) => {
        if (!p.n) return;
        const y0 = y(acum), y1 = y(acum + p.n);
        acum += p.n;
        const ultimo = partes.slice(pi + 1).every((q) => !q.n);
        const h = Math.max(1, y0 - y1 - (acum - p.n > 0 ? 2 : 0));
        const r = ultimo ? Math.min(4, larg / 2, h) : 0;
        svg += r
          ? `<path d="M${x},${y1 + h} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + larg - r} Q${x + larg},${y1} ${x + larg},${y1 + r} V${y1 + h} Z" fill="${p.g.cor}"/>`
          : `<rect x="${x}" y="${y1}" width="${larg}" height="${h}" fill="${p.g.cor}"/>`;
      });
      svg += `<rect x="${pad.l + i * bw}" y="${pad.t}" width="${bw}" height="${ih}" fill="transparent" data-tip="${esc(tipTxt)}"/>`;
    });
    svg += '</svg>';
    box.innerHTML = svg;
  }

  function cardFeed(gs) {
    const regs = gs.flatMap((g) => g.regs.map((r) => ({ r, g }))).sort((a, b) => (b.r._data || 0) - (a.r._data || 0)).slice(0, 25);
    const corpo = regs.length
      ? `<div class="feed">${regs.map(({ r, g }) => {
        const nome = r._nomeOp || (r._base && r._base.nome) || r._idOp || r.KEY;
        const mun = r._municipio || (r._base && r._base.municipio) || '';
        const novo = chavesConhecidas && !chavesConhecidas.has(r.KEY);
        return `<div class="feed-item${novo ? ' novo' : ''}"><i class="chip-cor" style="background:${g.cor}" title="${esc(g.nome)}"></i><div class="n">${esc(nome)}<span class="s">${esc([mun, g.nome].filter(Boolean).join(' · '))}</span></div><span class="q" title="${r._data ? esc(dataHora(r._data)) : ''}">${relativo(r._data)}</span></div>`;
      }).join('')}</div>`
      : '<div class="vazio">Nenhuma submissão ainda.</div>';
    return cartao('feed', 'Últimas submissões', '', corpo, '', { semTabela: true });
  }

  // ------------------------------------------------------------ render
  function render() {
    if (!D) return;
    const gs = grupos();
    const cfg = D.config;
    $('#titulo').textContent = cfg.titulo;
    $('#subtitulo').textContent = `${cfg.subtitulo} · ${D.meta.servidor}`;
    document.title = 'Painel PNP';

    // segmentado
    const opcoes = [['comparar', 'Comparar editais', null]].concat(D._editais.map((e) => [e.id, `${e.nome} · ${e.descricao}`, COR[e.id]]), [['todos', 'Todos', COR.todos]]);
    $('#seg-modo').innerHTML = opcoes.map(([id, rot, cor]) => `<button data-modo="${id}" aria-pressed="${modo === id}">${cor ? `<i class="chip-cor" style="background:${cor}"></i>` : ''}${esc(rot)}</button>`).join('');
    $('#nav').innerHTML = `<a href="#sec-progresso"><b>A</b>Progresso</a>` + cfg.secoes.map((s) => `<a href="#sec-${s.id}"><b>${esc(s.letra)}</b>${esc(s.titulo)}</a>`).join('');

    $('#kpis').innerHTML = kpis(gs);
    renderAvisos(gs);

    let html = `<section class="secao" id="sec-progresso"><div class="secao-cab"><span class="letra">A</span><h2>Progresso da coleta e informações gerais</h2></div>
      <div class="grade larga" style="margin-top:14px">${cardCobertura(gs)}${cardFeed(gs)}${cardLinhaTempo(gs)}</div></section>`;
    for (const s of cfg.secoes) {
      html += `<section class="secao" id="sec-${s.id}"><div class="secao-cab"><span class="letra">${esc(s.letra)}</span><h2>${esc(s.titulo)}</h2></div>`;
      for (const g of s.grupos) {
        html += `<div class="grupo-tit">${esc(g.titulo)}</div><div class="grade">`;
        for (const v of g.variaveis) {
          const tipo = tipoDe(v, D.registros);
          if (tipo === 'numero') html += cardNumero(v, gs);
          else if (tipo === 'nuvem') html += cardNuvem(v, gs);
          else html += cardCategoria(v, tipo, gs);
        }
        html += '</div>';
      }
      html += '</section>';
    }
    $('#conteudo').innerHTML = html;
    desenharLinhaTempo(gs);

    $('#rodape').innerHTML = `Formulário <code>${esc(D.meta.formId)}</code> · ${fmt(D.registros.length)} submissões · ${D.meta.temXlsForm ? 'rótulos do XLSForm' : 'códigos brutos (sem XLSForm)'} · atualização automática a cada ${Math.round(D.meta.intervalo / 60) || 1} min`;
  }

  function renderAvisos(gs) {
    const m = D.meta;
    const av = [];
    if (m.demo) av.push(`<div class="aviso demo">⚠️ <div><b>DADOS DE DEMONSTRAÇÃO.</b> Valores fictícios gerados localmente (<code>npm run demo</code>). Para dados reais, configure o <code>.env</code> e rode <code>npm start</code>.</div></div>`);
    if (m.erro) av.push(`<div class="aviso erro">⛔ <div><b>Falha na última consulta ao SurveyCTO</b> (${esc(dataHora(new Date(m.erro.em)))}): ${esc(m.erro.mensagem)}${m.erro.dica ? `<br>${esc(m.erro.dica)}` : ''}${m.atualizadoEm ? `<br>Exibindo os últimos dados obtidos em ${esc(dataHora(new Date(m.atualizadoEm)))}.` : ''}</div></div>`);
    if (!m.demo && m.atualizadoEm && !m.temXlsForm) av.push(`<div class="aviso info">ℹ️ <div>Sem o XLSForm, as opções aparecem com o <b>código</b> salvo no SurveyCTO. Baixe a definição do formulário (Design → Download) e salve como <code>config/formulario.xlsx</code> para exibir os rótulos.</div></div>`);
    if (m.naoEncontrados && m.naoEncontrados.length) av.push(`<div class="aviso info">🔎 <div>Variáveis não encontradas nos dados: ${m.naoEncontrados.map((n) => `<code>${esc(n)}</code>`).join(' ')}</div></div>`);
    const semEdital = D.registros.filter((r) => !r._g).length;
    if (D.registros.length && semEdital && modo !== 'todos') av.push(`<div class="aviso info">🧭 <div><b>${fmt(semEdital)}</b> submissão(ões) sem edital identificado ${m.chaves.edital ? `(campo <code>${esc(m.chaves.edital)}</code>)` : '(nenhum campo de edital detectado — defina <code>CAMPO_EDITAL</code> no .env ou inclua a coluna <code>edital</code> na base DATACAR)'}; elas aparecem apenas em “Todos”.</div></div>`);
    $('#avisos').innerHTML = av.join('');
  }

  // ------------------------------------------------------------ eventos
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.modo) {
      modo = b.dataset.modo;
      gravarPref('painel-modo', modo);
      render();
    } else if (b.dataset.tabela) {
      const id = b.dataset.tabela;
      tabelas.has(id) ? tabelas.delete(id) : tabelas.add(id);
      render();
    } else if (b.id === 'btn-tema') {
      const atual = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const novo = atual === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', novo);
      gravarPref('painel-tema', novo);
    }
  });
  document.addEventListener('toggle', (ev) => {
    const d = ev.target;
    if (d.dataset && d.dataset.pend) ui.pendAberto[d.dataset.pend] = d.open;
  }, true);
  document.addEventListener('input', (ev) => {
    const i = ev.target;
    if (!i.dataset || !i.dataset.busca) return;
    ui.pendBusca[i.dataset.busca] = i.value;
    const pos = i.selectionStart;
    render();
    const n = document.querySelector(`[data-busca="${i.dataset.busca}"]`);
    if (n) { n.focus(); n.setSelectionRange(pos, pos); }
  });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => D && desenharLinhaTempo(grupos()), 150); });

  // ------------------------------------------------------------ tempo real
  async function carregar() {
    try {
      const r = await fetch('api/dados', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const novo = await r.json();
      const anteriores = chavesConhecidas;
      D = novo;
      preparar();
      const keys = new Set(D.registros.map((x) => x.KEY));
      const novos = anteriores && anteriores.size ? [...keys].filter((k) => !anteriores.has(k)).length : 0;
      chavesConhecidas = anteriores;
      render();
      chavesConhecidas = keys;
      if (novos > 0) {
        toast(`+${novos} nova${novos > 1 ? 's' : ''} submiss${novos > 1 ? 'ões' : 'ão'} recebida${novos > 1 ? 's' : ''}`);
        ['kpi-0', 'kpi-1', 'kpi-2'].forEach((id) => { const el = document.getElementById(id); if (el) el.classList.add('flash'); });
      }
      statusAtual = { ...(statusAtual || {}), ...D.meta };
      pills();
    } catch (e) {
      if (!D) $('#conteudo').innerHTML = `<div class="carregando">Não foi possível carregar os dados (${esc(e.message)}). Tentando novamente…</div>`;
      setTimeout(carregar, 10000);
    }
  }

  function pills() {
    const s = statusAtual || {};
    const ponto = $('#ponto'), txt = $('#vivo-txt');
    if (s.erro) { ponto.className = 'vivo erro'; txt.textContent = 'Erro na consulta'; }
    else if (sseOk) { ponto.className = 'vivo'; txt.textContent = 'AO VIVO'; }
    else { ponto.className = 'vivo off'; txt.textContent = 'Reconectando…'; }
    $('#pill-atual').textContent = s.atualizadoEm ? `Atualizado ${relativo(new Date(s.atualizadoEm))} · ${hora(new Date(s.atualizadoEm))}` : 'Aguardando 1ª consulta';
    if (s.emAndamento) $('#pill-prox').textContent = 'Consultando SurveyCTO…';
    else if (s.proximaEm) {
      const seg = Math.max(0, Math.round((new Date(s.proximaEm) - Date.now()) / 1000));
      $('#pill-prox').textContent = seg ? `Próxima em ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}` : 'Consultando SurveyCTO…';
    }
  }
  setInterval(pills, 1000);
  // atualiza "há X min" nos KPIs/feed sem nova consulta
  setInterval(() => { if (D && !document.querySelector('input:focus')) render(); }, 60000);

  function conectar() {
    if (!window.EventSource) { setInterval(carregar, 60000); return; }
    const es = new EventSource('api/eventos');
    es.addEventListener('open', () => { sseOk = true; pills(); });
    es.addEventListener('error', () => { sseOk = false; pills(); });
    es.addEventListener('status', (ev) => {
      sseOk = true;
      const s = JSON.parse(ev.data);
      statusAtual = { ...(statusAtual || {}), ...s };
      if (!D || s.versao !== D.meta.versao || (s.erro ? s.erro.em : null) !== (D.meta.erro ? D.meta.erro.em : null)) carregar();
      pills();
    });
  }

  carregar().then(conectar);
})();
