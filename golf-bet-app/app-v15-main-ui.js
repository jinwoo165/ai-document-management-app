// v15 MAIN UI
// Host: round manual double control moved above confirm; setup simplified.
// Viewer: settlement becomes the single main screen with no bottom tabs.
// Host/viewer settlement: refresh icon, hole scores, current/cumulative settlement, score popup.

const v15BaseBindSetup = bindSetup;
const v15BaseBindRound = bindRound;

(function v15Styles(){
  if(document.getElementById('v15Styles')) return;
  const s=document.createElement('style');
  s.id='v15Styles';
  s.textContent=`
    .v15-ledger-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
    .v15-ledger-head h1{font-size:22px;margin:0}
    .v15-head-actions{display:flex;align-items:center;gap:7px}
    .v15-icon-btn{width:38px;height:38px;border:1px solid #d8e1dc;background:#fff;border-radius:50%;font-size:22px;line-height:1;display:grid;place-items:center;padding:0;color:#315844}
    .v15-score-open{height:38px;padding:0 11px;border:1px solid #d8e1dc;background:#fff;border-radius:10px;font-size:12px;font-weight:800;color:#315844}
    .v15-ledger-card{padding:14px!important;margin-bottom:9px!important}
    .v15-hole-picker{padding:12px 14px!important}
    .v15-hole-picker .holetrack{margin-top:9px}
    .v15-score-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:9px}
    .v15-score-cell{background:#f5f8f6;border:1px solid #e0e7e3;border-radius:9px;padding:7px 3px;text-align:center;min-width:0}
    .v15-score-cell span{display:block;font-size:10px;color:#69766f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .v15-score-cell b{display:block;font-size:17px;line-height:1.15;margin-top:2px}
    .v15-score-cell em{display:block;font-style:normal;font-size:9px;color:#8b958f;margin-top:2px;white-space:nowrap}
    .v15-section-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
    .v15-section-title h2{font-size:17px;margin:0}
    .v15-section-title .confirm-badge{flex:none}
    .v15-ledger-card .moneygrid{gap:5px}
    .v15-ledger-card .moneycard{padding:9px 6px}
    .v15-ledger-card .moneycard .amt{font-size:18px}
    .v15-ledger-card .transfer{padding:9px 2px}
    .v15-manual-double{margin:10px 0 8px!important;padding:10px 11px!important;border:1px solid #f0d2a5;border-radius:11px;background:#fffaf2}
    .v15-manual-double .switchcopy strong{font-size:16px}
    .v15-manual-double .switchcopy span{font-size:11px}
    .v15-setup-actions{margin-top:9px}
    .v15-copy-only{width:100%}
    .v15-new-game-card{margin-top:9px}
    .v15-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:9999;display:flex;align-items:center;justify-content:center;padding:14px}
    .v15-modal{width:min(96vw,520px);max-height:88vh;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.24)}
    .v15-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 15px;border-bottom:1px solid #e7ece9}
    .v15-modal-head h2{font-size:18px;margin:0}
    .v15-modal-close{width:34px;height:34px;border:0;background:#f2f5f3;border-radius:50%;font-size:21px;line-height:1}
    .v15-score-table-wrap{overflow:auto;max-height:70vh;padding:8px 10px 14px}
    .v15-score-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}
    .v15-score-table th,.v15-score-table td{border-bottom:1px solid #e8ecea;padding:7px 3px;text-align:center}
    .v15-score-table th{position:sticky;top:0;background:#fff;font-size:11px;z-index:1}
    .v15-score-table th:first-child,.v15-score-table td:first-child{width:38px;color:#65736b;font-weight:800}
    .v15-score-table .mine{font-weight:900;background:#f4f8f5}
    body.v15-viewer-mode .bottomnav{display:none!important}
    body.v15-viewer-mode main{padding-bottom:18px!important}
    @media(max-width:390px){
      .v15-ledger-card{padding:12px!important}
      .v15-score-cell b{font-size:16px}
      .v15-icon-btn{width:36px;height:36px}
      .v15-score-open{height:36px;padding:0 9px}
    }
  `;
  document.head.appendChild(s);
})();

