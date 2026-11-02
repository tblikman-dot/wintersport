/* ============================================================
   Sinterklaasfestijn 2026 — logica
   TIJDELIJK. Zie de kop van sinterklaas-data.js voor hoe je alles weghaalt.

   Opslag: dezelfde Firebase Realtime Database als de boodschappenlijst,
   onder één tak (SINT.pad), met localStorage als offline spiegel — hetzelfde
   patroon als boodschappen.html.

   Over de verrassing: wie je bent is een keuze op je eigen toestel, geen
   inlog. Dat je je eigen cadeaus niet ziet regelt deze pagina netjes, maar
   het is een erewoord en geen slot: de gegevens zelf staan voor iedereen
   die de link heeft in dezelfde database.
   ============================================================ */

(function () {
  'use strict';

  var D = window.SINT;
  var FIREBASE_CONFIG = {
    databaseURL: 'https://dijkski-default-rtdb.europe-west1.firebasedatabase.app'
  };
  var WIE_SLEUTEL = 'sintWie2026';
  var LOKAAL_SLEUTEL = 'sintData2026';

  // { wensen: {id: {...}}, claims: {wensId: {...}}, tips: {id: {...}} }
  var data = { wensen: {}, claims: {}, tips: {} };
  var mij = null;
  var fbRef = null;
  var fbVerbonden = false;
  var bewerkt = null;   // id van de wens die open staat in het formulier
  var wachtend = false; // er kwam een wijziging binnen terwijl je typte

  var elScherm = document.getElementById('sintScherm');
  var elTerug = document.getElementById('sintTerug');
  var elIkBen = document.getElementById('sintIkBen');

  // ---------- kleine helpers ----------

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function deelnemer(id) {
    for (var i = 0; i < D.deelnemers.length; i++) {
      if (D.deelnemers[i].id === id) return D.deelnemers[i];
    }
    return null;
  }
  function naamVan(id) {
    var d = deelnemer(id);
    return d ? d.naam : 'iemand';
  }
  function nieuwId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  // Alleen http(s) als link toestaan; javascript: hoort hier niet thuis.
  function veiligeLink(u) {
    var t = String(u || '').trim();
    if (!t) return '';
    if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
    return /^https?:\/\/[^\s]+$/i.test(t) ? t : '';
  }

  // ---------- opslag ----------

  function laadLokaal() {
    try {
      var s = localStorage.getItem(LOKAAL_SLEUTEL);
      if (s) {
        var d = JSON.parse(s);
        data.wensen = d.wensen || {};
        data.claims = d.claims || {};
        data.tips = d.tips || {};
      }
    } catch (e) { /* lege of stukke opslag: we beginnen gewoon leeg */ }
  }
  function bewaarLokaal() {
    try { localStorage.setItem(LOKAAL_SLEUTEL, JSON.stringify(data)); } catch (e) {}
  }

  function zetSync(stand, label) {
    var el = document.getElementById('sintSync');
    el.className = 'sint-sync ' + stand;
    document.getElementById('sintSyncLabel').textContent = label;
  }

  function startFirebase() {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      var db = firebase.database();
      fbRef = db.ref(D.pad);

      db.ref('.info/connected').on('value', function (snap) {
        fbVerbonden = snap.val() === true;
        zetSync(fbVerbonden ? 'live' : '', fbVerbonden ? 'live' : 'offline');
      });

      fbRef.on('value', function (snap) {
        var d = snap.val() || {};
        data.wensen = d.wensen || {};
        data.claims = d.claims || {};
        data.tips = d.tips || {};
        bewaarLokaal();
        tekenExtern();
      });
    } catch (e) {
      console.error('Firebase fout:', e);
      zetSync('fout', 'alleen op dit toestel');
      laadLokaal();
      teken();
    }
  }

  // Eén tak per soort, zodat twee mensen tegelijk niet elkaars werk wissen.
  function schrijf(soort, id, waarde) {
    bewaarLokaal();
    if (!fbRef) { teken(); return; }
    fbRef.child(soort).child(id).set(waarde).catch(function (e) {
      console.error('Schrijffout:', e);
      zetSync('fout', 'opslaan mislukt');
    });
  }

  // ---------- wie ben jij ----------

  function laadWie() {
    try { mij = localStorage.getItem(WIE_SLEUTEL) || null; } catch (e) { mij = null; }
    if (mij && !deelnemer(mij)) mij = null;
  }
  function zetWie(id) {
    mij = id;
    try { localStorage.setItem(WIE_SLEUTEL, id); } catch (e) {}
    teken();
  }

  // ---------- aftellen ----------

  function tekenAftellen() {
    var el = document.getElementById('sintTellen');
    if (!el) return;
    var nu = new Date();
    var ms = D.pakjesavond - nu;
    if (ms <= 0) {
      el.innerHTML = '<div class="sint-tellen-dagen">🎁</div>' +
        '<div class="sint-tellen-label">Het is zover</div>';
      return;
    }
    var sec = Math.floor(ms / 1000);
    var dagen = Math.floor(sec / 86400);
    var rest = sec % 86400;
    var u = Math.floor(rest / 3600), m = Math.floor((rest % 3600) / 60), s = rest % 60;
    function tw(n) { return (n < 10 ? '0' : '') + n; }
    el.innerHTML =
      '<div class="sint-tellen-dagen">' + dagen + '</div>' +
      '<div class="sint-tellen-label">' + (dagen === 1 ? 'nacht' : 'nachten') + ' slapen</div>' +
      '<div class="sint-tellen-klok">' + tw(u) + ':' + tw(m) + ':' + tw(s) +
      ' tot pakjesavond · zaterdag 5 december</div>';
  }

  // ---------- gegevens uitlezen ----------

  function wensenVan(id) {
    var uit = [];
    for (var k in data.wensen) {
      if (data.wensen[k] && data.wensen[k].voor === id) uit.push(data.wensen[k]);
    }
    uit.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    return uit;
  }
  function tipsVan(id) {
    var uit = [];
    for (var k in data.tips) {
      if (data.tips[k] && data.tips[k].voor === id) uit.push(data.tips[k]);
    }
    uit.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    return uit;
  }
  function claimVan(wensId) { return data.claims[wensId] || null; }

  // ---------- schermen ----------

  function tekenKiezer() {
    var h = '<h1 class="sint-titel">Wie ben jij?</h1>' +
      '<p class="sint-onder">Eén keer kiezen; dit toestel onthoudt het.</p>' +
      '<div class="sint-groep">';
    D.deelnemers.forEach(function (d) {
      h += '<button class="sint-rij" type="button" data-wie="' + esc(d.id) + '">' +
        '<span class="sint-rij-emoji">' + d.emoji + '</span>' +
        '<span class="sint-rij-tekst"><span class="sint-rij-naam">' + esc(d.naam) + '</span></span>' +
        '<span class="sint-rij-pijl">›</span></button>';
    });
    h += '</div>' +
      '<p class="sint-voet">Je kunt dit later altijd wijzigen met de knop rechtsboven.</p>';
    elScherm.innerHTML = h;
    elTerug.classList.add('sint-verborgen');
  }

  function tekenOverzicht() {
    var h = '<h1 class="sint-titel">Sinterklaasfestijn 2026</h1>' +
      '<p class="sint-onder">De Van Dijkjes en de rest</p>' +
      '<div class="sint-tellen" id="sintTellen"></div>' +
      '<div class="sint-kopje">De verlanglijstjes</div><div class="sint-groep">';

    D.deelnemers.forEach(function (d) {
      var aantal = wensenVan(d.id).length;
      var sub;
      if (d.id === mij) {
        sub = aantal === 0 ? 'nog geen wensen — vul je lijstje' :
          aantal + (aantal === 1 ? ' wens' : ' wensen');
      } else {
        var open = wensenVan(d.id).filter(function (w) { return !claimVan(w.id); }).length;
        sub = aantal === 0 ? 'nog geen wensen' :
          aantal + (aantal === 1 ? ' wens' : ' wensen') +
          ' · ' + (open === 0 ? 'alles al gekocht' : open + ' nog vrij');
      }
      h += '<a class="sint-rij" href="#' + esc(d.id) + '">' +
        '<span class="sint-rij-emoji">' + d.emoji + '</span>' +
        '<span class="sint-rij-tekst">' +
          '<span class="sint-rij-naam">' + esc(d.naam) + '</span>' +
          '<span class="sint-rij-sub">' + esc(sub) + '</span>' +
        '</span>' +
        (d.id === mij ? '<span class="sint-badge">jij</span>' : '') +
        '<span class="sint-rij-pijl">›</span></a>';
    });

    h += '</div><p class="sint-voet">Op je eigen lijstje zie je nooit wie wat voor je koopt. ' +
      'Dat blijft een verrassing — op je erewoord, want iedereen deelt dezelfde lijst.</p>';
    elScherm.innerHTML = h;
    elTerug.classList.add('sint-verborgen');
    tekenAftellen();
  }

  function wensHtml(w, eigen) {
    var h = '<div class="sint-wens">' +
      '<div class="sint-wens-top">' +
        '<span class="sint-wens-titel">' + esc(w.titel) + '</span>' +
        (w.prijs ? '<span class="sint-wens-prijs">' + esc(w.prijs) + '</span>' : '') +
      '</div>';
    if (w.toelichting) h += '<div class="sint-wens-toel">' + esc(w.toelichting) + '</div>';
    var link = veiligeLink(w.link);
    if (link) {
      h += '<a class="sint-wens-link" href="' + esc(link) + '" target="_blank" rel="noopener">' +
        esc(link) + '</a>';
    }

    if (eigen) {
      h += '<div class="sint-wens-knoppen">' +
        '<button class="sint-knop" type="button" data-bewerk="' + esc(w.id) + '">Wijzigen</button>' +
        '<button class="sint-knop rood" type="button" data-wis="' + esc(w.id) + '">Verwijderen</button>' +
        '</div>';
    } else {
      var c = claimVan(w.id);
      if (!c) {
        h += '<div class="sint-wens-knoppen">' +
          '<button class="sint-knop vol" type="button" data-koop="' + esc(w.id) + '">Ik koop dit</button>' +
          '</div>';
      } else if (c.koper === mij) {
        h += '<div class="sint-gekocht">✓ jij koopt dit</div>' +
          '<div class="sint-wens-knoppen">' +
          '<button class="sint-knop stil" type="button" data-laat="' + esc(w.id) + '">Toch niet</button>' +
          '</div>';
      } else {
        h += '<div class="sint-gekocht">✓ ' + esc(naamVan(c.koper)) + ' koopt dit</div>';
      }
    }
    return h + '</div>';
  }

  function formulierHtml() {
    var w = bewerkt ? data.wensen[bewerkt] : null;
    return '<div class="sint-kopje">' + (w ? 'Wens wijzigen' : 'Nieuwe wens') + '</div>' +
      '<div class="sint-groep">' +
      '<div class="sint-veld"><label for="fTitel">Wat wil je?</label>' +
        '<input id="fTitel" type="text" autocomplete="off" value="' + esc(w ? w.titel : '') + '"></div>' +
      '<div class="sint-veld"><label for="fPrijs">Ongeveer wat kost het?</label>' +
        '<input id="fPrijs" type="text" autocomplete="off" placeholder="bijv. 25 euro" value="' + esc(w ? w.prijs : '') + '"></div>' +
      '<div class="sint-veld"><label for="fLink">Link</label>' +
        '<input id="fLink" type="url" autocomplete="off" placeholder="https://…" value="' + esc(w ? w.link : '') + '"></div>' +
      '<div class="sint-veld"><label for="fToel">Toelichting</label>' +
        '<textarea id="fToel" rows="2" placeholder="maat, kleur, waarom…">' + esc(w ? w.toelichting : '') + '</textarea></div>' +
      '<div class="sint-formknoppen">' +
        '<button class="sint-knop vol" type="button" id="fBewaar">' + (w ? 'Opslaan' : 'Toevoegen') + '</button>' +
        (w ? '<button class="sint-knop stil" type="button" id="fAnnuleer">Annuleren</button>' : '') +
      '</div><div style="height:12px"></div></div>';
  }

  function tekenPersoon(id) {
    var d = deelnemer(id);
    var eigen = (id === mij);
    var wensen = wensenVan(id);
    var tips = tipsVan(id);

    var h = '<h1 class="sint-titel">' + d.emoji + ' ' + esc(d.naam) + '</h1>';
    h += '<p class="sint-onder">' + (eigen ? 'Jouw verlanglijstje' : 'Verlanglijstje') + '</p>';

    if (eigen) {
      h += '<div class="sint-geheim">Dit is jouw lijstje. Je ziet hier met opzet niet ' +
        'wie wat voor je koopt.</div>';
    }

    h += '<div class="sint-kopje">Wensen</div><div class="sint-groep">';
    if (!wensen.length) {
      h += '<div class="sint-leeg">' +
        (eigen ? 'Nog niets op je lijstje.' : 'Nog geen wensen. Zet er een tip bij.') +
        '</div>';
    } else {
      wensen.forEach(function (w) { h += wensHtml(w, eigen); });
    }
    h += '</div>';

    if (eigen) h += formulierHtml();

    h += '<div class="sint-kopje">Tips</div><div class="sint-groep">';
    if (!tips.length) {
      h += '<div class="sint-leeg">Nog geen tips.</div>';
    } else {
      tips.forEach(function (t) {
        h += '<div class="sint-tip">' +
          '<div class="sint-tip-van">Tip van ' + esc(naamVan(t.door)) + '</div>' +
          '<div class="sint-tip-tekst">' + esc(t.tekst) + '</div>' +
          (t.door === mij ? '<div class="sint-wens-knoppen">' +
            '<button class="sint-knop rood" type="button" data-tipwis="' + esc(t.id) + '">Verwijderen</button>' +
            '</div>' : '') +
          '</div>';
      });
    }
    h += '</div>';

    if (!eigen) {
      h += '<div class="sint-groep" style="margin-top:10px">' +
        '<div class="sint-veld"><label for="fTip">Tip toevoegen</label>' +
          '<input id="fTip" type="text" autocomplete="off" placeholder="bijv. houdt van wandelen"></div>' +
        '<div class="sint-formknoppen">' +
          '<button class="sint-knop vol" type="button" id="fTipBewaar">Tip plaatsen</button>' +
        '</div><div style="height:12px"></div></div>';
    }

    var basis = location.href.split('#')[0];
    h += '<p class="sint-voet">Deellink voor dit lijstje:<br>' + esc(basis + '#' + d.id) + '</p>';

    elScherm.innerHTML = h;
    elTerug.classList.remove('sint-verborgen');
  }

  // ---------- tekenen ----------

  function teken() {
    wachtend = false;
    elIkBen.textContent = mij ? naamVan(mij) : 'Wie ben jij?';
    if (!mij) { tekenKiezer(); return; }
    var hash = (location.hash || '').replace('#', '');
    if (hash && deelnemer(hash)) tekenPersoon(hash);
    else tekenOverzicht();
  }

  // Een wijziging van iemand anders mag het scherm niet opnieuw tekenen
  // terwijl jij in een invulveld staat te typen: je tekst zou verdwijnen.
  // We wachten dan tot je het veld verlaat.
  function typtNu() {
    var a = document.activeElement;
    return !!(a && elScherm.contains(a) &&
      (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'));
  }
  function tekenExtern() {
    if (typtNu()) { wachtend = true; return; }
    teken();
  }
  elScherm.addEventListener('focusout', function () {
    setTimeout(function () { if (wachtend && !typtNu()) teken(); }, 0);
  });

  // ---------- handelingen ----------

  elScherm.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-wie],[data-koop],[data-laat],[data-bewerk],[data-wis],[data-tipwis]') : null;
    if (!el) return;

    if (el.hasAttribute('data-wie')) { zetWie(el.getAttribute('data-wie')); return; }

    if (el.hasAttribute('data-koop')) {
      var kid = el.getAttribute('data-koop');
      if (claimVan(kid)) { teken(); return; }      // iemand was net eerder
      data.claims[kid] = { koper: mij, ts: Date.now() };
      schrijf('claims', kid, data.claims[kid]);
      return;
    }
    if (el.hasAttribute('data-laat')) {
      var lid = el.getAttribute('data-laat');
      var c = claimVan(lid);
      if (!c || c.koper !== mij) { teken(); return; }
      delete data.claims[lid];
      schrijf('claims', lid, null);
      return;
    }
    if (el.hasAttribute('data-bewerk')) { bewerkt = el.getAttribute('data-bewerk'); teken(); return; }
    if (el.hasAttribute('data-wis')) {
      var wid = el.getAttribute('data-wis');
      var w = data.wensen[wid];
      if (!w || w.voor !== mij) return;
      if (!confirm('"' + w.titel + '" van je lijstje halen?')) return;
      delete data.wensen[wid];
      schrijf('wensen', wid, null);
      if (data.claims[wid]) { delete data.claims[wid]; schrijf('claims', wid, null); }
      if (bewerkt === wid) bewerkt = null;
      return;
    }
    if (el.hasAttribute('data-tipwis')) {
      var tid = el.getAttribute('data-tipwis');
      var t = data.tips[tid];
      if (!t || t.door !== mij) return;
      delete data.tips[tid];
      schrijf('tips', tid, null);
      return;
    }
  });

  elScherm.addEventListener('click', function (e) {
    if (e.target.id === 'fBewaar') {
      var titel = document.getElementById('fTitel').value.trim();
      if (!titel) { document.getElementById('fTitel').focus(); return; }
      var id = bewerkt || nieuwId();
      var bestond = data.wensen[id];
      data.wensen[id] = {
        id: id, voor: mij, titel: titel,
        prijs: document.getElementById('fPrijs').value.trim(),
        link: document.getElementById('fLink').value.trim(),
        toelichting: document.getElementById('fToel').value.trim(),
        ts: bestond ? bestond.ts : Date.now()
      };
      bewerkt = null;
      schrijf('wensen', id, data.wensen[id]);
      teken();
      return;
    }
    if (e.target.id === 'fAnnuleer') { bewerkt = null; teken(); return; }
    if (e.target.id === 'fTipBewaar') {
      var veld = document.getElementById('fTip');
      var tekst = veld.value.trim();
      if (!tekst) { veld.focus(); return; }
      var voor = (location.hash || '').replace('#', '');
      if (!deelnemer(voor) || voor === mij) return;
      var tid2 = nieuwId();
      data.tips[tid2] = { id: tid2, voor: voor, door: mij, tekst: tekst, ts: Date.now() };
      schrijf('tips', tid2, data.tips[tid2]);
      teken();
      return;
    }
  });

  elTerug.addEventListener('click', function () { location.hash = ''; });
  elIkBen.addEventListener('click', function () {
    mij = null;
    try { localStorage.removeItem(WIE_SLEUTEL); } catch (e) {}
    teken();
  });
  window.addEventListener('hashchange', function () { bewerkt = null; teken(); });

  // ---------- starten ----------

  laadWie();
  laadLokaal();
  teken();
  startFirebase();
  setInterval(tekenAftellen, 1000);
})();
