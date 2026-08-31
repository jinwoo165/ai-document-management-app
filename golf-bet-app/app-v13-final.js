// v13 FINAL GAME WORKFLOW
// Loaded on /golf-bet-live/ after the stable base scripts and v12 login.
// Host: replace companions / regenerate ROOM / edit any hole.
// Viewer: compact score history. Settlement screen is identical for host and viewers.

const v13BaseBindSetup = bindSetup;
const v13BaseBindLedger = bindLedger;

function v13EmptyHoles(){
  return Object.fromEntries(Array.from({length:18},(_,i)=>[`h${i+1}`,{}]));
}

// ------------------------------------------------------------------
// HOST - PLAYER CHANGE / ROOM REGENERATION
// ------------------------------------------------------------------
function v13Baseline(){
  if(state.v13BaselineRoom!==state.room?.code){
    state.v13BaselineRoom=state.room?.code||'';
    state.v13BaselineNames=(state.room?.players||[]).map(p=>p.name);
  }
  return state.v13BaselineNames||[];
}

playersSetupHTML=function(editable){
  const baseline=v13Baseline();
  return `<section class="card">
    <h2>플레이어 4명</h2>
    <div class="sub">호스트는 고정입니다. 동반자 이름을 바꾼 뒤 적용하면 <b>새 ROOM 코드가 생성되고 기존 게임 기록은 모두 초기화</b>됩니다.</div>
    <div class="stack">
      ${state.room.players.map((p,i)=>`<div class="playerset">
        <div class="avatar">${i+1}</div>
        <div>
          <input class="playerNameInput" data-id="${p.id}" value="${escapeHtml(p.name)}" maxlength="10" ${editable&&i>0?'':'readonly'}>
          <div class="fs12 muted mt8">${i===0?'● 호스트 · 변경 불가':baseline[i]===p.name?'○ 동반자':'● 이름 변경됨'}</div>
        </div>
      </div>`).join('')}
    </div>
    ${editable?`<div class="stack mt12">
      <button id="applyCompanionChange" class="btn primary block">동반자 변경 적용 · 새 ROOM 생성</button>
      <button id="regenerateRoomCode" class="btn secondary block">↻ ROOM 코드 재생성</button>
    </div>
    <div class="sub mb0" style="margin-top:9px">`+`ROOM 코드 재생성`+`은 이름이 그대로여도 새 코드로 바꾸고 현재 게임 기록을 초기화합니다.</div>`:''}
  </section>`;
};

function v13NamesFromInputs(){
  const inputs=$$('.playerNameInput');
  if(inputs.length!==4)return state.room.players.map(p=>p.name);
  const names=inputs.map(x=>(x.value||'').trim());
  names[0]=identityName();
  return names;
}

async function v13CreateReplacementRoom(names,mode){
  if(!isHost()||state.busy)return;
  if(!state.firebaseReady){toast('실시간 서버 연결 후 사용할 수 있습니다.');return;}
  if(names.some(n=>!n)){toast('플레이어 이름 4명을 모두 입력하세요.');return;}
  if(!uniquePlayerNames(names)){toast('플레이어 이름은 서로 달라야 합니다.');return;}

  const oldRoom=state.room;
  const oldCode=oldRoom.code;
  let room=newRoom(names);
  while(room.code===oldCode)room=newRoom(names);
  room.title=oldRoom.title;
  room.pars=clone(oldRoom.pars);
  room.rules=clone(oldRoom.rules);
  room.status='active';
  room.players[0].claimedBy=state.uid;
  room.currentHole=1;
  room.scores=v13EmptyHoles();
  room.confirmed=v13EmptyHoles();
  room.manualDouble={};
  room.createdAt=Date.now();
  room.updatedAt=Date.now();

  state.busy=true;
  try{
    const {doc,setDoc,updateDoc}=state.fx;
    await setDoc(doc(state.db,'rooms',room.code),room);
    await updateDoc(doc(state.db,'rooms',oldCode),{
      scores:v13EmptyHoles(),
      confirmed:v13EmptyHoles(),
      manualDouble:{},
      currentHole:1,
      status:'replaced',
      replacedBy:room.code,
      replacedAt:Date.now(),
      replacementMode:mode,
      updatedAt:Date.now()
    });

    if(state.unsub){state.unsub();state.unsub=null;}
    state.room=room;
    state.myPlayerId='p1';
    state.session={roomCode:room.code,playerId:'p1',host:true,identityName:identityName()};
    state.setupDirty=false;
    state.v13BaselineRoom=room.code;
    state.v13BaselineNames=names.slice();
    saveSession();
    saveBinding(room.code,'p1');
    state.tab='round';
    subscribeRoom(room.code);
    render();
    alert(`새 ROOM 코드: ${room.code}\n\n기존 게임 기록은 초기화되었습니다.\n동반자에게 새 ROOM 코드를 알려주세요.`);
  }catch(e){
    toast(`ROOM 재생성 실패: ${e?.message||String(e)}`);
  }finally{
    state.busy=false;
  }
}