// ------------------------------------------------------------------
// HOST ROUND
// ------------------------------------------------------------------
function v15HostRoundHTML(){
  const h=currentHole();
  const par=state.room.pars[h-1];
  const L=holeLedger(h);
  const complete=holeComplete(h);
  const allTie=L.allTie===true;
  const prevAllTie=h>1&&(state.room.rules.allTieCarry!==false)&&allTieHole(h-1);
  const triggers=state.room.rules.doubleTiming==='current'?triggerInfo(h):(h>1?triggerInfo(h-1):[]);
  const displayTriggers=[...(prevAllTie?['전 홀 전원 동타 이월']:[]),...triggers];
  const triggerText=allTie
    ?(h<18?'전원 동타 · 이번 홀 0원 · 다음 홀 ×2':'전원 동타 · 이번 홀 0원')
    :(displayTriggers.length?`배판: ${[...new Set(displayTriggers)].join(' · ')}`:'배판 조건 없음');
  const entered=enteredScoreCount(h);

  return `<div class="statusbar"><div class="names">${state.room.players.map(p=>{const c=cumulativeToPar(p.id);return `<span class="tinyplayer">${escapeHtml(p.name)}<b>${c.holes?parLabel(c.diff):'–'}</b></span>`}).join('')}</div><div class="roundprogress">${completedCount()}/18H</div></div>
    <section class="card holehero"><div class="holehead"><div><div class="par">PAR ${par}</div><div class="holeid">${h} HOLE</div></div><div class="mult ${allTie||L.mult===1?'normal':''}">${allTie?'0원':`× ${L.mult}`}</div></div><div class="trigger">${triggerText}</div></section>
    <section class="card scorecard">
      <div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">4명 스코어</h2><span class="fs12 ${complete?'plus':'muted'}">${complete?'● 확정 · 수정 가능':`${entered}/4 입력`}</span></div>
      ${state.room.players.map(p=>scoreRowHTML(h,p,par)).join('')}
      ${state.room.rules.manualTriggerEnabled?`<div class="switchrow v15-manual-double"><div class="switchcopy"><strong>땅!! 배판!!</strong><span>필요할 때 수동으로 배판 적용</span></div><label class="switch"><input id="manualDouble" type="checkbox" ${state.room.manualDouble?.[`h${h}`]?'checked':''}><span class="slider"></span></label></div>`:''}
      <button id="confirmAllScores" class="btn primary block confirm-all" ${(entered!==4||complete||state.busy)?'disabled':''}>${complete?'✓ 4명 입력완료':state.busy?'저장 중...':'4명 입력완료'}</button>
      <div class="sub center mb0" style="margin-top:7px">과거 홀도 아래 번호를 눌러 수정할 수 있습니다. 수정한 홀은 다시 입력완료하면 재정산됩니다.</div>
      ${complete?`<div class="score-summary">${state.room.players.map(p=>{const n=L.net[p.id]||0;return `<div><span>${escapeHtml(p.name)}</span><strong class="${n>0?'plus':n<0?'minus':'zero'}">${signed(n)}</strong></div>`}).join('')}</div>`:''}
    </section>
    <section class="card roundnav"><div class="roundnavtop"><button id="prevHole" class="btn ghost small" ${h===1?'disabled':''}>← 이전</button><b>${h}/18</b><button id="nextHole" class="btn secondary small" ${h===18?'disabled':''}>다음 →</button></div><div class="holetrack">${Array.from({length:18},(_,i)=>{const n=i+1;return `<button class="hchip ${n===h?'current':holeComplete(n)?'done':'pending'}" data-hole="${n}">${n}</button>`}).join('')}</div></section>`;
}

roundHTML=function(){
  return state.viewerMode ? ledgerHTML() : v15HostRoundHTML();
};

// ------------------------------------------------------------------
// SETUP: host only
// ------------------------------------------------------------------
setupHTML=function(){
  const editable=isHost()||!state.firebaseReady;
  const tab=state.setupTab||'players';
  const content=tab==='players'?playersSetupHTML(editable):tab==='course'?courseSetupHTML(editable):rulesSetupHTML(editable);
  let actions='';

  if(isHost()&&tab==='players'){
    actions=`<section class="card v15-setup-actions"><button id="copyRoom" class="btn secondary v15-copy-only">ROOM 코드 복사</button></section>
      <section class="card new-game-card v15-new-game-card"><h2>새 게임 시작하기</h2><div class="sub">현재 ROOM과 플레이어는 유지하고 스코어·정산 기록만 초기화합니다.</div><button id="newGameBtn" class="btn danger block new-game-btn" ${state.busy?'disabled':''}>↻ 새 게임 시작하기</button></section>`;
  }

  return `<div class="setupnav">
      <button class="btn ${tab==='players'?'active':'ghost'}" data-st="players">플레이어</button>
      <button class="btn ${tab==='course'?'active':'ghost'}" data-st="course">홀 정보</button>
      <button class="btn ${tab==='rules'?'active':'ghost'}" data-st="rules">내기 규칙</button>
    </div>${content}${actions}`;
};

