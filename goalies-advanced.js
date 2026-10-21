/* Goalie Analyst, part two: the goals heat map and the Natural Stat Trick visualizers on goalies.html.
   Loaded after the page's main script, so it reuses its helpers ($, esc, store, state, showTip, hideTip, nice,
   chartW, fmtSv, mono, byId, openGoalie, TEAMS, color, last) and the zone map's colour tokens (zPalette, seqFill, divFill, lum).
   Goals heat map: goal-map-data.js, rebuilt each morning by build_goal_map.py from the NHL play-by-play feed.
   Advanced stats: data/nst/*.csv, saved each morning by fetch_nst.py. Data courtesy of Natural Stat Trick. */

const NHL_BY_NAME = new Map(DATA.goalies.map(g=>[normName(g.name), g.id]));
function normName(n){ return String(n||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z]/g,""); }
const signed = (v,d=1) => v==null||isNaN(v) ? "–" : (v>0?"+":v<0?"−":"±")+Math.abs(v).toFixed(d);
const pct = v => (100*v).toFixed(0)+"%";
const segBtns = (opts, cur) => opts.map(([k,t])=>`<button type="button" data-v="${k}" aria-pressed="${k===cur}">${t}</button>`).join("");
const kv = (v,l,c="") => `<div class="kv"><b class="num ${c}">${v}</b><span>${l}</span></div>`;

/* ======================= goals heat map ======================= */
const GM = window.GOAL_MAP;
// Map geometry matches the zone map above: x across the ice (0-85), y down from the end boards, goal line y=11, blue line y=75.
const GM_RINK = `M0 75 V28 A28 28 0 0 1 28 0 H57 A28 28 0 0 1 85 28 V75 Z`;
const GM_VIEWS = [["goals","Goals"],["shots","Shots"],["sv","Save %"]];
const GM_STR = [["all","All"],["0","5v5"],["1","Power play against"],["2","Short-handed"]];
const GM_SIZE = {goals:3.2, shots:3.2, sv:4.6};   // hex radius in feet
const GM_MIN = {goalie:6, league:25};             // fewest shots in a hex to colour it by save %
const SHOT_NAMES = {wrist:"Wrist",snap:"Snap",slap:"Slap",backhand:"Backhand","tip-in":"Tip-in",deflected:"Deflection","wrap-around":"Wrap-around",poke:"Poke",bat:"Batted","between-legs":"Between the legs",cradle:"Lacrosse"};
const gm = {
  id: store.get("gm:goalie",""), view: store.get("gm:view","goals"), str: store.get("gm:str","all"),
  dots: store.get("gm:dots", true), hidden: store.get("gm:hidden", false), on: null
};
if(!GM_VIEWS.some(v=>v[0]===gm.view)) gm.view="goals";
if(!GM_STR.some(v=>v[0]===gm.str)) gm.str="all";

// x,y in feet (feed coordinates, goal at x=89, positive y on the left as drawn) to map units
const gmX = y => 42.5 - y, gmY = x => 100 - x;
const gmDist = s => Math.hypot(89 - s[1], s[2]);
// Same regions as the zone map (build_zone_data.py zone_of), so the two tables line up.
function gmZone(x, y){
  if(x>89) return "behind";
  if(x<25) return "long";
  if(x>=69){ if(Math.abs(y)<=8) return x>=80?"crease":"lowslot"; return y>0?"lowL":"lowR"; }
  if(x>=54){ if(Math.abs(y)<=10) return "highslot"; return y>0?"circL":"circR"; }
  return y>15?"pointL":y<-15?"pointR":"pointC";
}
if(GM) GM.shots.forEach((s,i)=>{ s.i=i; });
const gmGoalie = () => gm.id==="" ? null : GM.goalies.find(g=>String(g[0])===gm.id) || null;
function gmShots(goalieOnly){
  const gi = goalieOnly ? GM.goalies.findIndex(g=>String(g[0])===gm.id) : -1;
  return GM.shots.filter(s=>(gi<0 || s[0]===gi) && (gm.str==="all" || s[4]===+gm.str));
}
function hexBins(shots, r){
  const bins=new Map(), s3=Math.sqrt(3);
  for(const s of shots){
    if(s[1]<25) continue; // outside the zone: counted in the table, not drawn
    const X=gmX(s[2]), Y=gmY(s[1]);
    let q=(s3/3*X - Y/3)/r, rr=(2/3*Y)/r, cx=-q-rr;
    let Q=Math.round(q), R=Math.round(rr), C=Math.round(cx);
    const dq=Math.abs(Q-q), dr=Math.abs(R-rr), dc=Math.abs(C-cx);
    if(dq>dr && dq>dc) Q=-R-C; else if(dr>dc) R=-Q-C;
    const k=Q+","+R; let b=bins.get(k);
    if(!b){ b={q:Q,r:R,x:r*s3*(Q+R/2),y:r*1.5*R,n:0,g:0,k}; bins.set(k,b); }
    b.n++; b.g+=s[3];
  }
  return bins;
}
const hexPts = (x,y,r) => [...Array(6)].map((_,i)=>{ const a=Math.PI/180*(60*i-30); return (x+r*Math.cos(a)).toFixed(2)+","+(y+r*Math.sin(a)).toFixed(2); }).join(" ");

