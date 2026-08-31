// v18 UI + host access refinement
// - Larger all-score popup text
// - Betting reason on selected settlement hole (manual => 땅!!)
// - Strong visual separation between current-hole and cumulative settlement
// - Host can go back to the first entry screen without losing host resume data

const V18_HOST_RESUME_KEY='golfBetHostResumeV1';
const V18_SKIP_AUTO_KEY='golfBetSkipHostAutoResumeV1';

function v18ReadHostResume(){
  try{return JSON.parse(localStorage.getItem(V18_HOST_RESUME_KEY)||'null');}catch{return null;}
}

function v18WriteHostResume(){
  if(!state.room || !state.session?.host) return;
  const hostName=identityName()||state.session.identityName||state.room.players?.[0]?.name||'';
  if(!hostName) return;
  localStorage.setItem(V18_HOST_RESUME_KEY,JSON.stringify({
    roomCode:state.room.code,
    playerId:state.session.playerId||'p1',
    identityName:hostName,
    savedAt:Date.now()
  }));
}

// v17 schedules host restore with setTimeout(0). Prepare state synchronously here
// before that callback runs. A deliberate "entry screen" choice suppresses restore
// only for the current browser/app session.
(function v18PrepareHostRestore(){
  const skip=sessionStorage.getItem(V18_SKIP_AUTO_KEY)==='1';
  if(skip){
    if(state.session?.host){
      state.session=null;
      localStorage.removeItem(roomStorageKey);
    }
    return;
  }
  const saved=v18ReadHostResume();
  if(!saved?.roomCode || !saved?.identityName) return;
  state.session={roomCode:saved.roomCode,playerId:saved.playerId||'p1',host:true,identityName:saved.identityName};
  state.identity={name:saved.identityName};
  localStorage.setItem(roomStorageKey,JSON.stringify(state.session));
  localStorage.setItem(identityStorageKey,JSON.stringify(state.identity));
})();

(function v18Styles(){
  if(document.getElementById('v18Styles'))return;
  const s=document.createElement('style');
  s.id='v18Styles';
  s.textContent=`
    /* Score popup readability */
    .v15-modal{width:min(98vw,560px)}
    .v15-modal-head h2{font-size:22px!important}
    .v15-score-table{font-size:15px!important}
    .v15-score-table th{font-size:13px!important;padding:10px 4px!important}
    .v15-score-table td{font-size:15px!important;padding:10px 4px!important}
    .v15-score-table th:first-child,.v15-score-table td:first-child{width:42px!important}
    .v17-total-score{font-size:19px!important}
    .v17-total-rel{font-size:11px!important;margin-top:4px!important}
    .v17-total-row td{padding-top:12px!important;padding-bottom:12px!important}

    /* Betting reason */
    .v18-bet-reason{display:flex;align-items:center;gap:7px;margin-top:9px;padding:8px 9px;border-radius:9px;background:#f7f8f7;border:1px solid #e2e7e4;min-height:36px}
    .v18-bet-reason span{font-size:10px;font-weight:900;color:#77827c;flex:none}
    .v18-bet-reason b{font-size:12px;line-height:1.25;color:#33483d;flex:1}
    .v18-bet-reason em{font-style:normal;font-size:12px;font-weight:900;color:#0b5f3b;flex:none}
    .v18-bet-reason.active{background:#fff8ed;border-color:#edcf9f}
    .v18-bet-reason.active b{color:#7b4a12}
    .v18-bet-reason.active em{color:#a95f09}

    /* Current vs cumulative settlement */
    .v18-current-card{border:2px solid #0b5f3b!important;background:#f5fbf7!important;box-shadow:0 5px 16px rgba(11,95,59,.08)}
    .v18-current-card .v18-kind{background:#0b5f3b;color:#fff}
    .v18-current-sub{border-left:4px solid #7eaa91!important;background:#fbfdfb!important}
    .v18-total-card{border:2px solid #415a73!important;background:#f6f8fb!important;box-shadow:0 5px 16px rgba(65,90,115,.08)}
    .v18-total-card .v18-kind{background:#415a73;color:#fff}
    .v18-total-sub{border-left:4px solid #8ea0b2!important;background:#fafbfd!important}
    .v18-kind{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:.03em;margin-right:6px}
    .v18-title-with-kind{display:flex;align-items:center;min-width:0}

    /* Host entry-screen control */
    .v18-entry-btn{margin-left:auto;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.12);color:inherit;border-radius:9px;padding:7px 9px;font-size:11px;font-weight:900;white-space:nowrap}
    .toprow{gap:8px}
    @media(max-width:390px){
      .v15-score-table{font-size:14px!important}
      .v15-score-table td{font-size:14px!important;padding:9px 3px!important}
      .v15-score-table th{font-size:12px!important;padding:9px 3px!important}
      .v17-total-score{font-size:18px!important}
      .v18-entry-btn{font-size:10px;padding:6px 7px}
    }
  `;
  document.head.appendChild(s);
})();