async function v13ApplyCompanionChange(){
  const names=v13NamesFromInputs();
  const baseline=v13Baseline();
  if(names.every((n,i)=>n===baseline[i])){
    toast('변경된 동반자 이름이 없습니다.');
    return;
  }
  if(!confirm('동반자를 변경할까요?\n\n새 ROOM 코드가 생성되고 기존 스코어·정산 기록은 모두 삭제됩니다.'))return;
  await v13CreateReplacementRoom(names,'companion-change');
}

async function v13RegenerateCode(){
  const names=v13NamesFromInputs();
  if(!confirm('ROOM 코드를 새로 만들까요?\n\n플레이어 이름이 같아도 새 ROOM 코드가 생성되고 기존 스코어·정산 기록은 모두 삭제됩니다.'))return;
  await v13CreateReplacementRoom(names,'code-regenerate');
}

bindSetup=function(){
  v13BaseBindSetup();
  $('#applyCompanionChange')?.addEventListener('click',v13ApplyCompanionChange);
  $('#regenerateRoomCode')?.addEventListener('click',v13RegenerateCode);
};

// ------------------------------------------------------------------
// HOST - EDIT SCORES ON ANY HOLE
// ------------------------------------------------------------------
canEditPlayer=function(){return isHost();};

setScore=async function(playerId,v){
  if(!isHost()||state.busy)return;
  const h=currentHole();
  const prev=scoreOf(h,playerId);
  const previousConfirmed=Object.fromEntries(state.room.players.map(p=>[p.id,isConfirmed(h,p.id)]));

  // When a completed hole is edited, reopen the whole hole so it must be
  // explicitly confirmed once again with the single 4-player confirm button.
  state.room.players.forEach(p=>setConfirmedLocal(h,p.id,false));
  setScoreLocal(h,playerId,v);
  state.busy=true;
  render();

  const patch={updatedAt:Date.now(),[`scores.h${h}.${playerId}`]:v};
  state.room.players.forEach(p=>patch[`confirmed.h${h}.${p.id}`]=false);
  try{
    await persistRoom(patch);
  }catch(e){
    setScoreLocal(h,playerId,prev);
    state.room.players.forEach(p=>setConfirmedLocal(h,p.id,previousConfirmed[p.id]));
    toast('스코어 수정 저장에 실패했습니다.');
  }finally{
    state.busy=false;
    render();
  }
};

scoreRowHTML=function(h,p,par){
  const v=scoreOf(h,p.id);
  const editable=isHost();
  const desc=classify(v,par);
  const complete=holeComplete(h);
  const badge=complete?'<span class="confirm-badge done">확정</span>':Number.isFinite(v)?'<span class="confirm-badge draft">입력됨</span>':'<span class="confirm-badge">대기</span>';
  return `<div class="scorerow">
    <div class="scoretop">
      <div><div class="pname">${escapeHtml(p.name)}</div><div class="psub">${Number.isFinite(v)?desc:'아직 미입력'} · 누적 ${cumulativeToPar(p.id).holes?parLabel(cumulativeToPar(p.id).diff):'–'}</div></div>
      <div class="score-number">${Number.isFinite(v)?v:'-'}</div>${badge}
    </div>
    ${editable?`<div class="score-actions">
      ${[-1,0,1,2,3].map(d=>{const sv=par+d,label=d===-1?'버디':d===0?'파':d===1?'보기':d===2?'더블':'트리플';return `<button class="score-choice ${v===sv?'on':''}" data-qplayer="${p.id}" data-score="${sv}" ${state.busy?'disabled':''}>${label}</button>`}).join('')}
      <button class="score-choice other" data-other="${p.id}" ${state.busy?'disabled':''}>기타</button>
    </div>`:''}
  </div>`;
};