bindSetup=function(){
  v15BaseBindSetup();
};

// ------------------------------------------------------------------
// LEDGER / MAIN VIEW
// ------------------------------------------------------------------
function v15LedgerHole(){
  return clamp(Number(state.v13LedgerHole||currentHole()),1,18);
}

function v15HoleSettlement(h){
  const L=holeLedger(h);
  const net=L.complete?L.net:Object.fromEntries(state.room.players.map(p=>[p.id,0]));
  return {L,net,transfers:L.complete?minimalTransfers(net):[]};
}

function v15Transfers(list,emptyText){
  if(!list.length) return `<div class="center muted fs12" style="padding:9px 0">${emptyText}</div>`;
  return list.map(t=>`<div class="transfer"><div class="who"><b>${escapeHtml(getPlayer(t.from).name)}</b> <span class="arrow">→</span> <b>${escapeHtml(getPlayer(t.to).name)}</b></div><strong>${fmt(t.amt)}</strong></div>`).join('');
}

function v15HoleScoreStrip(h){
  const par=state.room.pars[h-1];
  return `<div class="v15-score-strip">${state.room.players.map(p=>{
    const s=scoreOf(h,p.id);
    return `<div class="v15-score-cell"><span>${escapeHtml(p.name)}</span><b>${Number.isFinite(s)?s:'-'}</b><em>${Number.isFinite(s)?classify(s,par):'미입력'}</em></div>`;
  }).join('')}</div>`;
}

ledgerHTML=function(){
  const h=v15LedgerHole();
  const hole=v15HoleSettlement(h);
  const cum=cumulativeLedger(18);
  const cumTransfers=minimalTransfers(cum.net);
  const complete=completedCount();

  return `<div class="v15-ledger-head">
      <div><div class="fs11 muted">ROOM ${escapeHtml(state.room.code)}</div><h1>정산</h1></div>
      <div class="v15-head-actions"><button id="openScoreTable" class="v15-score-open">전체 스코어</button><button id="v15RefreshBtn" class="v15-icon-btn" aria-label="새로고침" title="새로고침">↻</button></div>
    </div>

    <section class="card v15-ledger-card v15-hole-picker">
      <div class="v15-section-title"><h2>당홀 선택</h2><b>${h}H</b></div>
      <div class="holetrack ledger-holetrack">${Array.from({length:18},(_,i)=>{const n=i+1;return `<button class="hchip ${n===h?'current':holeComplete(n)?'done':'pending'}" data-ledger-hole="${n}">${n}</button>`}).join('')}</div>
      ${v15HoleScoreStrip(h)}
    </section>

    <section class="card v15-ledger-card current-hole-ledger">
      <div class="v15-section-title"><h2>${h}번홀 당홀 정산</h2><span class="confirm-badge ${hole.L.complete?'done':''}">${hole.L.complete?'확정':'입력 대기'}</span></div>
      <div class="moneygrid">${state.room.players.map(p=>moneyCard(p,hole.net[p.id]||0)).join('')}</div>
    </section>

    <section class="card v15-ledger-card"><div class="v15-section-title"><h2>${h}번홀 · 상계 정산</h2></div>${v15Transfers(hole.transfers,'현재 당홀 정산할 금액이 없습니다.')}</section>

    <section class="card v15-ledger-card">
      <div class="v15-section-title"><h2>누적 정산</h2><span class="fs11 muted">${complete}/18H</span></div>
      <div class="moneygrid">${state.room.players.map(p=>moneyCard(p,cum.net[p.id]||0)).join('')}</div>
    </section>

    <section class="card v15-ledger-card"><div class="v15-section-title"><h2>누적 · 상계 후 한번에 정산</h2><button id="copySummary" class="copybtn">결과 복사</button></div>${v15Transfers(cumTransfers,'현재 누적 정산할 금액이 없습니다.')}</section>

    <section class="card v15-ledger-card"><div class="v15-section-title"><h2>상대별 누적 원장</h2></div>${pairSummaryHTML(cum.pair)}</section>`;
};

