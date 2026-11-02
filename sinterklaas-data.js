/* ============================================================
   Sinterklaasfestijn 2026 — deelnemers
   TIJDELIJK. Alles van dit festijn staat in vier losse bestanden:
   sinterklaas.html, sinterklaas.css, sinterklaas.js, sinterklaas-data.js
   plus één regel in index.html. Weghalen = die vijf dingen weg.
   ============================================================ */

window.SINT = {
  // Pakjesavond: zaterdag 5 december 2026, 18:00.
  pakjesavond: new Date(2026, 11, 5, 18, 0, 0),

  // De tak in de gedeelde database. Alles van dit festijn hangt hieronder,
  // zodat het in één keer te verwijderen is.
  pad: 'sinterklaas2026',

  // De sleutel is tevens de deellink: sinterklaas.html#kim
  deelnemers: [
    { id: 'tim',      naam: 'Tim Blikman',        emoji: '🎿' },
    { id: 'gertjan',  naam: 'Gert-Jan Van Dijk',  emoji: '⛷️' },
    { id: 'florine',  naam: 'Florine van Zoest',  emoji: '✨' },
    { id: 'geessien', naam: 'Geessien',           emoji: '🌟' },
    { id: 'janjaap',  naam: 'Jan Jaap van Dijk',  emoji: '🎩' },
    { id: 'jan',      naam: 'Jan Van Dijk',       emoji: '🧭' },
    { id: 'kim',      naam: 'Kim De Jong',        emoji: '🫖' },
    { id: 'koosje',   naam: 'Koosje Van Dijk',    emoji: '🧶' },
    { id: 'pieter',   naam: 'Pieter Van Dijk',    emoji: '🔧' },
    { id: 'sanne',    naam: 'Sanne Slot',         emoji: '🌻' }
  ]
};