function v13HostRoundHTML(){
  const h=currentHole(),par=state.room.pars[h-1],L=holeLedger(h),complete=holeComplete(h);
  const allTie=L.allTie===true;
  const prevAllTie=h>1&&(state.room.rules.allTieCarry!==false)&&allTieHole(h-1);
  const triggers=state.room.rules.doubleTiming==='current'?triggerInfo(h):(h>1?triggerInfo(h-1):[]);
  const displayTriggers=[...(prevAllTie?['전 홀 전원 동타 이월']:[]),...triggers];
  const triggerText=allTie?(h<18?'전원 동타 · 이번 홀 0원 · 다음 홀 ×2':'전원 동타 · 이번 홀 0원'):(displayTriggers.length?`배판: ${[...new Set(displayTriggers)].join(' · ')}`:'배판 조건 없음');
  const entered=enteredScoreCount(h);
  return `<div class="statusbar"><div class="names">${state.room.players.map(p=>{const c=cumulativeToPar(p.id);return `<span class="tinyplayer">${escapeHtml(p.name)}<b>${c.holes?parLabel(c.diff):'–'}</b></span>`}).join('')}</div><div class="roundprogress">${completedCount()}/18H</div></div>
    <section class="card holehero"><div class="holehead"><div><div class="par">PAR ${par}</div><div class="holeid">${h} HOLE</div></div><div class="mult ${allTie||L.mult===1?'normal':''}">${allTie?'0원':`× ${L.mult}`}</div></div><div class="trigger">${triggerText}</div></section>
    <section class="card scorecard">
      <div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">4명 스코어</h2><span class="fs12 ${complete?'plus':'muted'}">${complete?'● 확정 · 수정 가능':`${entered}/4 입력`}</span></div>
      ${state.room.players.map(p=>scoreRowHTML(h,p,par)).join('')}
      <button id="confirmAllScores" class="btn primary block confirm-all" ${(entered!==4||complete||state.busy)?'disabled':''}>${complete?'✓ 4명 입력완료':state.busy?'저장 중...':'4명 입력완료'}</button>
      <div class="sub center mb0" style="margin-top:8px">1~18홀 어느 홀이나 다시 선택해 수정할 수 있습니다. 수정하면 해당 홀의 확정이 풀리고, `+`4명 입력완료`+`를 다시 누르면 금액이 재계산됩니다.</div>
      ${state.room.rules.manualTriggerEnabled?`<div class="switchrow" style="padding:10px 0 1px;margin-top:4px"><div class="switchcopy"><strong>기타 사유 배판</strong><span>OB 등 수동 조건</span></div><label class="switch"><input id="manualDouble" type="checkbox" ${state.room.manualDouble?.[`h${h}`]?'checked':''}><span class="slider"></span></label></div>`:''}
      ${complete?`<div class="score-summary">${state.room.players.map(p=>{const n=L.net[p.id]||0;return `<div><span>${escapeHtml(p.name)}</span><strong class="${n>0?'plus':n<0?'minus':'zero'}">${signed(n)}</strong></div>`}).join('')}</div>`:''}
    </section>
    <section class="card roundnav">
      <div class="roundnavtop"><button id="prevHole" class="btn ghost small" ${h===1?'disabled':''}>← 이전</button><b>${h}/18</b><button id="nextHole" class="btn secondary small" ${h===18?'disabled':''}>다음 →</button></div>
      <div class="holetrack">${Array.from({length:18},(_,i)=>{const n=i+1;return `<button class="hchip ${n===h?'current':holeComplete(n)?'done':'pending'}" data-hole="${n}">${n}</button>`}).join('')}</div>
    </section>`;
}

// Host uses the editable round. Viewer keeps the personal realtime round.
roundHTML=function(){
  return state.viewerMode?personalViewerRoundHTML():v13HostRoundHTML();
};

// ------------------------------------------------------------------
// VIEWER - COMPACT ONE-LINE SCORE HISTORY
// ------------------------------------------------------------------
personalHistoryHTML=function(id){
  const rows=[];
  for(let h=1;h<=18;h++){
    if(!holeComplete(h))continue;
    const s=scoreOf(h,id),par=state.room.pars[h-1];
    if(!Number.isFinite(s))continue;
    const d=s-par;
    const rel=d===0?'E':d>0?`+${d}`:`${d}`;
    rows.push(`<div class="v13-score-line"><b>${h}H</b><span>PAR ${par}</span><strong>${s}타</strong><em>${classify(s,par)} ${rel}</em></div>`);
  }
  return rows.length?`<div class="v13-score-history">${rows.join('')}</div>`:`<div class="center muted fs12" style="padding:10px 0">아직 확정된 홀이 없습니다.</div>`;
};

// ------------------------------------------------------------------
// SAME SETTLEMENT SCREEN FOR HOST & VIEWER
// CURRENT-HOLE + CUMULATIVE + MINIMAL NETTED TRANSFERS
// ------------------------------------------------------------------
function v13LedgerHole(){
  const h=Number(state.v13LedgerHole||currentHole());
  return clamp(h,1,18);
}

function v13HoleSettlement(h){
  const L=holeLedger(h);
  const net=L.complete?L.net:Object.fromEntries(state.room.players.map(p=>[p.id,0]));
  return {L,net,transfers:L.complete?minimalTransfers(net):[]};
}

