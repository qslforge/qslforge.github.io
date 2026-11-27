// QSL verification page. Reads the code from ?c=<code> and asks the public API.
// Uses textContent only (never innerHTML), so API data cannot inject markup.
(function () {
  var status = document.getElementById("status");
  var card = document.getElementById("result");
  var params = new URLSearchParams(window.location.search);
  var code = (params.get("c") || "").toUpperCase();

  if (!/^[A-Z2-7]{12}$/.test(code)) {
    status.textContent = "Geen geldige verificatiecode. / No valid verification code.";
    return;
  }

  var base = (window.QSLFORGE && window.QSLFORGE.API_BASE) || "";
  fetch(base + "/api/public/verify/" + encodeURIComponent(code), { credentials: "omit" })
    .then(function (res) {
      if (res.status === 404) throw new Error("not_found");
      if (res.status === 501) throw new Error("not_yet");
      if (!res.ok) throw new Error("http_" + res.status);
      return res.json();
    })
    .then(function (q) {
      status.textContent = "Deze QSL-kaart is echt. / This QSL card is genuine.";
      var dl = document.createElement("dl");
      [
        ["Call", q.call],
        ["Datum / Date (UTC)", q.date],
        ["Band", q.band],
        ["Mode", q.mode],
        ["Referentie / Reference", q.reference],
      ].forEach(function (row) {
        var dt = document.createElement("dt");
        dt.textContent = row[0];
        var dd = document.createElement("dd");
        dd.textContent = row[1] == null ? "" : String(row[1]);
        dl.appendChild(dt);
        dl.appendChild(dd);
      });
      card.appendChild(dl);
    })
    .catch(function (err) {
      if (err.message === "not_found") {
        status.textContent =
          "Onbekende code: deze kaart komt niet uit QSLforge. / Unknown code: this card was not issued by QSLforge.";
      } else if (err.message === "not_yet") {
        status.textContent = "Verificatie is nog niet actief. / Verification is not active yet.";
      } else {
        status.textContent =
          "Verificatie tijdelijk niet beschikbaar. / Verification temporarily unavailable.";
      }
    });
})();