async function v15RefreshRoom(){
  if(!state.room||!state.firebaseReady||state.busy)return;
  const btn=$('#v15RefreshBtn');
  state.busy=true;
  if(btn){btn.disabled=true;btn.textContent='…';}
  try{
    const code=state.room.code;
    const playerId=state.myPlayerId;
    const {doc,getDoc}=state.fx;
    const snap=await Promise.race([
      getDoc(doc(state.db,'rooms',code)),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('새로고침 시간이 초과되었습니다.')),10000))
    ]);
    if(!snap.exists())throw new Error('ROOM을 찾을 수 없습니다.');
    state.room=snap.data();
    state.myPlayerId=playerId;
    render();
    toast('최신 정보로 새로고침했습니다.');
  }catch(e){
    toast(e?.message||'새로고침에 실패했습니다.');
  }finally{
    state.busy=false;
    if($('#v15RefreshBtn'))$('#v15RefreshBtn').textContent='↻';
  }
}

function v15ScoreTableHTML(){
  const myId=state.myPlayerId;
  return `<div class="v15-modal-backdrop" id="v15ScoreModalBackdrop">
    <div class="v15-modal" role="dialog" aria-modal="true" aria-label="전체 스코어">
      <div class="v15-modal-head"><div><div class="fs11 muted">18 HOLES</div><h2>전체 스코어</h2></div><button id="v15ScoreModalClose" class="v15-modal-close" aria-label="닫기">×</button></div>
      <div class="v15-score-table-wrap"><table class="v15-score-table"><thead><tr><th>H</th>${state.room.players.map(p=>`<th class="${p.id===myId?'mine':''}">${escapeHtml(p.name)}</th>`).join('')}</tr></thead><tbody>
      ${Array.from({length:18},(_,i)=>{const h=i+1;return `<tr><td>${h}</td>${state.room.players.map(p=>{const s=scoreOf(h,p.id);return `<td class="${p.id===myId?'mine':''}">${Number.isFinite(s)?s:'-'}</td>`}).join('')}</tr>`}).join('')}
      </tbody></table></div>
    </div></div>`;
}

function v15OpenScoreTable(){
  const root=$('#modalRoot');
  if(!root)return;
  root.innerHTML=v15ScoreTableHTML();
  $('#v15ScoreModalClose')?.addEventListener('click',()=>root.innerHTML='');
  $('#v15ScoreModalBackdrop')?.addEventListener('click',e=>{if(e.target.id==='v15ScoreModalBackdrop')root.innerHTML='';});
}

function v15BindLedger(){
  $$('[data-ledger-hole]').forEach(b=>b.addEventListener('click',()=>{state.v13LedgerHole=+b.dataset.ledgerHole;render();}));
  $('#v15RefreshBtn')?.addEventListener('click',v15RefreshRoom);
  $('#openScoreTable')?.addEventListener('click',v15OpenScoreTable);
  $('#copySummary')?.addEventListener('click',()=>copyText(summaryText(),'정산 결과가 복사되었습니다.'));
}

bindLedger=function(){v15BindLedger();};

// ------------------------------------------------------------------
// RENDER: viewer has one screen only; host keeps 3 bottom tabs.
// ------------------------------------------------------------------
render=function(){
  const main=$('#main'),nav=$('#bottomNav'),roomLine=$('#roomLine');
  if(!state.loginVerified){
    document.body.classList.remove('v15-viewer-mode');
    roomLine.classList.add('hidden');nav.classList.add('hidden');
    main.innerHTML=loginHTML();bindLogin();return;
  }

  if(state.room){
    roomLine.classList.remove('hidden');
    $('#roomCodeTop').textContent=state.room.code;
    $('#myIdentity').textContent=state.viewerMode?(myPlayer()?.name||'동반자'):identityName();
  }else roomLine.classList.add('hidden');

  if(!state.room){
    document.body.classList.remove('v15-viewer-mode');
    nav.classList.add('hidden');main.innerHTML=homeHTML();bindHome();return;
  }

  if(state.viewerMode){
    document.body.classList.add('v15-viewer-mode');
    nav.classList.add('hidden');
    state.tab='ledger';
    main.innerHTML=ledgerHTML();
    bindLedger();
    return;
  }

  document.body.classList.remove('v15-viewer-mode');
  nav.classList.remove('hidden');
  $$('.navbtn',nav).forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));
  if(state.tab==='setup'){
    main.innerHTML=setupHTML();bindSetup();
  }else if(state.tab==='ledger'){
    main.innerHTML=ledgerHTML();bindLedger();
  }else{
    state.tab='round';main.innerHTML=roundHTML();v15BaseBindRound();
  }
};

document.documentElement.dataset.mainUi='v15';
render();