function gmCells(){
  const g=gmGoalie(), shots=gmShots(!!g), r=GM_SIZE[gm.view];
  const bins=hexBins(shots, r);
  let lg=null;
  if(gm.view==="sv"){ lg=hexBins(gmShots(false), r); }
  const list=[...bins.values()];
  const maxN=Math.max(1,...list.map(b=>gm.view==="goals"?b.g:b.n));
  const minN = g ? GM_MIN.goalie : GM_MIN.league;
  for(const b of list){
    b.sv = b.n ? 1-b.g/b.n : null;
    if(gm.view==="sv"){
      const L=lg.get(b.k); b.lsv = L&&L.n ? 1-L.g/L.n : null;
      b.thin = b.n<minN;
      b.d = g && b.lsv!=null ? b.sv-b.lsv : null;
      b.fill = b.thin ? "url(#gmHatch)" : g ? divFill(b.d) : seqFill(b.sv);
    } else {
      const v = gm.view==="goals" ? b.g : b.n;
      b.fill = v ? mix(ZSEQ[0], ZSEQ[1], Math.min(1, .18 + .82*Math.sqrt(v/maxN))) : null;
    }
  }
  return {g, shots, list, r, maxN};
}
function gmMap(c){
  let s=`<svg viewBox="-1 -1 87 92" role="img" aria-label="Heat map of ${gm.view==="goals"?"goals against":gm.view==="shots"?"shots on goal":"save percentage"} by location, goal at the top"><defs>
    <clipPath id="gmClip"><path d="${GM_RINK}"/></clipPath>
    <pattern id="gmHatch" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.4" height="2.4" fill="${ZC.none}"/><line x1="0" y1="0" x2="0" y2="2.4" stroke="${ZC.hatch}" stroke-width="1"/></pattern></defs>
    <path d="${GM_RINK}" fill="var(--ice)"/><g clip-path="url(#gmClip)">`;
  s += c.list.filter(b=>b.fill).map(b=>`<polygon class="hx${gm.on===b.k?" on":""}" data-hx="${b.k}" points="${hexPts(b.x,b.y,c.r*.97)}" fill="${b.fill}"/>`).join("");
  s += `</g><g class="mk"><path d="${GM_RINK}"/><line x1="0" y1="11" x2="85" y2="11" clip-path="url(#gmClip)"/>
    <path d="M36.5 11 A6 6 0 0 0 48.5 11"/><rect x="39.5" y="7.7" width="6" height="3.3"/>
    <circle cx="20.5" cy="31" r="15"/><circle cx="64.5" cy="31" r="15"/></g>
    <line x1="0" y1="75" x2="85" y2="75" stroke="var(--crease)" stroke-opacity=".7" stroke-width="1.2"/>`;
  if(gm.dots && gm.view!=="sv"){
    const goals=c.shots.filter(s=>s[3] && s[1]>=25);
    const big = goals.length<=250;
    s += `<g class="gdots">` + goals.map(s=>`<circle class="gd" data-gi="${s.i}" cx="${gmX(s[2]).toFixed(1)}" cy="${gmY(s[1]).toFixed(1)}" r="${big?1:.6}"/>`).join("") + `</g>`;
  }
  const long=c.shots.filter(s=>s[1]<25), lg=long.reduce((a,s)=>a+s[3],0);
  s += `<text x="42.5" y="83" font-size="3" fill="var(--fog)">${long.length} shots from outside the zone · ${lg} goal${lg===1?"":"s"}</text>`;
  return s+`</svg>`;
}
function gmLegend(c){
  if(gm.view==="sv"){
    $("#gmLegend").innerHTML = c.g
      ? `<div class="ramp" style="background:linear-gradient(90deg,${ZDIV.bad},${ZDIV.mid},${ZDIV.good})"></div><div class="ends"><span>${zPlus(-ZDIV_MAX)} worse</span><span>League save % from the same spot</span><span>better ${zPlus(ZDIV_MAX)}</span></div><span>Hatched spots have fewer than ${GM_MIN.goalie} shots, too few to judge.</span>`
      : `<div class="ramp" style="background:linear-gradient(90deg,${ZSEQ[1]},${ZSEQ[0]})"></div><div class="ends"><span>${fmtSv(ZSEQ_LO)} or lower</span><span>Stronger colour means more pucks get through</span><span>1.000</span></div><span>Hatched spots have fewer than ${GM_MIN.league} shots.</span>`;
    return;
  }
  const what = gm.view==="goals" ? "goals" : "shots";
  $("#gmLegend").innerHTML = `<div class="ramp" style="background:linear-gradient(90deg,${mix(ZSEQ[0],ZSEQ[1],.18)},${ZSEQ[1]})"></div><div class="ends"><span>1 ${what.slice(0,-1)}</span><span>Each hexagon is about ${Math.round(GM_SIZE[gm.view]*1.73)} ft across</span><span>${c.maxN} ${what}</span></div>${gm.dots&&gm.view!=="sv"?`<span><svg width="10" height="10" style="vertical-align:-1px;margin-right:6px"><circle cx="5" cy="5" r="3.5" class="gd"/></svg>Each dot is one goal, placed where the shot was taken. Hover for who scored.</span>`:""}`;
}
function gmStats(c){
  const n=c.shots.length, gl=c.shots.filter(s=>s[3]), sv=n?1-gl.length/n:null;
  const near=gl.filter(s=>gmDist(s)<=20).length, avg=gl.length?gl.reduce((a,s)=>a+gmDist(s),0)/gl.length:null;
  const lgAll=gmShots(false), lgG=lgAll.filter(s=>s[3]), lgSv=lgAll.length?1-lgG.length/lgAll.length:null;
  const nhl = c.g && byId.has(c.g[0]);
  $("#gmStats").innerHTML = (c.g?`<div class="who">${mono({name:c.g[1],team:c.g[2]})}<div><b>${esc(c.g[1])}</b><small>${esc(TEAMS[c.g[2]]?.[0]||c.g[2])}${nhl?` · <a href="#" data-open="${c.g[0]}">Profile</a>`:""}</small></div></div>`:"")
    + kv(n.toLocaleString(),"Shots on goal") + kv(gl.length,"Goals against")
    + kv(fmtSv(sv),"Save %", c.g&&sv!=null&&lgSv!=null ? (sv>lgSv?"good":sv<lgSv?"bad":"") : "")
    + kv(gl.length?pct(near/gl.length):"–","Goals from 20 ft or closer") + kv(avg==null?"–":avg.toFixed(0)+" ft","Average goal distance");
}
function gmTable(c){
  const rows=ZD.zones.map(z=>({...z,n:0,g:0}));
  const at=Object.fromEntries(rows.map(r=>[r.id,r]));
  c.shots.forEach(s=>{ const r=at[gmZone(s[1],s[2])]; r.n++; r.g+=s[3]; });
  const G=Math.max(1,rows.reduce((a,r)=>a+r.g,0));
  const order=[...rows].sort((a,b)=>b.g-a.g||b.n-a.n);
  $("#gmTbl thead").innerHTML=`<tr><th class="l">Area</th><th>Goals</th><th>Share of goals</th><th>Shots</th><th>SV%</th></tr>`;
  $("#gmTbl tbody").innerHTML=order.map(r=>`<tr><td class="l">${esc(r.name)}</td><td class="num">${r.g}</td><td class="num"><span class="bar"><i style="width:${Math.round(60*r.g/G)}px"></i>${pct(r.g/G)}</span></td><td class="num">${r.n}</td><td class="num">${r.n?fmtSv(1-r.g/r.n):"–"}</td></tr>`).join("");
  const types={}; c.shots.forEach(s=>{ if(s[3]){ const t=GM.shotTypes[s[5]]||"other"; types[t]=(types[t]||0)+1; } });
  const tl=Object.entries(types).sort((a,b)=>b[1]-a[1]), tmax=Math.max(1,...tl.map(t=>t[1]));
  $("#gmTypes").innerHTML = tl.length ? tl.map(([t,v])=>`<div class="tyrow"><span>${esc(SHOT_NAMES[t]||"Other")}</span><i style="width:${(100*v/tmax).toFixed(0)}%"></i><b class="num">${v}</b></div>`).join("") : `<div class="note">No goals with these filters.</div>`;
}
let gmLast=null;
function renderGoalMap(){
  if(!GM || !GM.shots.length){ $("#gmSec").hidden=true; return; }
  zPalette();
  const c=gmLast=gmCells(), map=state.gfx && !gm.hidden;
  $("#gmNote").textContent = `${GM.season} regular season, ${GM.from} to ${GM.to} · ${GM.games} games · NHL play-by-play, updated each morning. Empty nets and shootouts left out.`;
  $("#gmView").innerHTML = segBtns(GM_VIEWS, gm.view);
  $("#gmStr").innerHTML = segBtns(GM_STR, gm.str);
  $("#gmDots").checked = gm.dots; $("#gmDotsLbl").hidden = gm.view==="sv" || !map;
  $("#gmMapWrap").hidden=!map; $("#gmGrid").classList.toggle("nomap",!map);
  $("#gmHide").hidden=!state.gfx; $("#gmHide").textContent = gm.hidden?"Show map":"Hide map";
  if(map){ $("#c-goalmap").innerHTML=gmMap(c); gmLegend(c); }
  gmStats(c); gmTable(c);
}
if(GM && GM.shots.length){
  const counts=new Map(); GM.shots.forEach(s=>counts.set(s[0],(counts.get(s[0])||0)+1));
  $("#gmGoalie").innerHTML += [...GM.goalies.entries()].filter(([i])=>counts.get(i)).sort((a,b)=>a[1][1].split(" ").slice(-1)[0].localeCompare(b[1][1].split(" ").slice(-1)[0]))
    .map(([i,g])=>`<option value="${g[0]}">${esc(g[1])} · ${esc(g[2])} (${counts.get(i)} shots)</option>`).join("");
  if(!gmGoalie()) gm.id="";
  $("#gmGoalie").value=gm.id;
}
$("#gmGoalie").addEventListener("change",e=>{ gm.id=e.target.value; store.set("gm:goalie",gm.id); renderGoalMap(); });
$("#gmView").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; gm.view=b.dataset.v; store.set("gm:view",gm.view); renderGoalMap(); });
$("#gmStr").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; gm.str=b.dataset.v; store.set("gm:str",gm.str); renderGoalMap(); });
$("#gmDots").addEventListener("change",e=>{ gm.dots=e.target.checked; store.set("gm:dots",gm.dots); renderGoalMap(); });
$("#gmHide").addEventListener("click",()=>{ gm.hidden=!gm.hidden; store.set("gm:hidden",gm.hidden); renderGoalMap(); });
$("#gmSec").addEventListener("click",e=>{ const a=e.target.closest("[data-open]"); if(a){ e.preventDefault(); openGoalie(+a.dataset.open); } });
$("#gmSec").addEventListener("mousemove",e=>{
  const d=e.target.closest("[data-gi]"), h=e.target.closest("[data-hx]");
  if(d){
    const s=GM.shots[+d.dataset.gi], g=GM.goalies[s[0]];
    return showTip(e,`<b>${esc(GM.shooters[s[6]]||"Goal")}</b>${esc(GM.dates[s[7]]||"")} · ${s[8]>3?"OT":"Period "+s[8]} · ${esc(s[9])}<br>${esc(SHOT_NAMES[GM.shotTypes[s[5]]]||"Shot")} from ${gmDist(s).toFixed(0)} ft · ${esc(GM.strengths[s[4]]||"")}<br>On ${esc(g[1])}`);
  }
  if(h){
    const b=gmLast?.list.find(b=>b.k===h.dataset.hx); if(!b) return hideTip();
    return showTip(e,`<b>${b.g} goal${b.g===1?"":"s"} on ${b.n} shot${b.n===1?"":"s"}</b>Save % ${fmtSv(b.sv)}${gm.view==="sv"&&b.lsv!=null?`<br>League here ${fmtSv(b.lsv)}${b.d!=null&&!b.thin?` · ${zPlus(b.d)}`:""}`:""}${b.thin?"<br>Too few shots to judge":""}`);
  }
  hideTip();
});
$("#gmSec").addEventListener("mouseleave",hideTip);
$("#gfx").addEventListener("change",renderGoalMap);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",renderGoalMap);
renderGoalMap();