function v13TransferHTML(list,emptyText){
  return list.length?list.map(t=>`<div class="transfer"><div class="who"><b>${escapeHtml(getPlayer(t.from).name)}</b> <span class="arrow">→</span> <b>${escapeHtml(getPlayer(t.to).name)}</b></div><strong>${fmt(t.amt)}</strong></div>`).join(''):`<div class="center muted fs12" style="padding:12px 0">${emptyText}</div>`;
}

ledgerHTML=function(){
  const h=v13LedgerHole();
  const hole=v13HoleSettlement(h);
  const cum=cumulativeLedger(18);
  const cumulativeTransfers=minimalTransfers(cum.net);
  const complete=completedCount();
  return `${state.viewerMode?viewerRefreshBar():''}
    <section class="card ledger-hole-picker">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 style="margin:0">당홀 선택</h2><b>${h}H</b></div>
      <div class="holetrack ledger-holetrack">${Array.from({length:18},(_,i)=>{const n=i+1;return `<button class="hchip ${n===h?'current':holeComplete(n)?'done':'pending'}" data-ledger-hole="${n}">${n}</button>`}).join('')}</div>
    </section>

    <section class="card current-hole-ledger">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px"><div><div class="fs12 muted">CURRENT HOLE</div><h2 style="margin:3px 0 0">${h}번홀 당홀 정산</h2></div><span class="confirm-badge ${hole.L.complete?'done':''}">${hole.L.complete?'확정':'입력 대기'}</span></div>
      <div class="moneygrid mt12">${state.room.players.map(p=>moneyCard(p,hole.net[p.id]||0)).join('')}</div>
      <div class="sub mt12 mb0">${hole.L.complete?'선택한 홀의 확정 금액입니다.':'4명 입력완료 후 당홀 금액이 표시됩니다.'}</div>
    </section>

    <section class="card">
      <h2>${h}번홀 · 상계 정산</h2>
      <div class="sub">이 홀의 주고받을 금액을 상계해 실제로 필요한 최소 송금만 표시합니다.</div>
      ${v13TransferHTML(hole.transfers,'현재 당홀 정산할 금액이 없습니다.')}
    </section>

    <section class="card">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px"><div><div class="fs12 muted">TOTAL</div><h2 style="margin:3px 0 0">누적 정산</h2></div><button id="copySummary" class="copybtn">결과 복사</button></div>
      <div class="moneygrid mt12">${state.room.players.map(p=>moneyCard(p,cum.net[p.id]||0)).join('')}</div>
      <div class="sub mt12 mb0">${complete}/18홀 확정 기준</div>
    </section>

    <section class="card">
      <h2>누적 · 상계 후 한번에 정산</h2>
      <div class="sub">완료된 모든 홀의 주고받을 돈을 전부 상계해 한 번에 정산할 최종 송금안입니다.</div>
      ${v13TransferHTML(cumulativeTransfers,'현재 누적 정산할 금액이 없습니다.')}
    </section>

    <section class="card"><h2>상대별 누적 원장</h2>${pairSummaryHTML(cum.pair)}</section>`;
};

summaryText=function(){
  const h=v13LedgerHole(),hole=v13HoleSettlement(h),cum=cumulativeLedger(18),ct=minimalTransfers(cum.net);
  return `[${state.room.title}] 골프 정산\nROOM ${state.room.code}\n\n[${h}번홀 당홀]\n`+
    state.room.players.map(p=>`${p.name}: ${signed(hole.net[p.id]||0)}`).join('\n')+
    `\n\n[${h}번홀 상계]\n`+(hole.transfers.length?hole.transfers.map(t=>`${getPlayer(t.from).name} → ${getPlayer(t.to).name}: ${fmt(t.amt)}`).join('\n'):'정산 없음')+
    `\n\n[누적]\n`+state.room.players.map(p=>`${p.name}: ${signed(cum.net[p.id]||0)}`).join('\n')+
    `\n\n[누적 상계]\n`+(ct.length?ct.map(t=>`${getPlayer(t.from).name} → ${getPlayer(t.to).name}: ${fmt(t.amt)}`).join('\n'):'정산 없음');
};

bindLedger=function(){
  v13BaseBindLedger();
  $$('[data-ledger-hole]').forEach(b=>b.addEventListener('click',()=>{
    state.v13LedgerHole=+b.dataset.ledgerHole;
    render();
  }));
  $('#viewerRefreshBtn')?.addEventListener('click',refreshViewerRoom);
  $('#copySummary')?.addEventListener('click',()=>copyText(summaryText(),'정산 결과가 복사되었습니다.'));
};

document.documentElement.dataset.golfWorkflow='v13';
render();