function v18BetReason(h){
  const r=state.room.rules;
  const currentAllTie=(r.allTieCarry!==false)&&allTieHole(h);
  if(currentAllTie){
    return {text:'전원 동타 · 이번홀 0원',mult:1,active:true};
  }

  let raw=[];
  let fromPrevious=false;
  if(r.doubleTiming==='current'){
    raw=triggerInfo(h).slice();
    // Show manual reason immediately even before the hole is fully confirmed.
    if(r.manualTriggerEnabled && state.room.manualDouble?.[`h${h}`] && !raw.includes('기타/수동')) raw.push('기타/수동');
  }else if(h>1){
    raw=triggerInfo(h-1).slice();
    fromPrevious=true;
  }

  const items=[];
  raw.forEach(x=>{
    const mapped=x==='기타/수동'?'땅!!':x;
    items.push(fromPrevious?`전홀 ${mapped}`:mapped);
  });
  if(h>1 && r.allTieCarry!==false && allTieHole(h-1)) items.push('전홀 전원 동타');

  const unique=[...new Set(items)];
  const mult=holeMultiplier(h);
  return {text:unique.length?unique.join(' · '):'없음',mult,active:unique.length>0||mult>1};
}

// Rebuild settlement screen using v15 helpers, adding betting reason and clearer hierarchy.
ledgerHTML=function(){
  const h=v15LedgerHole();
  const hole=v15HoleSettlement(h);
  const cum=cumulativeLedger(18);
  const cumTransfers=minimalTransfers(cum.net);
  const complete=completedCount();
  const reason=v18BetReason(h);

  return `<div class="v15-ledger-head">
      <div><div class="fs11 muted">ROOM ${escapeHtml(state.room.code)}</div><h1>정산</h1></div>
      <div class="v15-head-actions"><button id="openScoreTable" class="v15-score-open">전체 스코어</button><button id="v15RefreshBtn" class="v15-icon-btn" aria-label="새로고침" title="새로고침">↻</button></div>
    </div>

    <section class="card v15-ledger-card v15-hole-picker">
      <div class="v15-section-title"><h2>당홀 선택</h2><b>${h}H</b></div>
      <div class="holetrack ledger-holetrack">${Array.from({length:18},(_,i)=>{const n=i+1;return `<button class="hchip ${n===h?'current':holeComplete(n)?'done':'pending'}" data-ledger-hole="${n}">${n}</button>`}).join('')}</div>
      ${v15HoleScoreStrip(h)}
      <div class="v18-bet-reason ${reason.active?'active':''}"><span>배판 사유</span><b>${escapeHtml(reason.text)}</b><em>${reason.mult>1?`×${reason.mult}`:'×1'}</em></div>
    </section>

    <section class="card v15-ledger-card current-hole-ledger v18-current-card">
      <div class="v15-section-title"><div class="v18-title-with-kind"><span class="v18-kind">당홀</span><h2>${h}번홀 정산</h2></div><span class="confirm-badge ${hole.L.complete?'done':''}">${hole.L.complete?'확정':'입력 대기'}</span></div>
      <div class="moneygrid">${state.room.players.map(p=>moneyCard(p,hole.net[p.id]||0)).join('')}</div>
    </section>

    <section class="card v15-ledger-card v18-current-sub"><div class="v15-section-title"><div class="v18-title-with-kind"><span class="v18-kind" style="background:#dcebe2;color:#315b43">당홀</span><h2>${h}번홀 · 상계 정산</h2></div></div>${v15Transfers(hole.transfers,'현재 당홀 정산할 금액이 없습니다.')}</section>

    <section class="card v15-ledger-card v18-total-card">
      <div class="v15-section-title"><div class="v18-title-with-kind"><span class="v18-kind">누적</span><h2>누적 정산</h2></div><span class="fs11 muted">${complete}/18H</span></div>
      <div class="moneygrid">${state.room.players.map(p=>moneyCard(p,cum.net[p.id]||0)).join('')}</div>
    </section>

    <section class="card v15-ledger-card v18-total-sub"><div class="v15-section-title"><div class="v18-title-with-kind"><span class="v18-kind" style="background:#e2e8ef;color:#415a73">누적</span><h2>상계 후 한번에 정산</h2></div><button id="copySummary" class="copybtn">결과 복사</button></div>${v15Transfers(cumTransfers,'현재 누적 정산할 금액이 없습니다.')}</section>

    <section class="card v15-ledger-card"><div class="v15-section-title"><h2>상대별 누적 원장</h2></div>${pairSummaryHTML(cum.pair)}</section>`;
};