/* ======================= Natural Stat Trick ======================= */
const NST_DIR = "data/nst/";
const NST_STR = [["all","All situations"],["5v5","5v5"]];
// Rank-by options: value from a row, how to show it, whether higher is better, and whether it is centred on zero.
const NST_METRICS = [
  {k:"gsaa", t:"Goals saved above average", s:"GSAA", v:r=>r.gsaa, f:v=>signed(v,2), hi:true, zero:true},
  {k:"gsax", t:"Goals saved above expected", s:"GSAx", v:r=>r.xga-r.ga, f:v=>signed(v,2), hi:true, zero:true},
  {k:"svp", t:"Save %", s:"SV%", v:r=>r.svp, f:fmtSv, hi:true},
  {k:"hdsv", t:"High-danger save %", s:"HDSV%", v:r=>r.hdsv, f:fmtSv, hi:true},
  {k:"hdgsaa", t:"High-danger goals saved above average", s:"HDGSAA", v:r=>r.hdgsaa, f:v=>signed(v,2), hi:true, zero:true},
  {k:"mdsv", t:"Medium-danger save %", s:"MDSV%", v:r=>r.mdsv, f:fmtSv, hi:true},
  {k:"ldsv", t:"Low-danger save %", s:"LDSV%", v:r=>r.ldsv, f:fmtSv, hi:true},
  {k:"gaa", t:"Goals-against average", s:"GAA", v:r=>r.gaa, f:v=>v==null?"–":v.toFixed(2), hi:false},
  {k:"reb", t:"Rebound attempts against per 60", s:"Reb/60", v:r=>r.toi?r.reb*60/r.toi:null, f:v=>v==null?"–":v.toFixed(2), hi:false},
];
const DANGER = [
  {k:"hd", t:"High danger", s:"HD"}, {k:"md", t:"Medium danger", s:"MD"}, {k:"ld", t:"Low danger", s:"LD"}
];
// Approximate areas, drawn on the same rink as the maps above. NST assigns each shot to a level using its own zone map.
const DANGER_SHAPE = {
  hd: `M33 11 H52 V37 H33 Z`,
  md: `M20.5 11 H64.5 V46 H53 V58 H32 V46 H20.5 Z`,
};
const NST_COLS = [
  {k:"name",t:"Goaltender",l:true},{k:"team",t:"Team",l:true},{k:"gp",t:"GP"},{k:"toi",t:"TOI",f:v=>Math.round(v)},
  {k:"sa",t:"SA"},{k:"ga",t:"GA"},{k:"svp",t:"SV%",f:fmtSv},{k:"gaa",t:"GAA",f:v=>v.toFixed(2)},
  {k:"gsaa",t:"GSAA",f:v=>signed(v,2),c:true},{k:"xga",t:"xGA",f:v=>v.toFixed(2)},{k:"gsax",t:"GSAx",f:v=>signed(v,2),c:true},
  {k:"hdsa",t:"HD SA"},{k:"hdga",t:"HD GA"},{k:"hdsv",t:"HDSV%",f:fmtSv},{k:"hdgsaa",t:"HD GSAA",f:v=>signed(v,2),c:true},
  {k:"mdsa",t:"MD SA"},{k:"mdga",t:"MD GA"},{k:"mdsv",t:"MDSV%",f:fmtSv},{k:"mdgsaa",t:"MD GSAA",f:v=>signed(v,2),c:true},
  {k:"ldsa",t:"LD SA"},{k:"ldga",t:"LD GA"},{k:"ldsv",t:"LDSV%",f:fmtSv},{k:"ldgsaa",t:"LD GSAA",f:v=>signed(v,2),c:true},
  {k:"rush",t:"Rush att."},{k:"reb",t:"Rebound att."},{k:"sdist",t:"Avg shot ft",f:v=>v.toFixed(1)},{k:"gdist",t:"Avg goal ft",f:v=>v.toFixed(1)},
];
const nst = {
  str: store.get("nst:str","all"), metric: store.get("nst:metric","gsaa"), min: store.get("nst:min", null),
  id: store.get("nst:goalie",""), hidden: store.get("nst:hidden", []), sort:{k:"gsaa",dir:-1}, q:"",
  data:{}, summary:null, failed:false
};
if(!NST_STR.some(s=>s[0]===nst.str)) nst.str="all";
if(!NST_METRICS.some(m=>m.k===nst.metric)) nst.metric="gsaa";

