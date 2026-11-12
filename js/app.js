/* College-town home sales dashboard (Part 2).
   Every figure is computed here, in the browser, from data/dashboard_sales.json. */
(() => {
  "use strict";

  // ---------- Rules (stated on the page under "Data notes") ----------
  const PRICE_MIN = 10000;      // below this a "sale" is not a market sale (data sheet, problem 3)
  const PRICE_MAX = 5000000;    // above this values run to $81.5M, not plausible for one home
  const MIN_GROUP = 10;         // groups with fewer sales are shown faded and never chosen as an answer
  const STATE_NAMES = { CA: "California", FL: "Florida", GA: "Georgia", IA: "Iowa", IL: "Illinois", IN: "Indiana",
    MI: "Michigan", NC: "North Carolina", PA: "Pennsylvania", VA: "Virginia", WI: "Wisconsin" };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // ---------- Formatting & statistics ----------
  const fmt$ = v => (v == null || isNaN(v)) ? "—" : (v < 0 ? "−$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");
  const fmtK = v => v >= 1e6 ? "$" + d3.format(".3~")(v / 1e6) + "M" : "$" + d3.format(".3~")(v / 1e3) + "K";
  const fmtN = v => v.toLocaleString("en-US");
  const fmtPct = (v, d = 1) => (v == null || isNaN(v)) ? "—" : (v * 100).toFixed(d) + "%";
  const signPct = v => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1) + "%";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function median(values) {
    if (!values.length) return null;
    const s = Float64Array.from(values).sort();
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const $ = id => document.getElementById(id);

  // ---------- State ----------
  let ROWS = [], VALID = [], CITIES = [], UNIS = [], RANGE = {};
  const sel = { uni: null, city: null };

  // ---------- Load ----------
  Promise.all([
    fetch("data/dashboard_sales.json").then(r => { if (!r.ok) throw new Error("data " + r.status); return r.json(); }),
    fetch("vendor/us-states-10m.json").then(r => { if (!r.ok) throw new Error("map " + r.status); return r.json(); })
  ]).then(([data, us]) => {
    prepare(data);
    initTheme();
    initMap(us);
    initOverview();
    initQuestions();
    renderNotes();
    setSelection(null, null, false);
    let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(renderAllCharts, 200); });
  }).catch(err => {
    $("hero-text").textContent = "The data could not be loaded (" + err.message + "). Reload the page to try again.";
    console.error(err);
  });

  function prepare(data) {
    const c = data.columns;
    UNIS = data.universities.map((name, id) => ({ id, name }));
    CITIES = data.cities.map((d, id) => ({ id, name: d.city, state: d.state, label: d.city + ", " + d.state }));
    for (let i = 0; i < data.rows; i++) {
      const date = c.date[i];
      const r = {
        city: c.city[i], uni: c.uni[i], miles: c.miles[i], date, price: c.price[i], beds: c.beds[i],
        area: c.area[i], built: c.built[i], garage: c.garage[i], basement: c.basement[i], fireplace: c.fireplace[i],
        lat: c.lat[i], lon: c.lon[i],
        year: date ? +date.slice(0, 4) : null, month: date ? +date.slice(5, 7) : null
      };
      r.state = CITIES[r.city].state;
      r.valid = r.price >= PRICE_MIN && r.price <= PRICE_MAX;
      ROWS.push(r);
    }
    VALID = ROWS.filter(r => r.valid);
    const dates = ROWS.map(r => r.date).filter(Boolean).sort();
    RANGE = { min: dates[0], max: dates[dates.length - 1], years: [...new Set(VALID.filter(r => r.year).map(r => r.year))].sort() };
    // City facts: dominant campus, sales, median coordinates (marker position).
    CITIES.forEach(city => {
      const rs = ROWS.filter(r => r.city === city.id);
      const byUni = d3.rollup(rs, v => v.length, r => r.uni);
      city.uni = [...byUni].sort((a, b) => b[1] - a[1])[0][0];
      city.lat = median(rs.map(r => r.lat)); city.lon = median(rs.map(r => r.lon));
      city.n = VALID.filter(r => r.city === city.id).length;
    });
    UNIS.forEach(u => { u.cities = CITIES.filter(c => c.uni === u.id).sort((a, b) => b.n - a.n); });
    const excludedLow = ROWS.filter(r => r.price < PRICE_MIN).length, excludedHigh = ROWS.filter(r => r.price > PRICE_MAX).length;
    RANGE.excludedLow = excludedLow; RANGE.excludedHigh = excludedHigh;
    $("hero-text").textContent = `${fmtN(ROWS.length)} completed home sales in ${CITIES.length} cities around ${UNIS.length} university campuses in ${new Set(CITIES.map(c => c.state)).size} states, closed between ${longDate(RANGE.min)} and ${longDate(RANGE.max)}. The median sale price across all ${fmtN(VALID.length)} sales used is ${fmt$(median(VALID.map(r => r.price)))}.`;
  }
  const longDate = d => new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // ---------- Theme ----------
  function isDark() {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function initTheme() {
    const btn = $("theme-toggle");
    const sync = () => {
      const dark = isDark();
      $("theme-text").textContent = dark ? "Light" : "Dark";
      btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    };
    btn.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) { /* storage blocked: theme still switches */ }
      sync(); drawDots();
    });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { sync(); drawDots(); });
    sync();
  }

  // ---------- Tooltip ----------
  const tip = $("tooltip");
  function showTip(event, html) {
    tip.innerHTML = html; tip.style.opacity = 1;
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = event.clientX + pad, y = event.clientY + pad;
    if (x + w > innerWidth - 8) x = event.clientX - w - pad;
    if (y + h > innerHeight - 8) y = event.clientY - h - pad;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
  }
  const hideTip = () => { tip.style.opacity = 0; };

  // ---------- Generic charts ----------
  const widthOf = el => Math.max(260, el.clientWidth || 600);
  function newSvg(el, W, H, label) {
    return d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", label || "");
  }
  function attachTip(sel, html) {
    sel.on("mousemove", (e, d) => showTip(e, html(d))).on("mouseleave", hideTip);
  }

  // Horizontal ranked bars. items: {label, value, hl, faded, tip}
  function hBar(el, items, o) {
    const W = widthOf(el), rowH = o.rowH || 24, top = 4;
    const labelW = Math.min(132, W * 0.38), right = 74;
    const H = top + items.length * rowH + 24;
    const x = d3.scaleLinear().domain([0, o.max || d3.max(items, d => d.value) || 1]).nice().range([labelW, W - right]);
    const svg = newSvg(el, W, H, o.aria);
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${top + items.length * rowH})`)
      .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((W - labelW - right) / 80))).tickFormat(o.tick || o.fmt).tickSizeOuter(0))
      .call(g => g.selectAll(".tick line").clone().attr("class", "gridline").attr("y2", -items.length * rowH));
    const g = svg.selectAll("g.row").data(items).join("g").attr("transform", (d, i) => `translate(0,${top + i * rowH})`);
    g.append("text").attr("class", d => "cat-label" + (d.hl ? " hl" : "")).attr("x", labelW - 8).attr("y", rowH / 2).attr("dy", "0.35em").attr("text-anchor", "end").text(d => d.label);
    g.append("rect").attr("class", d => "bar" + (d.hl ? " hl" : "") + (d.faded ? " faded" : ""))
      .attr("x", labelW).attr("y", rowH * 0.2).attr("height", rowH * 0.6).attr("rx", 3).attr("width", d => Math.max(0, x(d.value) - labelW));
    g.append("text").attr("class", "bar-label").attr("x", d => x(d.value) + 5).attr("y", rowH / 2).attr("dy", "0.35em").text(d => o.fmt(d.value));
    const hit = g.append("rect").attr("class", "hit" + (o.onClick ? " clickable" : "")).attr("width", W).attr("height", rowH);
    attachTip(hit, d => d.tip);
    if (o.onClick) hit.on("click", (e, d) => o.onClick(d));
  }

  // Horizontal paired bars. groups: {label, a, b, hl, tip}; series: [{name, cls}]
  function pairBar(el, groups, series, o) {
    const W = widthOf(el), rowH = 40, top = 4, labelW = Math.min(132, W * 0.38), right = 74;
    const H = top + groups.length * rowH + 24;
    const x = d3.scaleLinear().domain([0, d3.max(groups, d => Math.max(d.a || 0, d.b || 0)) || 1]).nice().range([labelW, W - right]);
    const svg = newSvg(el, W, H, o.aria);
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${top + groups.length * rowH})`)
      .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((W - labelW - right) / 80))).tickFormat(fmtK).tickSizeOuter(0))
      .call(g => g.selectAll(".tick line").clone().attr("class", "gridline").attr("y2", -groups.length * rowH));
    const g = svg.selectAll("g.row").data(groups).join("g").attr("transform", (d, i) => `translate(0,${top + i * rowH})`);
    g.append("text").attr("class", d => "cat-label" + (d.hl ? " hl" : "")).attr("x", labelW - 8).attr("y", rowH / 2).attr("dy", "0.35em").attr("text-anchor", "end").text(d => d.label);
    ["a", "b"].forEach((k, j) => {
      const y = 6 + j * 15;
      g.filter(d => d[k] != null).append("rect").attr("class", "bar " + series[j].cls).attr("x", labelW).attr("y", y).attr("height", 13).attr("rx", 3)
        .attr("width", d => Math.max(0, x(d[k]) - labelW));
      g.filter(d => d[k] != null).append("text").attr("class", "bar-label").attr("x", d => x(d[k]) + 5).attr("y", y + 6.5).attr("dy", "0.35em").text(d => fmtK(d[k]));
    });
    attachTip(g.append("rect").attr("class", "hit").attr("width", W).attr("height", rowH), d => d.tip);
  }

  // Vertical bars over ordered categories. items: {label, value, hl, faded, tip}
  function vBar(el, items, o) {
    const W = widthOf(el), H = o.height || 260, m = { t: 18, r: 8, b: 34, l: 54 };
    const x = d3.scaleBand().domain(items.map(d => d.label)).range([m.l, W - m.r]).padding(0.22);
    const y = d3.scaleLinear().domain([0, d3.max(items, d => d.value) || 1]).nice().range([H - m.b, m.t]);
    const svg = newSvg(el, W, H, o.aria);
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat(o.tick || o.fmt).tickSizeOuter(0))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone().attr("class", "gridline").attr("x2", W - m.l - m.r));
    const every = Math.ceil(items.length / Math.max(1, Math.floor((W - m.l) / 46)));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).tickSizeOuter(0).tickFormat((d, i) => i % every ? "" : (o.short ? o.short(d) : d)));
    const g = svg.selectAll("g.col").data(items).join("g");
    g.append("rect").attr("class", d => "bar" + (d.hl ? " hl" : "") + (d.faded ? " faded" : ""))
      .attr("x", d => x(d.label)).attr("width", x.bandwidth()).attr("y", d => y(d.value)).attr("height", d => Math.max(0, y(0) - y(d.value))).attr("rx", 3);
    if (x.bandwidth() > 38) g.append("text").attr("class", "bar-label").attr("text-anchor", "middle")
      .attr("x", d => x(d.label) + x.bandwidth() / 2).attr("y", d => y(d.value) - 5).text(d => d.value ? o.fmt(d.value) : "");
    attachTip(g.append("rect").attr("class", "hit").attr("x", d => x(d.label) - x.step() * x.paddingInner() / 2).attr("width", x.step())
      .attr("y", m.t).attr("height", H - m.t - m.b), d => d.tip);
  }

  // Line over ordered periods. pts: {label, value, partial, tip}
  function lineChart(el, pts, o) {
    const W = widthOf(el), H = 270, m = { t: 16, r: 14, b: 34, l: 58 };
    const x = d3.scalePoint().domain(pts.map(d => d.label)).range([m.l + 10, W - m.r - 10]);
    const vals = pts.filter(d => d.value != null).map(d => d.value);
    const y = d3.scaleLinear().domain([d3.min(vals) * 0.92, d3.max(vals) * 1.05]).nice().range([H - m.b, m.t]);
    const svg = newSvg(el, W, H, o.aria);
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(fmtK).tickSizeOuter(0))
      .call(g => g.select(".domain").remove()).call(g => g.selectAll(".tick line").clone().attr("class", "gridline").attr("x2", W - m.l - m.r));
    const every = Math.ceil(pts.length / Math.max(1, Math.floor((W - m.l) / 62)));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).tickSizeOuter(0).tickFormat((d, i) => i % every ? "" : d));
    const line = d3.line().defined(d => d.value != null).x(d => x(d.label)).y(d => y(d.value));
    svg.append("path").attr("class", "line").attr("d", line(pts));
    svg.selectAll("circle.dot").data(pts.filter(d => d.value != null)).join("circle")
      .attr("class", d => "dot" + (d.partial ? " partial" : "")).attr("r", 4.5).attr("cx", d => x(d.label)).attr("cy", d => y(d.value));
    // Crosshair: nearest period under the pointer.
    const cross = svg.append("line").attr("class", "ref-line").attr("y1", m.t).attr("y2", H - m.b).style("opacity", 0);
    svg.append("rect").attr("class", "hit").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b)
      .on("mousemove", e => {
        const [px] = d3.pointer(e);
        const d = pts.reduce((a, b) => Math.abs(x(b.label) - px) < Math.abs(x(a.label) - px) ? b : a);
        cross.attr("x1", x(d.label)).attr("x2", x(d.label)).style("opacity", 1);
        showTip(e, d.tip);
      }).on("mouseleave", () => { cross.style("opacity", 0); hideTip(); });
  }

  // Histogram of prices with a dashed median line.
  function histogram(el, bins, binW, cap, med, aria) {
    const W = widthOf(el), H = 270, m = { t: 22, r: 10, b: 34, l: 52 };
    const x = d3.scaleLinear().domain([0, cap + binW]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.n) || 1]).nice().range([H - m.b, m.t]);
    const svg = newSvg(el, W, H, aria);
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",")).tickSizeOuter(0))
      .call(g => g.select(".domain").remove()).call(g => g.selectAll(".tick line").clone().attr("class", "gridline").attr("x2", W - m.l - m.r));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 90))).tickFormat(v => v > cap ? "" : fmtK(v)).tickSizeOuter(0));
    const g = svg.selectAll("g.bin").data(bins).join("g");
    g.append("rect").attr("class", d => "bar" + (d.over ? " s2" : "")).attr("x", d => x(d.x0) + 1).attr("width", d => Math.max(1, x(d.x1) - x(d.x0) - 2))
      .attr("y", d => y(d.n)).attr("height", d => y(0) - y(d.n)).attr("rx", 2);
    attachTip(g.append("rect").attr("class", "hit").attr("x", d => x(d.x0)).attr("width", d => x(d.x1) - x(d.x0)).attr("y", m.t).attr("height", H - m.t - m.b), d => d.tip);
    if (med != null && med <= cap) {
      svg.append("line").attr("class", "ref-line").attr("x1", x(med)).attr("x2", x(med)).attr("y1", m.t - 6).attr("y2", H - m.b);
      svg.append("text").attr("class", "ref-label").attr("x", x(med) + 4).attr("y", m.t - 8).text("Median " + fmtK(med));
    }
  }

  // Table builder. cols: [{h, r}], rows: [{cells, hl, cls, onClick}]
  function table(id, caption, cols, rows) {
    const t = $(id);
    t.innerHTML = `<caption>${esc(caption)}</caption><thead><tr>${cols.map(c => `<th scope="col"${c.r ? ' class="r"' : ""}>${esc(c.h)}</th>`).join("")}</tr></thead>` +
      `<tbody>${rows.map((row, i) => `<tr data-i="${i}" class="${[row.hl ? "hl" : "", row.onClick ? "clickable" : "", row.cls || ""].join(" ").trim()}">${row.cells.map((v, j) => `<td${cols[j].r ? ' class="r"' : ""}>${v}</td>`).join("")}</tr>`).join("")}</tbody>`;
    rows.forEach((row, i) => { if (row.onClick) t.querySelector(`tr[data-i="${i}"]`).addEventListener("click", row.onClick); });
  }
  const answer = (q, big, say) => { $(q + "-big").innerHTML = big; $(q + "-say").innerHTML = say; };
  const legend = (id, series) => { $(id).innerHTML = series.map(s => `<span><i style="background:var(${s.v})"></i>${esc(s.name)}</span>`).join(""); };

  // ---------- Map ----------
  // Zooming re-projects coordinates (and clips state outlines to the view) instead of scaling an SVG
  // group: browsers stop drawing reliably at the ~300x scale a single town needs.
  const MAP_W = 960, MAP_H = 600;
  let projection, mapSvg, path, statePaths, townSel, labelSel, dotG, curT = d3.zoomIdentity, zoom, dotRows = [];
  function initMap(us) {
    const states = topojson.feature(us, us.objects.states);
    projection = d3.geoAlbersUsa().fitExtent([[10, 10], [MAP_W - 10, MAP_H - 10]], states);
    const zoomStream = d3.geoTransform({ point(x, y) { this.stream.point(curT.applyX(x), curT.applyY(y)); } });
    const clip = d3.geoClipRectangle(-20, -20, MAP_W + 20, MAP_H + 20);
    path = d3.geoPath({ stream: s => projection.stream(zoomStream.stream(clip(s))) });
    mapSvg = d3.select("#map").attr("viewBox", `0 0 ${MAP_W} ${MAP_H}`);
    const dataStates = new Set(CITIES.map(c => STATE_NAMES[c.state]));
    statePaths = mapSvg.append("g").selectAll("path").data(states.features).join("path")
      .attr("class", d => "state" + (dataStates.has(d.properties.name) ? " has-data" : ""));
    statePaths.append("title").text(d => d.properties.name);
    dotG = mapSvg.append("g");
    CITIES.forEach(c => { [c.x, c.y] = projection([c.lon, c.lat]); });
    const order = [...CITIES].sort((a, b) => b.n - a.n); // big markers underneath small ones
    townSel = mapSvg.append("g").selectAll("circle").data(order).join("circle").attr("class", "town")
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", d => `${d.label}: ${fmtN(d.n)} sales. Select this city.`)
      .on("click", (e, d) => setSelection(d.uni, d.id))
      .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelection(d.uni, d.id); } })
      .on("mousemove", (e, d) => showTip(e, `<b>${esc(d.label)}</b><br>${fmtN(d.n)} sales · median ${fmt$(median(VALID.filter(r => r.city === d.id).map(r => r.price)))}<br>${esc(UNIS[d.uni].name)}`))
      .on("mouseleave", hideTip);
    labelSel = mapSvg.append("g").selectAll("text").data(CITIES).join("text").attr("class", "town-label").text(d => d.name);
    zoom = d3.zoom().scaleExtent([1, 600]).translateExtent([[-100, -100], [MAP_W + 100, MAP_H + 100]])
      .filter(e => (e.type !== "wheel" || e.ctrlKey) && !e.button)
      .on("start", () => dotG.style("display", "none"))
      .on("zoom", e => { curT = e.transform; drawGeo(); })
      .on("end", () => { placeDots(); dotG.style("display", null); });
    mapSvg.call(zoom).on("dblclick.zoom", null);
    $("zoom-in").addEventListener("click", () => mapSvg.transition().duration(300).call(zoom.scaleBy, 2));
    $("zoom-out").addEventListener("click", () => mapSvg.transition().duration(300).call(zoom.scaleBy, 0.5));
    $("map-reset").addEventListener("click", () => setSelection(null, null));
    drawGeo();
  }
  function drawGeo() {
    const zoomed = curT.k > 4;
    statePaths.attr("d", path);
    townSel.attr("cx", d => curT.applyX(d.x)).attr("cy", d => curT.applyY(d.y)).attr("r", d => zoomed ? 6 : 2.5 + Math.sqrt(d.n) / 10);
    labelSel.style("display", zoomed ? null : "none").attr("x", d => curT.applyX(d.x) + 9).attr("y", d => curT.applyY(d.y) + 4);
  }
  function placeDots() {
    const r = Math.min(2.4, 0.8 + curT.k / 40);
    dotG.selectAll("circle").attr("cx", d => curT.applyX(d.x)).attr("cy", d => curT.applyY(d.y)).attr("r", r);
  }
  function drawDots() {
    if (!dotG) return;
    const ramp = isDark() ? ["#104281", "#1c5cab", "#3987e5", "#86b6ef", "#cde2fb"] : ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];
    if (!dotRows.length) { dotG.selectAll("circle").remove(); $("map-legend").innerHTML = ""; return; }
    const q = d3.scaleQuantile().domain(dotRows.map(r => r.price)).range(ramp);
    dotG.selectAll("circle").data(dotRows).join("circle").attr("class", "sale-dot").attr("fill", d => q(d.price));
    placeDots();
    const cuts = q.quantiles();
    $("map-legend").innerHTML = `<span class="ramp">Sale price: ` + ramp.map((c, i) =>
      `<i style="background:${c}" title="${i === 0 ? "under " + fmtK(cuts[0]) : i === ramp.length - 1 ? fmtK(cuts[i - 1]) + "+" : fmtK(cuts[i - 1]) + "–" + fmtK(cuts[i])}"></i>`).join("") +
      ` ${fmtK(d3.min(dotRows, r => r.price))} → ${fmtK(d3.max(dotRows, r => r.price))} (fifths)</span>`;
  }
  function zoomToSelection(rows) {
    hideTip();
    if (!rows.length) {
      dotRows = []; drawDots();
      mapSvg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
      return;
    }
    const pts = rows.map(r => { const p = projection([r.lon, r.lat]); return p && { r, x: p[0], y: p[1] }; }).filter(Boolean);
    // Fit the central 96% of sales so a few mislabeled coordinates do not zoom the map out.
    const xs = pts.map(p => p.x).sort((a, b) => a - b), ys = pts.map(p => p.y).sort((a, b) => a - b);
    const x0 = d3.quantileSorted(xs, 0.02), x1 = d3.quantileSorted(xs, 0.98), y0 = d3.quantileSorted(ys, 0.02), y1 = d3.quantileSorted(ys, 0.98);
    const k = Math.min(600, 0.8 / Math.max((x1 - x0) / MAP_W, (y1 - y0) / MAP_H, 1e-4));
    const t = d3.zoomIdentity.translate(MAP_W / 2 - k * (x0 + x1) / 2, MAP_H / 2 - k * (y0 + y1) / 2).scale(k);
    dotRows = pts.map(p => ({ price: p.r.price, x: p.x, y: p.y }));
    drawDots();
    mapSvg.transition().duration(900).call(zoom.transform, t);
  }

  // ---------- Selection (map + dropdowns + dashboard) ----------
  function fillSelectors() {
    const su = $("sel-uni"), sc = $("sel-city");
    su.innerHTML = `<option value="">All 11 campus areas</option>` + UNIS.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("");
    const list = sel.uni == null ? [...CITIES].sort((a, b) => a.label.localeCompare(b.label)) : UNIS[sel.uni].cities;
    sc.innerHTML = `<option value="">${sel.uni == null ? "All 18 cities" : "All cities in this area"}</option>` + list.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join("");
    su.value = sel.uni == null ? "" : sel.uni;
    sc.value = sel.city == null ? "" : sel.city;
  }
  function selectionRows(rows) {
    if (sel.city != null) return rows.filter(r => r.city === sel.city);
    if (sel.uni != null) return rows.filter(r => r.uni === sel.uni);
    return rows;
  }
  function selectionName() {
    if (sel.city != null) return CITIES[sel.city].label;
    if (sel.uni != null) return UNIS[sel.uni].name + " area";
    return "All 18 college towns";
  }
  function setSelection(uni, city, animate = true) {
    sel.uni = uni; sel.city = city;
    fillSelectors();
    const all = selectionRows(ROWS);
    const states = new Set(all.map(r => STATE_NAMES[r.state]));
    statePaths.classed("selected", d => (uni != null || city != null) && states.has(d.properties.name));
    townSel.classed("active", d => d.id === city).classed("dim", d => (city != null && d.id !== city) || (city == null && uni != null && d.uni !== uni));
    if (uni == null && city == null) zoomToSelection([]);
    else zoomToSelection(city != null ? selectionRows(VALID) : VALID.filter(r => r.uni === uni));
    $("map-status").textContent = uni == null && city == null ? "National view · marker size = number of sales · drag to pan, Ctrl + scroll to zoom"
      : `${selectionName()} · each dot is one sale` + ([...states].length ? " · " + [...states].join(", ") : "");
    renderSelectionPanel();
    renderOverview();
    if (!animate) return;
  }
  $("sel-uni").addEventListener("change", e => setSelection(e.target.value === "" ? null : +e.target.value, null));
  $("sel-city").addEventListener("change", e => {
    const v = e.target.value;
    if (v === "") setSelection(sel.uni, null); else setSelection(CITIES[+v].uni, +v);
  });

  function renderSelectionPanel() {
    const rows = selectionRows(VALID), all = selectionRows(ROWS);
    const cities = new Set(rows.map(r => r.city)), states = [...new Set(rows.map(r => r.state))].sort();
    $("sel-kicker").textContent = sel.city != null ? "City" : sel.uni != null ? "Campus area" : "National view";
    $("sel-title").textContent = selectionName();
    $("sel-sub").textContent = sel.city != null ? `Nearest campus: ${UNIS[CITIES[sel.city].uni].name}`
      : `${cities.size} ${cities.size === 1 ? "city" : "cities"} in ${states.map(s => STATE_NAMES[s]).join(", ")}`;
    const ppsf = rows.filter(r => r.area > 0).map(r => r.price / r.area);
    const excluded = all.length - rows.length;
    const kpi = (label, value, foot) => `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="foot">${foot}</div></div>`;
    $("sel-kpis").innerHTML =
      kpi("Sales", fmtN(rows.length), excluded ? `${fmtN(excluded)} implausible price${excluded === 1 ? "" : "s"} left out` : "no prices left out") +
      kpi("Median sale price", fmt$(median(rows.map(r => r.price))), "half sold for more, half for less") +
      kpi("Median price / sq ft", fmt$(median(ppsf)), `${fmtN(ppsf.length)} sales with living area`) +
      kpi("Median miles to campus", median(rows.map(r => r.miles)).toFixed(1), "straight-line distance");
    renderCityChart();
  }
  function renderCityChart() {
    const items = CITIES.map(c => {
      const ps = VALID.filter(r => r.city === c.id).map(r => r.price), med = median(ps);
      const inSel = sel.city != null ? c.id === sel.city : sel.uni != null && c.uni === sel.uni;
      return { id: c.id, uni: c.uni, label: c.label, value: med, hl: inSel, tip: `<b>${esc(c.label)}</b><br>Median ${fmt$(med)}<br>${fmtN(ps.length)} sales` };
    }).sort((a, b) => b.value - a.value);
    hBar($("city-chart"), items, { fmt: fmtK, rowH: 22, aria: "Median sale price for each of the 18 cities", onClick: d => setSelection(d.uni, d.id) });
  }

  // ---------- Basic dashboard: price distribution ----------
  function initOverview() {
    ["ov-bin", "ov-cap"].forEach(id => $(id).addEventListener("change", renderOverview));
    $("ov-reset").addEventListener("click", () => { $("ov-bin").value = "50000"; $("ov-cap").value = "1500000"; renderOverview(); });
  }
  function renderOverview() {
    const rows = selectionRows(VALID), prices = rows.map(r => r.price).sort((a, b) => a - b);
    const binW = +$("ov-bin").value, cap = +$("ov-cap").value, n = prices.length;
    $("ov-lede").textContent = `Distribution of sale prices for ${selectionName()} (change it on the map above).`;
    if (!n) { answer("ov", "No sales", ""); d3.select("#ov-chart").html(""); $("ov-table").innerHTML = ""; return; }
    const bins = [];
    for (let x0 = 0; x0 < cap; x0 += binW) bins.push({ x0, x1: x0 + binW, n: 0 });
    const over = { x0: cap, x1: cap + binW, n: 0, over: true };
    prices.forEach(p => { if (p >= cap) over.n++; else bins[Math.floor(p / binW)].n++; });
    bins.push(over);
    bins.forEach(b => { b.tip = `<b>${b.over ? fmt$(cap) + " and above" : fmt$(b.x0) + " – " + fmt$(b.x1 - 1)}</b><br>${fmtN(b.n)} sales (${fmtPct(b.n / n)})`; });
    const med = median(prices), q1 = d3.quantileSorted(prices, 0.25), q3 = d3.quantileSorted(prices, 0.75);
    const mode = bins.reduce((a, b) => b.n > a.n ? b : a);
    answer("ov", `Median ${fmt$(med)}`, `The middle half of ${fmtN(n)} sales in ${esc(selectionName())} sold between <b>${fmt$(q1)}</b> and <b>${fmt$(q3)}</b>. The most common price band is ${mode.over ? fmt$(cap) + " and above" : fmt$(mode.x0) + "–" + fmt$(mode.x1 - 1)} (${fmtN(mode.n)} sales). ${fmtN(over.n)} sales (${fmtPct(over.n / n)}) were ${fmt$(cap)} or more.`);
    histogram($("ov-chart"), bins, binW, cap, med, `Histogram of sale prices for ${selectionName()}`);
    let cum = 0;
    table("ov-table", `Sales by price band, ${selectionName()}`, [{ h: "Price band" }, { h: "Sales", r: 1 }, { h: "Share", r: 1 }, { h: "Cumulative", r: 1 }],
      bins.map(b => { cum += b.n; return { cells: [b.over ? fmt$(cap) + "+" : `${fmt$(b.x0)}–${fmt$(b.x1 - 1)}`, fmtN(b.n), fmtPct(b.n / n), fmtPct(cum / n)] }; }));
  }

  // ---------- Questions ----------
  const cityOptions = (allLabel) => (allLabel ? `<option value="">${allLabel}</option>` : "") +
    [...CITIES].sort((a, b) => a.label.localeCompare(b.label)).map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join("");
  const segValue = id => $(id).querySelector('[aria-pressed="true"]').dataset.v;
  function setSeg(id, v) { $(id).querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === v))); }
  const num = (id, fallback) => { const v = parseFloat($(id).value); return isNaN(v) ? fallback : v; };
  const largestCity = () => [...CITIES].sort((a, b) => b.n - a.n)[0].id;

  let Q = {};
  function initQuestions() {
    $("q2-uni").innerHTML = UNIS.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("");
    const bedVals = [...new Set(VALID.map(r => r.beds))].sort((a, b) => a - b).filter(b => b <= 6);
    $("q3-beds").innerHTML = bedVals.map(b => `<option value="${b}">${b} bedroom${b === 1 ? "" : "s"}</option>`).join("") + `<option value="7">7 or more</option>`;
    $("q5-city").innerHTML = cityOptions("All 18 cities");
    $("q6-city").innerHTML = cityOptions("All 18 cities");
    $("q7-city").innerHTML = cityOptions("All 18 cities");
    $("q8-city").innerHTML = cityOptions("All 18 cities");
    $("q9-city").innerHTML = cityOptions("All 18 cities");
    $("q9-year").innerHTML = RANGE.years.map(y => `<option>${y}</option>`).join("");

    Q = {
      q1: { defaults: () => { $("q1-min").value = 0; $("q1-max").value = 400000; setSeg("q1-rank", "count"); }, render: renderQ1 },
      q2: { defaults: () => { $("q2-uni").value = UNIS.find(u => /Illinois/.test(u.name)).id; }, render: renderQ2 },
      q3: { defaults: () => { $("q3-beds").value = 3; $("q3-minn").value = 10; }, render: renderQ3 },
      q4: { defaults: () => { $("q4-min").value = 1500; $("q4-minn").value = 10; }, render: renderQ4 },
      q5: { defaults: () => { $("q5-city").value = largestCity(); setSeg("q5-g", "quarter"); }, render: renderQ5 },
      q6: { defaults: () => { $("q6-city").value = ""; $("q6-min").value = PRICE_MIN; $("q6-max").value = PRICE_MAX; }, render: renderQ6 },
      q7: { defaults: () => { $("q7-feat").value = "garage"; $("q7-city").value = ""; }, render: renderQ7 },
      q8: { defaults: () => { $("q8-min").value = 1500; $("q8-max").value = 2500; $("q8-city").value = ""; }, render: renderQ8 },
      q9: { defaults: () => { $("q9-city").value = largestCity(); $("q9-year").value = RANGE.years.includes(2025) ? 2025 : RANGE.years[0]; }, render: renderQ9 }
    };
    Object.entries(Q).forEach(([id, q]) => {
      q.defaults();
      const card = $(id);
      card.querySelectorAll("select").forEach(s => s.addEventListener("change", q.render));
      let t; card.querySelectorAll('input[type="number"]').forEach(inp => inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(q.render, 250); }));
      card.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => { setSeg(b.parentElement.id, b.dataset.v); q.render(); }));
      card.querySelector("[data-reset]").addEventListener("click", () => { q.defaults(); q.render(); });
      q.render();
    });
  }
  function renderAllCharts() { renderCityChart(); renderOverview(); Object.values(Q).forEach(q => q.render()); }
  const byCity = rows => d3.group(rows, r => r.city);
  const cityFilter = id => { const v = $(id).value; return v === "" ? null : +v; };

  // Q1: sales within a budget, by city.
  function renderQ1() {
    let lo = num("q1-min", 0), hi = num("q1-max", PRICE_MAX);
    const swapped = lo > hi; if (swapped) [lo, hi] = [hi, lo];
    const by = byCity(VALID), mode = segValue("q1-rank");
    const items = CITIES.map(c => {
      const rs = by.get(c.id) || [], k = rs.filter(r => r.price >= lo && r.price <= hi).length;
      return { c, k, n: rs.length, share: rs.length ? k / rs.length : 0 };
    }).sort((a, b) => mode === "count" ? b.k - a.k || b.share - a.share : b.share - a.share || b.k - a.k);
    const total = items.reduce((s, d) => s + d.k, 0), top = items[0];
    const range = `${fmt$(lo)} to ${fmt$(hi)}`;
    answer("q1", `${esc(top.c.label)} · ${mode === "count" ? fmtN(top.k) + " sales" : fmtPct(top.share)}`,
      `${total ? `Ranked by ${mode === "count" ? "number of sales" : "share of the city's sales"} priced ${range}: ${esc(top.c.label)} has ${fmtN(top.k)} of its ${fmtN(top.n)} sales (${fmtPct(top.share)}) in the budget. Across all cities, ${fmtN(total)} of ${fmtN(VALID.length)} sales (${fmtPct(total / VALID.length)}) qualify.` : `No sales were priced ${range}.`}${swapped ? " <b>The minimum was above the maximum, so the two were swapped.</b>" : ""}`);
    hBar($("q1-chart"), items.map((d, i) => ({ label: d.c.label, value: mode === "count" ? d.k : d.share, hl: i === 0 && d.k > 0,
      tip: `<b>${esc(d.c.label)}</b><br>${fmtN(d.k)} of ${fmtN(d.n)} sales in budget (${fmtPct(d.share)})` })),
      { fmt: mode === "count" ? fmtN : v => fmtPct(v, 0), tick: mode === "count" ? d3.format(",") : v => fmtPct(v, 0), rowH: 22, aria: `Cities ranked by sales priced ${range}` });
    table("q1-table", `Sales priced ${range}`, [{ h: "#" }, { h: "City" }, { h: "In budget", r: 1 }, { h: "All sales", r: 1 }, { h: "Share", r: 1 }],
      items.map((d, i) => ({ hl: i === 0 && d.k > 0, cells: [i + 1, esc(d.c.label), fmtN(d.k), fmtN(d.n), fmtPct(d.share)] })));
  }

  // Q2: median price by distance band for one campus.
  const BANDS = [[0, 1, "Under 1 mi"], [1, 2, "1–2 mi"], [2, 3, "2–3 mi"], [3, 5, "3–5 mi"], [5, 8, "5–8 mi"], [8, Infinity, "8 mi +"]];
  function renderQ2() {
    const u = +$("q2-uni").value, rows = VALID.filter(r => r.uni === u);
    const items = BANDS.map(([a, b, label]) => {
      const ps = rows.filter(r => r.miles >= a && r.miles < b).map(r => r.price);
      return { label, value: median(ps) || 0, n: ps.length, faded: ps.length < MIN_GROUP };
    });
    const ok = items.filter(d => d.n >= MIN_GROUP);
    const hiB = ok.reduce((a, b) => b.value > a.value ? b : a, ok[0]), loB = ok.reduce((a, b) => b.value < a.value ? b : a, ok[0]);
    items.forEach(d => { d.hl = d === hiB; d.tip = `<b>${d.label}</b><br>Median ${d.n ? fmt$(d.value) : "—"}<br>${fmtN(d.n)} sales${d.faded ? " (too few to compare)" : ""}`; });
    answer("q2", `Highest median: ${hiB.label} · ${fmt$(hiB.value)}`,
      `Around ${esc(UNIS[u].name)} (${fmtN(rows.length)} sales, overall median ${fmt$(median(rows.map(r => r.price)))}), the lowest median is ${loB.label} at ${fmt$(loB.value)}, ${fmt$(hiB.value - loB.value)} below the highest band.`);
    vBar($("q2-chart"), items, { fmt: fmtK, aria: `Median sale price by distance band, ${UNIS[u].name}` });
    table("q2-table", `${UNIS[u].name}: median price by distance`, [{ h: "Distance" }, { h: "Sales", r: 1 }, { h: "Median price", r: 1 }],
      items.map(d => ({ hl: d.hl, cls: d.faded ? "muted" : "", cells: [d.label, fmtN(d.n), d.n ? fmt$(d.value) : "—"] })));
  }

  // Q3: lowest-median city for a bedroom count.
  function renderQ3() {
    const b = +$("q3-beds").value, minN = +$("q3-minn").value;
    const rows = VALID.filter(r => b === 7 ? r.beds >= 7 : r.beds === b), by = byCity(rows);
    const all = CITIES.map(c => { const ps = (by.get(c.id) || []).map(r => r.price); return { c, n: ps.length, med: median(ps) }; });
    const ranked = all.filter(d => d.n >= minN && d.n > 0).sort((a, b) => a.med - b.med);
    const bedLabel = b === 7 ? "7+ bedroom" : `${b}-bedroom`;
    if (!ranked.length) { answer("q3", "Not enough sales", `No city has ${minN} or more ${bedLabel} sales.`); d3.select("#q3-chart").html(""); }
    else {
      const best = ranked[0], next = ranked[1];
      answer("q3", `${esc(best.c.label)} · ${fmt$(best.med)}`,
        `Lowest median price for ${bedLabel} homes, from ${fmtN(best.n)} sales.${next ? ` Next is ${esc(next.c.label)} at ${fmt$(next.med)} (${fmt$(next.med - best.med)} more).` : ""} ${ranked.length} of ${CITIES.length} cities have at least ${minN} such sales.`);
      hBar($("q3-chart"), ranked.map((d, i) => ({ label: d.c.label, value: d.med, hl: i === 0, tip: `<b>${esc(d.c.label)}</b><br>Median ${fmt$(d.med)}<br>${fmtN(d.n)} ${bedLabel} sales` })),
        { fmt: fmtK, rowH: 22, aria: `Median price of ${bedLabel} homes by city, lowest first` });
    }
    const rest = all.filter(d => !ranked.includes(d)).sort((a, b) => b.n - a.n);
    table("q3-table", `${bedLabel} homes, lowest median first`, [{ h: "#" }, { h: "City" }, { h: "Sales", r: 1 }, { h: "Median price", r: 1 }],
      ranked.map((d, i) => ({ hl: i === 0, cells: [i + 1, esc(d.c.label), fmtN(d.n), fmt$(d.med)] }))
        .concat(rest.map(d => ({ cls: "muted", cells: ["–", esc(d.c.label), fmtN(d.n), d.n ? fmt$(d.med) + " (too few)" : "no sales"] }))));
  }

  // Q4: median price per sq ft by city, above a minimum living area.
  function renderQ4() {
    const minA = Math.max(0, num("q4-min", 0)), minN = +$("q4-minn").value;
    const rows = VALID.filter(r => r.area > 0 && r.area >= minA), by = byCity(rows);
    const all = CITIES.map(c => { const v = (by.get(c.id) || []).map(r => r.price / r.area); return { c, n: v.length, med: median(v) }; });
    const ranked = all.filter(d => d.n >= minN && d.n > 0).sort((a, b) => b.med - a.med);
    const lbl = minA > 0 ? `homes of ${fmtN(minA)} sq ft or more` : "all homes with a living area";
    if (!ranked.length) { answer("q4", "Not enough sales", `No city has ${minN} or more ${lbl}.`); d3.select("#q4-chart").html(""); }
    else {
      const top = ranked[0], low = ranked[ranked.length - 1];
      answer("q4", `${esc(top.c.label)} · ${fmt$(top.med)}/sq ft`,
        `Highest median price per square foot for ${lbl} (${fmtN(top.n)} sales). Lowest: ${esc(low.c.label)} at ${fmt$(low.med)}/sq ft, so a square foot costs ${(top.med / low.med).toFixed(1)}× as much in ${esc(top.c.name)}.`);
      hBar($("q4-chart"), ranked.map((d, i) => ({ label: d.c.label, value: d.med, hl: i === 0, tip: `<b>${esc(d.c.label)}</b><br>Median ${fmt$(d.med)} per sq ft<br>${fmtN(d.n)} sales` })),
        { fmt: v => fmt$(v), rowH: 22, aria: `Median price per square foot by city, ${lbl}` });
    }
    table("q4-table", `Median price per sq ft, ${lbl}`, [{ h: "#" }, { h: "City" }, { h: "Sales", r: 1 }, { h: "Median $/sq ft", r: 1 }],
      ranked.map((d, i) => ({ hl: i === 0, cells: [i + 1, esc(d.c.label), fmtN(d.n), fmt$(d.med)] }))
        .concat(all.filter(d => !ranked.includes(d)).map(d => ({ cls: "muted", cells: ["–", esc(d.c.label), fmtN(d.n), d.n ? fmt$(d.med) + " (too few)" : "no sales"] }))));
  }

  // Q5: median price by year or quarter.
  function renderQ5() {
    const city = cityFilter("q5-city"), g = segValue("q5-g");
    const rows = VALID.filter(r => r.year && (city == null || r.city === city));
    const name = city == null ? "all 18 cities" : CITIES[city].label;
    const key = r => g === "year" ? String(r.year) : `${r.year} Q${Math.ceil(r.month / 3)}`;
    const grouped = d3.group(rows, key);
    const periods = [];
    RANGE.years.forEach(y => { if (g === "year") periods.push({ label: String(y), start: `${y}-01-01`, end: `${y}-12-31` });
      else for (let q = 1; q <= 4; q++) periods.push({ label: `${y} Q${q}`, start: `${y}-${String(q * 3 - 2).padStart(2, "0")}-01`, end: `${y}-${String(q * 3).padStart(2, "0")}-${q === 1 || q === 4 ? 31 : 30}` }); });
    const pts = periods.filter(p => p.start <= RANGE.max && p.end >= RANGE.min).map(p => {
      const ps = (grouped.get(p.label) || []).map(r => r.price);
      const partial = p.start < RANGE.min || p.end > RANGE.max;
      return { label: p.label, n: ps.length, value: median(ps), partial };
    });
    pts.forEach(d => { d.tip = `<b>${d.label}</b>${d.partial ? " (partial)" : ""}<br>Median ${fmt$(d.value)}<br>${fmtN(d.n)} sales`; });
    const full = pts.filter(d => !d.partial && d.n >= MIN_GROUP);
    if (full.length >= 2) {
      const a = full[0], b = full[full.length - 1], ch = (b.value - a.value) / a.value;
      const peak = full.reduce((x, y) => y.value > x.value ? y : x);
      answer("q5", `${signPct(ch)} · ${a.label} → ${b.label}`,
        `In ${esc(name)} the median moved from ${fmt$(a.value)} to ${fmt$(b.value)} between the first and last complete ${g}s. The highest complete ${g} was ${peak.label} at ${fmt$(peak.value)}.`);
    } else answer("q5", "Too few sales", `Not enough complete ${g}s with ${MIN_GROUP}+ sales in ${esc(name)} to describe a trend.`);
    lineChart($("q5-chart"), pts, { aria: `Median sale price by ${g}, ${name}` });
    $("q5-note").textContent = `Hollow points are partial periods: the data covers sales closed ${RANGE.min} to ${RANGE.max}. Prices are not adjusted for inflation or for changes in which homes sold.`;
    table("q5-table", `Median sale price by ${g}, ${name}`, [{ h: g === "year" ? "Year" : "Quarter" }, { h: "Sales", r: 1 }, { h: "Median price", r: 1 }],
      pts.map(d => ({ cls: d.partial || d.n < MIN_GROUP ? "muted" : "", cells: [d.label + (d.partial ? " (partial)" : ""), fmtN(d.n), fmt$(d.value)] })));
  }

  // Q6: mean vs median for a city and/or price range.
  function renderQ6() {
    const city = cityFilter("q6-city");
    let lo = num("q6-min", PRICE_MIN), hi = num("q6-max", PRICE_MAX);
    const swapped = lo > hi; if (swapped) [lo, hi] = [hi, lo];
    const inRange = VALID.filter(r => r.price >= lo && r.price <= hi);
    const stat = rs => { const p = rs.map(r => r.price); return { n: p.length, mean: mean(p), med: median(p) }; };
    const scope = stat(city == null ? inRange : inRange.filter(r => r.city === city));
    const name = city == null ? "all 18 cities" : CITIES[city].label, range = `${fmt$(lo)}–${fmt$(hi)}`;
    if (!scope.n) answer("q6", "No sales", `No sales in ${esc(name)} were priced ${range}.`);
    else {
      const gap = scope.mean - scope.med;
      answer("q6", `Mean ${fmt$(scope.mean)} · Median ${fmt$(scope.med)}`,
        `For ${fmtN(scope.n)} sales in ${esc(name)} priced ${range}, the mean is ${fmt$(Math.abs(gap))} (${fmtPct(Math.abs(gap) / scope.med)}) ${gap >= 0 ? "above" : "below"} the median.${swapped ? " <b>Minimum and maximum were swapped.</b>" : ""}`);
    }
    const by = byCity(inRange);
    const rowsC = CITIES.map(c => ({ c, ...stat(by.get(c.id) || []) })).filter(d => d.n > 0).sort((a, b) => (b.mean - b.med) / b.med - (a.mean - a.med) / a.med);
    const groups = [{ label: "All cities", a: stat(inRange).mean, b: stat(inRange).med, hl: city == null }].concat(rowsC.map(d => ({ label: d.c.label, a: d.mean, b: d.med, hl: d.c.id === city })));
    groups.forEach(d => { d.tip = `<b>${esc(d.label)}</b><br>Mean ${fmt$(d.a)}<br>Median ${fmt$(d.b)}<br>Gap ${d.b ? signPct((d.a - d.b) / d.b) : "—"}`; });
    legend("q6-legend", [{ name: "Mean", v: "--series-1" }, { name: "Median", v: "--series-2" }]);
    pairBar($("q6-chart"), groups.filter(d => d.a != null), [{ cls: "" }, { cls: "s2" }], { aria: `Mean and median sale price by city, prices ${range}` });
    const all = stat(inRange);
    table("q6-table", `Mean vs median, prices ${range} (largest gap first)`, [{ h: "City" }, { h: "Sales", r: 1 }, { h: "Mean", r: 1 }, { h: "Median", r: 1 }, { h: "Gap", r: 1 }],
      [{ hl: city == null, cells: ["<b>All cities</b>", fmtN(all.n), fmt$(all.mean), fmt$(all.med), all.n ? signPct((all.mean - all.med) / all.med) : "—"] }]
        .concat(rowsC.map(d => ({ hl: d.c.id === city, cells: [esc(d.c.label), fmtN(d.n), fmt$(d.mean), fmt$(d.med), signPct((d.mean - d.med) / d.med)] }))));
  }

  // Q7: with vs without a feature.
  function renderQ7() {
    const f = $("q7-feat").value, city = cityFilter("q7-city"), fname = { garage: "a garage", basement: "a basement", fireplace: "a fireplace" }[f];
    const split = rs => {
      const w = rs.filter(r => r[f] === 1).map(r => r.price), wo = rs.filter(r => r[f] === 0).map(r => r.price);
      return { w: median(w), wo: median(wo), nw: w.length, nwo: wo.length, nr: rs.filter(r => r[f] == null).length };
    };
    const scopeRows = city == null ? VALID : VALID.filter(r => r.city === city), s = split(scopeRows);
    const name = city == null ? "all 18 cities" : CITIES[city].label;
    if (s.nw >= MIN_GROUP && s.nwo >= MIN_GROUP) {
      const d = s.w - s.wo;
      answer("q7", `${d >= 0 ? "+" : "−"}${fmt$(Math.abs(d)).slice(0)} with ${fname}`,
        `In ${esc(name)}, homes with ${fname} have a median of <b>${fmt$(s.w)}</b> (${fmtN(s.nw)} sales) against <b>${fmt$(s.wo)}</b> without (${fmtN(s.nwo)} sales), a ${signPct(d / s.wo)} difference.`);
    } else answer("q7", "Too few sales to compare", `In ${esc(name)} there are ${fmtN(s.nw)} sales with ${fname} and ${fmtN(s.nwo)} without; each side needs ${MIN_GROUP}.`);
    const by = byCity(VALID);
    const rowsC = CITIES.map(c => ({ c, ...split(by.get(c.id) || []) }));
    const comparable = rowsC.filter(d => d.nw >= MIN_GROUP && d.nwo >= MIN_GROUP).sort((a, b) => (b.w - b.wo) / b.wo - (a.w - a.wo) / a.wo);
    const all = split(VALID);
    const groups = [{ label: "All cities", a: all.w, b: all.wo, hl: city == null, s: all }].concat(comparable.map(d => ({ label: d.c.label, a: d.w, b: d.wo, hl: d.c.id === city, s: d })));
    groups.forEach(d => { d.tip = `<b>${esc(d.label)}</b><br>With: ${fmt$(d.a)} (${fmtN(d.s.nw)})<br>Without: ${fmt$(d.b)} (${fmtN(d.s.nwo)})`; });
    legend("q7-legend", [{ name: "With " + f, v: "--series-1" }, { name: "Without " + f, v: "--series-2" }]);
    pairBar($("q7-chart"), groups, [{ cls: "" }, { cls: "s2" }], { aria: `Median sale price with and without ${fname}, by city` });
    const cell = d => [fmt$(d.w), fmtN(d.nw), fmt$(d.wo), fmtN(d.nwo), d.w != null && d.wo != null ? signPct((d.w - d.wo) / d.wo) : "—", fmtN(d.nr)];
    table("q7-table", `Median price with vs without ${fname} (largest difference first)`,
      [{ h: "City" }, { h: "With", r: 1 }, { h: "n", r: 1 }, { h: "Without", r: 1 }, { h: "n", r: 1 }, { h: "Diff.", r: 1 }, { h: "Not reported", r: 1 }],
      [{ hl: city == null, cells: ["<b>All cities</b>", ...cell(all)] }]
        .concat(comparable.map(d => ({ hl: d.c.id === city, cells: [esc(d.c.label), ...cell(d)] })))
        .concat(rowsC.filter(d => !comparable.includes(d)).map(d => ({ hl: d.c.id === city, cls: "muted", cells: [esc(d.c.label) + " (too few)", ...cell(d)] }))));
    $("q7-note").textContent = `"Not reported" sales (blank ${f} field) are left out of both groups. Cities need ${MIN_GROUP}+ sales on each side to be charted. A difference is not proof the feature causes it: homes with ${fname} also tend to differ in size, age and location.`;
  }

  // Q8: median price by construction-year group within a living-area range.
  const ERAS = [[0, 1939, "Before 1940"], [1940, 1959, "1940–59"], [1960, 1979, "1960–79"], [1980, 1999, "1980–99"], [2000, 2009, "2000–09"], [2010, 2019, "2010–19"], [2020, 9999, "2020 +"]];
  function renderQ8() {
    let lo = Math.max(1, num("q8-min", 1)), hi = num("q8-max", 1e9);
    const swapped = lo > hi; if (swapped) [lo, hi] = [hi, lo];
    const city = cityFilter("q8-city"), name = city == null ? "all 18 cities" : CITIES[city].label;
    const rows = VALID.filter(r => r.area >= lo && r.area <= hi && r.built != null && (city == null || r.city === city));
    const items = ERAS.map(([a, b, label]) => {
      const rs = rows.filter(r => r.built >= a && r.built <= b);
      return { label, n: rs.length, value: median(rs.map(r => r.price)) || 0, area: median(rs.map(r => r.area)), faded: rs.length < MIN_GROUP };
    });
    const ok = items.filter(d => !d.faded), range = `${fmtN(lo)}–${fmtN(hi)} sq ft`;
    if (ok.length) {
      const hiE = ok.reduce((a, b) => b.value > a.value ? b : a), loE = ok.reduce((a, b) => b.value < a.value ? b : a);
      hiE.hl = true;
      answer("q8", `${hiE.label} · ${fmt$(hiE.value)}`,
        `Among ${fmtN(rows.length)} homes of ${range} in ${esc(name)}, those built ${hiE.label === "2020 +" ? "in 2020 or later" : hiE.label} have the highest median. The lowest is ${loE.label} at ${fmt$(loE.value)} (${fmt$(hiE.value - loE.value)} less).${swapped ? " <b>The range limits were swapped.</b>" : ""}`);
    } else answer("q8", "Too few sales", `No construction-year group has ${MIN_GROUP}+ homes of ${range} in ${esc(name)}.`);
    items.forEach(d => { d.tip = `<b>Built ${d.label}</b><br>Median ${d.n ? fmt$(d.value) : "—"}<br>${fmtN(d.n)} sales${d.n ? " · median " + fmtN(Math.round(d.area)) + " sq ft" : ""}`; });
    vBar($("q8-chart"), items, { fmt: fmtK, aria: `Median price by construction-year group, ${range}, ${name}` });
    table("q8-table", `Homes of ${range}, ${name}`, [{ h: "Built" }, { h: "Sales", r: 1 }, { h: "Median price", r: 1 }, { h: "Median sq ft", r: 1 }],
      items.map(d => ({ hl: d.hl, cls: d.faded ? "muted" : "", cells: [d.label, fmtN(d.n), d.n ? fmt$(d.value) : "—", d.n ? fmtN(Math.round(d.area)) : "—"] })));
  }

  // Q9: busiest sales month for a city and year.
  function renderQ9() {
    const city = cityFilter("q9-city"), year = +$("q9-year").value, name = city == null ? "all 18 cities" : CITIES[city].label;
    const rows = VALID.filter(r => r.year === year && (city == null || r.city === city));
    const counts = d3.rollup(rows, v => v.length, r => r.month);
    const ym = m => `${year}-${String(m).padStart(2, "0")}`;
    const items = MONTHS.map((mName, i) => {
      const m = i + 1, covered = ym(m) >= RANGE.min.slice(0, 7) && ym(m) <= RANGE.max.slice(0, 7);
      const partial = covered && (ym(m) === RANGE.min.slice(0, 7) || ym(m) === RANGE.max.slice(0, 7));
      return { label: mName.slice(0, 3), full: mName, value: counts.get(m) || 0, covered, partial };
    });
    const max = d3.max(items, d => d.value);
    const best = items.filter(d => d.value === max && max > 0);
    items.forEach(d => { d.hl = best.includes(d); d.faded = !d.covered; d.tip = `<b>${d.full} ${year}</b><br>${d.covered ? fmtN(d.value) + " sales" + (d.partial ? " (partial month)" : "") : "Outside the collection window"}`; });
    if (best.length) answer("q9", `${best.map(d => d.full).join(" & ")} · ${fmtN(max)} sales`,
      `${best.length > 1 ? "Tied busiest months" : "Busiest month"} for ${esc(name)} in ${year}, ${fmtPct(max / rows.length)} of the year's ${fmtN(rows.length)} closed sales.`);
    else answer("q9", "No sales", `No sales closed in ${esc(name)} in ${year}.`);
    vBar($("q9-chart"), items, { fmt: fmtN, tick: d3.format(","), aria: `Sales by month, ${name}, ${year}` });
    const uncovered = items.filter(d => !d.covered).length;
    $("q9-note").textContent = `Months are by closing date (sale_date). ${uncovered ? `${uncovered} month${uncovered > 1 ? "s" : ""} of ${year} fall outside the data (sales closed ${RANGE.min} to ${RANGE.max}), so ${year} is a partial year. ` : ""}`;
    table("q9-table", `Sales by month, ${name}, ${year}`, [{ h: "Month" }, { h: "Sales", r: 1 }, { h: "Share of year", r: 1 }],
      items.map(d => ({ hl: d.hl, cls: d.covered ? "" : "muted", cells: [d.full + (d.partial ? " (partial)" : d.covered ? "" : " (no data)"), d.covered ? fmtN(d.value) : "—", d.covered && rows.length ? fmtPct(d.value / rows.length) : "—"] })));
  }

  // ---------- Notes ----------
  function renderNotes() {
    const noDate = VALID.filter(r => !r.date).length, noArea = VALID.filter(r => !(r.area > 0)).length;
    $("notes-rule").innerHTML = [
      `All figures use the <b>${fmtN(VALID.length)}</b> of ${fmtN(ROWS.length)} sales priced from ${fmt$(PRICE_MIN)} to ${fmt$(PRICE_MAX)}.`,
      `Left out: ${fmtN(RANGE.excludedLow)} sales under ${fmt$(PRICE_MIN)} (down to $0) and ${fmtN(RANGE.excludedHigh)} over ${fmt$(PRICE_MAX)} (up to ${fmt$(d3.max(ROWS, r => r.price))}). The data description flags both as implausible; they would distort means.`,
      `Price per sq ft and living-area filters skip ${fmtN(noArea)} sales with a blank or 0 sq ft living area.`,
      `${fmtN(noDate)} sale${noDate === 1 ? " has" : "s have"} no sale date and ${noDate === 1 ? "is" : "are"} left out of the time questions.`,
      `Groups with fewer than ${MIN_GROUP} sales are shown faded and never picked as an answer.`
    ].map(s => `<li>${s}</li>`).join("");
    $("notes-dates").textContent = `${longDate(RANGE.min)} and ${longDate(RANGE.max)}`;
  }
})();