function v18GoToEntryScreen(){
  if(!state.session?.host || !state.room) return;
  v18WriteHostResume();
  sessionStorage.setItem(V18_SKIP_AUTO_KEY,'1');
  if(state.unsub){state.unsub();state.unsub=null;}
  state.room=null;
  state.myPlayerId=null;
  state.viewerMode=false;
  state.loginVerified=false;
  state.tab='home';
  state.session=null;
  state.identity=null;
  localStorage.removeItem(roomStorageKey);
  localStorage.removeItem(identityStorageKey);
  render();
}

function v18DecorateHostHeader(){
  const top=$('.toprow');
  if(!top) return;
  top.querySelector('#v18EntryScreenBtn')?.remove();
  if(!(state.loginVerified && state.room && state.session?.host===true && !state.viewerMode)) return;
  v18WriteHostResume();
  sessionStorage.removeItem(V18_SKIP_AUTO_KEY);
  const b=document.createElement('button');
  b.id='v18EntryScreenBtn';
  b.className='v18-entry-btn';
  b.type='button';
  b.textContent='입장 화면';
  b.title='첫 로그인 화면으로 이동';
  b.addEventListener('click',v18GoToEntryScreen);
  top.appendChild(b);
}

const v18BaseRender=render;
render=function(){
  const result=v18BaseRender();
  v18DecorateHostHeader();
  return result;
};

// If the host deliberately went to the first screen and later signs in as host
// again, reuse the preserved in-progress ROOM when the name matches.
bindLogin=function(){
  const hostLogin=async()=>{
    const name=($('#loginName')?.value||'').trim();
    const pw=$('#loginPw')?.value||'';
    const msg=$('#loginMsg');
    if(!name){msg.innerHTML='<div class="notice error">호스트 이름을 입력하세요.</div>';return;}
    if(pw!==v12HostPassword()){
      msg.innerHTML='<div class="notice error">비밀번호가 맞지 않습니다.</div>';
      return;
    }

    const saved=v18ReadHostResume();
    state.viewerMode=false;
    state.identity={name};
    state.loginVerified=true;
    saveIdentity();

    if(saved?.roomCode && sameName(saved.identityName,name)){
      sessionStorage.removeItem(V18_SKIP_AUTO_KEY);
      state.session={roomCode:saved.roomCode,playerId:saved.playerId||'p1',host:true,identityName:name};
      saveSession();
      if(state.firebaseReady){
        await resumeSession();
        if(state.room){state.tab='round';render();return;}
      }
    }

    if(state.session?.viewer) clearRoomSession();
    render();
  };

  $('#loginBtn')?.addEventListener('click',hostLogin);
  $('#loginPw')?.addEventListener('keydown',e=>{if(e.key==='Enter')hostLogin();});
  $('#viewerJoinBtn')?.addEventListener('click',viewerJoinRoom);
  $('#viewerRoomCode')?.addEventListener('keydown',e=>{if(e.key==='Enter')viewerJoinRoom();});
};

document.documentElement.dataset.ledgerAccess='v18';
render();