function parseCsv(text){
  const out=[]; let row=[], cell="", q=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){ cell+='"'; i++; } else q=false; } else cell+=ch; }
    else if(ch==='"') q=true;
    else if(ch===","){ row.push(cell); cell=""; }
    else if(ch==="\n"||ch==="\r"){ if(ch==="\r"&&text[i+1]==="\n") i++; row.push(cell); if(row.some(c=>c!=="")) out.push(row); row=[]; cell=""; }
    else cell+=ch;
  }
  if(cell!==""||row.length){ row.push(cell); out.push(row); }
  const [head,...body]=out;
  return body.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]])));
}
const numOr = v => { const n=parseFloat(v); return isFinite(n) ? n : null; };
function nstRow(r){
  const n=k=>numOr(r[k]);
  const o={name:r["Player"], team:r["Team"], gp:n("GP"), toi:n("TOI"), sa:n("Shots Against"), sv:n("Saves"), ga:n("Goals Against"),
    svp:n("SV%"), gaa:n("GAA"), gsaa:n("GSAA"), xga:n("xG Against"),
    hdsa:n("HD Shots Against"), hdga:n("HD Goals Against"), hdsv:n("HDSV%"), hdgsaa:n("HDGSAA"),
    mdsa:n("MD Shots Against"), mdga:n("MD Goals Against"), mdsv:n("MDSV%"), mdgsaa:n("MDGSAA"),
    ldsa:n("LD Shots Against"), ldga:n("LD Goals Against"), ldsv:n("LDSV%"), ldgsaa:n("LDGSAA"),
    rush:n("Rush Attempts Against"), reb:n("Rebound Attempts Against"), sdist:n("Avg. Shot Distance"), gdist:n("Avg. Goal Distance")};
  o.gsax = o.xga!=null&&o.ga!=null ? o.xga-o.ga : null;
  const rest=(o.mdsa||0)+(o.ldsa||0); o.restsv = rest ? 1-((o.mdga||0)+(o.ldga||0))/rest : null;
  o.key = normName(o.name)+"|"+o.team;
  o.nhl = NHL_BY_NAME.get(normName(o.name)) ?? null;
  return o;
}
const nstRows = () => nst.data[nst.str] || [];
const nstMaxSa = () => Math.max(0,...nstRows().map(r=>r.sa||0));
const nstDefaultMin = () => Math.max(20, Math.round(nstMaxSa()*.3/10)*10);
const nstMin = () => nst.min ?? nstDefaultMin();
const nstQual = () => nstRows().filter(r=>(r.sa||0)>=nstMin());
const nstMetric = () => NST_METRICS.find(m=>m.k===nst.metric);
function nstLeague(){
  const all=nstRows(), o={};
  for(const d of ["hd","md","ld"]){ const sa=all.reduce((a,r)=>a+(r[d+"sa"]||0),0), ga=all.reduce((a,r)=>a+(r[d+"ga"]||0),0); o[d]={sa,ga,sv:sa?1-ga/sa:null}; }
  const sa=all.reduce((a,r)=>a+(r.sa||0),0), ga=all.reduce((a,r)=>a+(r.ga||0),0); o.sv=sa?1-ga/sa:null; o.sa=sa;
  const rs=o.md.sa+o.ld.sa; o.restsv = rs ? 1-(o.md.ga+o.ld.ga)/rs : null;
  return o;
}
const nstGoalie = () => nstRows().find(r=>r.key===nst.id) || null;

function nstTop(){
  const el=$("#c-nsttop"), M=nstMetric();
  const list=nstQual().filter(r=>M.v(r)!=null).sort((a,b)=>(M.hi?M.v(b)-M.v(a):M.v(a)-M.v(b))).slice(0,15);
  $("#nstTopSub").textContent = `Top 15 by ${M.t.toLowerCase()}, goalies with ${nstMin()}+ shots against. Click a goalie to see their danger zones.`;
  if(!list.length){ el.innerHTML=`<div class="empty">No goalies with ${nstMin()}+ shots yet. Lower Min shots.</div>`; return; }
  const W=chartW(el), narrow=W<560, row=24, m={l:narrow?110:160,r:58,t:6,b:24}, H=m.t+m.b+list.length*row;
  const vals=list.map(M.v);
  let lo, hi;
  if(M.zero){ const e=Math.max(...vals.map(Math.abs))||1; lo=Math.min(0,...vals); hi=Math.max(0,...vals); const pad=e*.05; lo-=lo<0?pad:0; hi+=pad; }
  else { const L=nstLeague(); const ref=M.k==="svp"?L.sv:M.k==="hdsv"?L.hd.sv:M.k==="mdsv"?L.md.sv:M.k==="ldsv"?L.ld.sv:null;
    lo=Math.min(...vals,ref??Infinity); hi=Math.max(...vals,ref??-Infinity); const pad=(hi-lo)*.12||.01; lo-=pad; hi+=pad*.3; if(!M.hi){ lo=Math.max(0,lo); } }
  const X=v=>m.l+(v-lo)/(hi-lo)*(W-m.l-m.r), base=M.zero?X(0):m.l;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Top goalies by ${esc(M.t)}">`;
  s+=nice(lo,hi,narrow?3:5).map(v=>`<line class="gl" x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H-m.b}"/><text class="ax" x="${X(v)}" y="${H-6}" text-anchor="middle">${M.zero?signed(v,0):M.f(v)}</text>`).join("");
  list.forEach((r,i)=>{
    const y=m.t+i*row, v=M.v(r), x=X(v), sel=r.key===nst.id;
    const fill = M.zero ? (v>=0?"var(--good)":"var(--bad)") : i===0||sel ? "var(--crease)" : "var(--series-b)";
    s+=`<g class="dot" data-nk="${esc(r.key)}"><rect x="0" y="${y}" width="${W}" height="${row}" fill="${sel?"var(--crease-dim)":"transparent"}"/>
      <text x="${m.l-8}" y="${y+row/2+4}" text-anchor="end" style="fill:var(--chalk)"><tspan style="fill:var(--mute)">${i+1}</tspan> ${esc(last(r.name))} <tspan style="fill:var(--mute)">${esc(teamOf(r.team))}</tspan></text>
      <rect x="${Math.min(base,x)}" y="${y+5}" width="${Math.max(1,Math.abs(x-base))}" height="${row-10}" rx="3" fill="${fill}" fill-opacity="${M.zero?.85:1}"/>
      <text x="${Math.max(base,x)+6}" y="${y+row/2+4}" style="fill:var(--chalk);font-family:var(--f-data)">${M.f(v)}</text></g>`;
  });
  if(M.zero) s+=`<line x1="${base}" x2="${base}" y1="${m.t}" y2="${H-m.b}" stroke="var(--mute)"/>`;
  el.innerHTML=s+`</svg>`;
}
function nstDanger(){
  const g=nstGoalie(), L=nstLeague();
  const cells=DANGER.map(d=>{
    const sa=g?g[d.k+"sa"]:L[d.k].sa, ga=g?g[d.k+"ga"]:L[d.k].ga, sv=sa?1-ga/sa:null, lsv=L[d.k].sv;
    const thin = g && sa<ZMIN, dlt = g&&sv!=null ? sv-lsv : null;
    const fill = sv==null ? ZC.none : thin ? "url(#dzHatch)" : g ? divFill(dlt) : seqFill(sv);
    const ink = sv==null||thin ? "var(--mute)" : lum(g?divFill(dlt):seqFill(sv))>.2 ? "#0b1520" : "#ffffff";
    return {...d, sa, ga, sv, lsv, d:dlt, thin, fill, ink, gsaa:g?g[d.k+"gsaa"]:null, share:sa/Math.max(1,g?g.sa:L.sa)};
  });
  const C=Object.fromEntries(cells.map(c=>[c.k,c]));
  if(state.gfx && !nst.hidden.includes("dmap")){
    let s=`<svg viewBox="-1 -1 87 78" role="img" aria-label="Save percentage by danger level, goal at the top"><defs>
      <clipPath id="dzClip"><path d="${GM_RINK}"/></clipPath>
      <pattern id="dzHatch" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.4" height="2.4" fill="${ZC.none}"/><line x1="0" y1="0" x2="0" y2="2.4" stroke="${ZC.hatch}" stroke-width="1"/></pattern></defs>
      <g clip-path="url(#dzClip)"><path class="zc" data-dz="ld" d="${GM_RINK}" fill="${C.ld.fill}"/><path class="zc" data-dz="md" d="${DANGER_SHAPE.md}" fill="${C.md.fill}"/><path class="zc" data-dz="hd" d="${DANGER_SHAPE.hd}" fill="${C.hd.fill}"/></g>
      <g class="mk"><path d="${GM_RINK}"/><line x1="0" y1="11" x2="85" y2="11" clip-path="url(#dzClip)"/><path d="M36.5 11 A6 6 0 0 0 48.5 11"/><rect x="39.5" y="7.7" width="6" height="3.3"/><circle cx="20.5" cy="31" r="15"/><circle cx="64.5" cy="31" r="15"/></g>`;
    const lab=(c,x,y,big)=>`<text x="${x}" y="${y}" font-size="${big?4.4:3.8}" fill="${c.ink}">${c.sv==null?"–":fmtSv(c.sv)}</text><text class="zs" x="${x}" y="${y+3.4}" font-size="2.2" fill="${c.ink}" opacity=".9">${esc(c.s)} · ${c.ga}/${c.sa}</text>`;
    s+=lab(C.hd,42.5,25,true)+lab(C.md,42.5,51,false)+lab(C.ld,11,62,false)+lab(C.ld,74,62,false);
    $("#c-danger").innerHTML=s+`</svg>`;
    $("#dzLegend").innerHTML = g
      ? `<div class="ramp" style="background:linear-gradient(90deg,${ZDIV.bad},${ZDIV.mid},${ZDIV.good})"></div><div class="ends"><span>${zPlus(-ZDIV_MAX)} worse</span><span>League rate at that danger level</span><span>better ${zPlus(ZDIV_MAX)}</span></div><span>Labels read goals / shots. Areas are approximate.</span>`
      : `<div class="ramp" style="background:linear-gradient(90deg,${ZSEQ[1]},${ZSEQ[0]})"></div><div class="ends"><span>${fmtSv(ZSEQ_LO)} or lower</span><span>Stronger colour means more pucks get through</span><span>1.000</span></div><span>Labels read goals / shots. Areas are approximate.</span>`;
  }
  $("#dzMapWrap").hidden = !state.gfx || nst.hidden.includes("dmap");
  $("#dzHide").hidden = !state.gfx; $("#dzHide").textContent = nst.hidden.includes("dmap") ? "Show map" : "Hide map";
  $("#dzWho").innerHTML = g ? `<div class="who">${mono({name:g.name,team:g.team})}<div><b>${esc(g.name)}</b><small>${esc(g.team)} · ${g.gp} GP · ${g.sa} shots${g.nhl!=null?` · <a href="#" data-open="${g.nhl}">Profile</a>`:""}</small></div></div>` : `<div class="note">League totals, ${L.sa.toLocaleString()} shots against.</div>`;
  $("#dzTbl thead").innerHTML = `<tr><th class="l">Danger</th><th>Shots</th><th>Share</th><th>GA</th><th>SV%</th>${g?"<th>League</th><th>GSAA</th>":""}</tr>`;
  $("#dzTbl tbody").innerHTML = cells.map(c=>`<tr data-dz="${c.k}"><td class="l">${state.gfx?`<i style="background:${c.thin||c.sv==null?ZC.hatch:c.fill}"></i>`:""}${c.t}</td><td class="num">${c.sa}</td><td class="num">${pct(c.share)}</td><td class="num">${c.ga}</td><td class="num">${c.sv==null?"–":fmtSv(c.sv)}</td>${g?`<td class="num">${fmtSv(c.lsv)}</td><td class="num ${c.gsaa>0?"good":c.gsaa<0?"bad":""}">${signed(c.gsaa,2)}</td>`:""}</tr>`).join("");
}
function nstScatter(){
  const el=$("#c-nstscatter"), q=nstQual().filter(r=>r.hdsv!=null&&r.restsv!=null&&r.hdsa>0), L=nstLeague();
  if(q.length<2){ el.innerHTML=`<div class="empty">Not enough goalies with ${nstMin()}+ shots. Lower Min shots.</div>`; return; }
  const W=chartW(el), narrow=W<560, H=narrow?320:380, m={l:52,r:20,t:14,b:40};
  let x0=Math.min(...q.map(r=>r.hdsv),L.hd.sv), x1=Math.max(...q.map(r=>r.hdsv),L.hd.sv), y0=Math.min(...q.map(r=>r.restsv),L.restsv), y1=Math.max(...q.map(r=>r.restsv),L.restsv);
  const px=(x1-x0)*.08||.01, py=(y1-y0)*.08||.005; x0-=px;x1+=px;y0-=py;y1+=py;
  const X=v=>m.l+(v-x0)/(x1-x0)*(W-m.l-m.r), Y=v=>H-m.b-(v-y0)/(y1-y0)*(H-m.t-m.b);
  const maxSa=Math.max(...q.map(r=>r.sa)), R=sa=>3.5+9*Math.sqrt(sa/maxSa);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="High-danger save percentage against save percentage on all other shots">`;
  s+=nice(x0,x1,narrow?4:6).map(v=>`<line class="gl" x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H-m.b}"/><text class="ax" x="${X(v)}" y="${H-m.b+18}" text-anchor="middle">${fmtSv(v)}</text>`).join("");
  s+=nice(y0,y1,5).map(v=>`<line class="gl" x1="${m.l}" x2="${W-m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${m.l-8}" y="${Y(v)+3}" text-anchor="end">${fmtSv(v)}</text>`).join("");
  s+=`<line x1="${X(L.hd.sv)}" x2="${X(L.hd.sv)}" y1="${m.t}" y2="${H-m.b}" stroke="var(--mute)" stroke-dasharray="4 4"/><line x1="${m.l}" x2="${W-m.r}" y1="${Y(L.restsv)}" y2="${Y(L.restsv)}" stroke="var(--mute)" stroke-dasharray="4 4"/>`;
  s+=`<text class="ax" x="${W-m.r}" y="${H-6}" text-anchor="end">${narrow?"HD SAVE % →":"HIGH-DANGER SAVE % →"}</text><text class="ax" x="${m.l}" y="${H-6}">${narrow?"↑ OTHER SHOTS":"↑ SAVE % ON EVERYTHING ELSE"}</text>`;
  s+=`<text class="ax" x="${W-m.r-4}" y="${m.t+12}" text-anchor="end" style="fill:var(--good)">STRONG EVERYWHERE</text>${narrow?"":`<text class="ax" x="${m.l+6}" y="${H-m.b-8}" style="fill:var(--bad)">BELOW AVERAGE ON BOTH</text>`}`;
  s+=[...q].sort((a,b)=>b.sa-a.sa).map(r=>`<circle class="dot${r.key===nst.id?" sel":""}" data-nk="${esc(r.key)}" cx="${X(r.hdsv).toFixed(1)}" cy="${Y(r.restsv).toFixed(1)}" r="${R(r.sa).toFixed(1)}" fill="${color(r.team)}" fill-opacity=".85" stroke="${r.key===nst.id?"var(--chalk)":"var(--ice)"}" stroke-width="${r.key===nst.id?2:1}"/>`).join("");
  const score=r=>(r.hdsv-L.hd.sv)/(x1-x0)+(r.restsv-L.restsv)/(y1-y0);
  const lab=[...q].sort((a,b)=>score(b)-score(a)).slice(0,narrow?3:5).concat(q.filter(r=>r.key===nst.id));
  s+=lab.filter((r,i,a)=>a.indexOf(r)===i).map(r=>`<text x="${X(r.hdsv)+R(r.sa)+4}" y="${Y(r.restsv)+4}" style="fill:var(--chalk);font-weight:600;font-size:11px;pointer-events:none">${esc(last(r.name))}</text>`).join("");
  el.innerHTML=s+`</svg>`;
}
function nstTable(){
  const t=nst.q.trim().toLowerCase(), c=NST_COLS.find(c=>c.k===nst.sort.k)||NST_COLS[8];
  const list=nstRows().filter(r=>!t||r.name.toLowerCase().includes(t)||r.team.toLowerCase().includes(t))
    .sort((a,b)=>{ const A=a[c.k],B=b[c.k]; if(A==null) return 1; if(B==null) return -1; return (typeof A==="string"?A.localeCompare(B):A-B)*nst.sort.dir; });
  $("#nstTbl thead tr").innerHTML = NST_COLS.map(c=>`<th data-k="${c.k}" class="${c.l?"l":""}" ${c.k===nst.sort.k?`aria-sort="${nst.sort.dir<0?"descending":"ascending"}"`:""}>${c.t}</th>`).join("");
  $("#nstTbl tbody").innerHTML = list.length ? list.map(r=>`<tr data-nk="${esc(r.key)}" class="${r.key===nst.id?"on":""}">`+NST_COLS.map(c=>{
    const v=r[c.k]; if(c.k==="name") return `<td class="l"><b>${esc(v)}</b></td>`;
    if(c.l) return `<td class="l">${esc(v)}</td>`;
    const txt = v==null ? "–" : c.f ? c.f(v) : v;
    return `<td class="num ${c.c&&v!=null?(v>0?"good":v<0?"bad":""):""}">${txt}</td>`;
  }).join("")+`</tr>`).join("") : `<tr><td class="empty" colspan="${NST_COLS.length}">No goalies match.</td></tr>`;
  $("#nstCount").textContent = `${list.length} goalies · click a column to sort, a row to see danger zones`;
}
function renderNst(){
  if(nst.failed){ $("#nstBody").innerHTML=`<div class="empty">The Natural Stat Trick tables could not be loaded. They appear once the morning stats run has saved them.</div>`; return; }
  if(!nst.data.all) return;
  const S=nst.summary;
  $("#nstNote").innerHTML = `${esc(S?.season||"")} regular season · fetched ${esc((S?.fetched_at||"").slice(0,10))} · Data courtesy of <a href="https://www.naturalstattrick.com" rel="noopener">Natural Stat Trick</a>`;
  $("#nstStr").innerHTML = segBtns(NST_STR, nst.str);
  $("#nstMetric").innerHTML = NST_METRICS.map(m=>`<option value="${m.k}" ${m.k===nst.metric?"selected":""}>${esc(m.t)}</option>`).join("");
  const mx=Math.max(50, Math.ceil(nstMaxSa()/10)*10); $("#nstMin").max=mx; $("#nstMin").value=Math.min(nstMin(),mx); $("#nstMinV").textContent=nstMin();
  const opts=[...nstRows()].sort((a,b)=>last(a.name).localeCompare(last(b.name)));
  $("#dzGoalie").innerHTML = `<option value="">All goalies (league)</option>` + opts.map(r=>`<option value="${esc(r.key)}" ${r.key===nst.id?"selected":""}>${esc(r.name)} · ${esc(r.team)} (${r.sa} shots)</option>`).join("");
  const gfx=state.gfx;
  document.querySelectorAll("#nstSec [data-nst]").forEach(p=>{ p.hidden = !gfx || nst.hidden.includes(p.dataset.nst); });
  const hid=nst.hidden.filter(k=>k!=="dmap");
  $("#nstCollapsed").hidden = !gfx || !hid.length;
  $("#nstCollapsed").innerHTML = hid.length ? `Hidden:` + hid.map(k=>`<button type="button" data-nshow="${k}">Show ${k==="top"?"Top goaltenders":"High danger vs everything else"}</button>`).join("") : "";
  if(gfx && !nst.hidden.includes("top")) nstTop();
  if(gfx && !nst.hidden.includes("scatter")) nstScatter();
  nstDanger(); nstTable();
}
function nstSelect(key){ nst.id = nst.id===key ? "" : key; store.set("nst:goalie",nst.id); renderNst(); }
$("#nstSec").addEventListener("click",e=>{
  const a=e.target.closest("[data-open]"); if(a){ e.preventDefault(); openGoalie(+a.dataset.open); return; }
  const sb=e.target.closest("#nstStr button"); if(sb){ nst.str=sb.dataset.v; store.set("nst:str",nst.str); if(!nstRows().some(r=>r.key===nst.id)) nst.id=""; renderNst(); return; }
  const h=e.target.closest("[data-nhide]"); if(h){ nst.hidden=[...new Set([...nst.hidden,h.dataset.nhide])]; store.set("nst:hidden",nst.hidden); hideTip(); renderNst(); return; }
  const s=e.target.closest("[data-nshow]"); if(s){ nst.hidden=nst.hidden.filter(k=>k!==s.dataset.nshow); store.set("nst:hidden",nst.hidden); renderNst(); return; }
  if(e.target.closest("#dzHide")){ nst.hidden = nst.hidden.includes("dmap") ? nst.hidden.filter(k=>k!=="dmap") : [...nst.hidden,"dmap"]; store.set("nst:hidden",nst.hidden); renderNst(); return; }
  const th=e.target.closest("#nstTbl th"); if(th){ const k=th.dataset.k; nst.sort = nst.sort.k===k ? {k,dir:-nst.sort.dir} : {k,dir:(NST_COLS.find(c=>c.k===k).l?1:-1)}; nstTable(); return; }
  const r=e.target.closest("[data-nk]"); if(r){ nstSelect(r.dataset.nk); if(!r.closest("#dzCard")) $("#dzCard").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"nearest"}); }
});
$("#nstMetric").addEventListener("change",e=>{ nst.metric=e.target.value; store.set("nst:metric",nst.metric); renderNst(); });
$("#nstMin").addEventListener("input",e=>{ nst.min=+e.target.value; store.set("nst:min",nst.min); renderNst(); });
$("#nstQ").addEventListener("input",e=>{ nst.q=e.target.value; nstTable(); });
$("#dzGoalie").addEventListener("change",e=>{ nst.id=e.target.value; store.set("nst:goalie",nst.id); renderNst(); });
$("#nstSec").addEventListener("mousemove",e=>{
  const d=e.target.closest("svg [data-nk]"), z=e.target.closest("svg [data-dz]");
  if(d){ const r=nstRows().find(r=>r.key===d.dataset.nk); if(!r) return hideTip();
    return showTip(e,`<b>${esc(r.name)}</b>${esc(r.team)} · ${r.gp} GP · ${r.sa} shots<br>SV% ${fmtSv(r.svp)} · GSAA ${signed(r.gsaa,2)}<br>High danger ${fmtSv(r.hdsv)} on ${r.hdsa} · everything else ${fmtSv(r.restsv)}`); }
  if(z){ const g=nstGoalie(), L=nstLeague(), k=z.dataset.dz, D=DANGER.find(d=>d.k===k);
    const sa=g?g[k+"sa"]:L[k].sa, ga=g?g[k+"ga"]:L[k].ga;
    return showTip(e,`<b>${D.t}</b>${ga} goals on ${sa} shots · SV% ${sa?fmtSv(1-ga/sa):"–"}${g?`<br>League ${fmtSv(L[k].sv)} · GSAA ${signed(g[k+"gsaa"],2)}`:""}`); }
  hideTip();
});
$("#nstSec").addEventListener("mouseleave",hideTip);
$("#gfx").addEventListener("change",renderNst);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",renderNst);
let nstRz; addEventListener("resize",()=>{ clearTimeout(nstRz); nstRz=setTimeout(()=>{ if(nst.data.all){ if(state.gfx&&!nst.hidden.includes("top")) nstTop(); if(state.gfx&&!nst.hidden.includes("scatter")) nstScatter(); } },150); });

(async function loadNst(){
  try{
    const S = await fetch(NST_DIR+"summary.json",{cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); });
    nst.summary=S;
    for(const [k] of NST_STR){
      const f=S.files?.[k]?.file; if(!f) continue;
      const text=await fetch(NST_DIR+f,{cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.text(); });
      nst.data[k]=parseCsv(text).map(nstRow).filter(r=>r.name);
    }
    if(!nst.data.all) throw new Error("no rows");
    if(!nst.data[nst.str]) nst.str="all";
    if(!nstRows().some(r=>r.key===nst.id)) nst.id="";
  }catch(err){ nst.failed=true; }
  renderNst();
})();
