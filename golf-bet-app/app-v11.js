// v11 FINAL OVERRIDES
// 1) Host password = current Korea date YYYYMMDD
// 2) Companion name change => new ROOM + old game records cleared
// 3) Host can edit scores on any hole
// 4) Viewer score history = one line per hole
// 5) Host/viewer share same settlement screen
// 6) Settlement = current-hole + cumulative, each with netted minimal transfers

const v11PrevBindSetup = bindSetup;
const v11PrevBindRound = bindRound;
const v11PrevBindLedger = bindLedger;

function v11KoreaDatePassword(){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date());
  const p={};
  parts.forEach(x=>{if(x.type!=='literal')p[x.type]=x.value;});
  return `${p.year}${p.month}${p.day}`;
}

// ---------- LOGIN ----------
loginHTML=function(){
  const lastRoom=(localStorage.getItem(viewerRoomStorageKey)||'').toUpperCase();
  const live=state.firebaseReady;
  const err=state.firebaseError;
  return `
    <section class="card hero login-hero">
      <div class="fs12" style="opacity:.8;font-weight:900">LIVE GOLF LEDGER · V11</div>
      <h1>오늘 누가 쏴?</h1>
      <p>호스트가 4명의 점수를 입력하고, 동반자는 ROOM에서 본인 이름을 선택해 실시간 스코어와 정산을 확인합니다.</p>
    </section>

    <section class="card viewer-entry">
      <h2>동반자 입장</h2>
      <div class="sub">호스트에게 받은 ROOM 코드를 입력한 뒤 <b>내 이름을 선택</b>하세요.</div>
      <div class="join-big">
        <input id="viewerRoomCode" value="${escapeHtml(lastRoom)}" placeholder="ROOM CODE" maxlength="8" autocomplete="off" style="text-transform:uppercase">
        <button id="viewerJoinBtn" class="btn primary" ${live?'':'disabled'}>${live?'ROOM 확인':'서버 연결 확인 중'}</button>
      </div>
      <div id="viewerJoinMsg" class="mt8"></div>
    </section>

    <section class="card host-login-card">
      <h2>호스트 로그인</h2>
      <div class="notice success"><b>호스트 비밀번호 = 한국시간 오늘 날짜 8자리</b><br>예: 2026년 8월 31일 → <b>20260831</b></div>
      <div class="stack">
        <div><label>호스트 이름</label><input id="loginName" maxlength="10" autocomplete="username" placeholder="예: 진우" value="${escapeHtml(identityName())}"></div>
        <div><label>오늘 날짜 비밀번호</label><input id="loginPw" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password" placeholder="YYYYMMDD"></div>
        <button id="loginBtn" class="btn secondary block">호스트로 로그인</button>
        <div id="loginMsg"></div>
      </div>
    </section>

    ${!live?`<div class="notice error"><b>실시간 서버 연결 안 됨</b><br>${escapeHtml(err||'Firebase 연결을 확인하는 중입니다. 잠시 후 새로고침해 주세요.')}</div>`:''}`;
};

bindLogin=function(){
  const hostLogin=async()=>{
    const name=($('#loginName')?.value||'').trim();
    const pw=$('#loginPw')?.value||'';
    const msg=$('#loginMsg');
    if(!name){msg.innerHTML='<div class="notice error">호스트 이름을 입력하세요.</div>';return;}
    if(pw!==v11KoreaDatePassword()){
      msg.innerHTML='<div class="notice error">비밀번호가 맞지 않습니다. 한국시간 오늘 날짜 8자리를 입력하세요. 예: 20260831</div>';
      return;
    }
    state.viewerMode=false;
    state.identity={name};
    state.loginVerified=true;
    saveIdentity();
    if(state.session?.host===true&&state.session?.roomCode) await resumeSession();
    else if(state.session?.viewer) clearRoomSession();
    render();
  };
  $('#loginBtn')?.addEventListener('click',hostLogin);
  $('#loginPw')?.addEventListener('keydown',e=>{if(e.key==='Enter')hostLogin();});
  $('#viewerJoinBtn')?.addEventListener('click',viewerJoinRoom);
  $('#viewerRoomCode')?.addEventListener('keydown',e=>{if(e.key==='Enter')viewerJoinRoom();});
};

// ---------- LINEUP CHANGE => NEW ROOM ----------
function v11EnsurePlayerBaseline(){
  if(state.v11BaselineRoom!==state.room?.code){
    state.v11BaselineRoom=state.room?.code||'';
    state.v11PlayerBaseline=(state.room?.players||[]).map(p=>p.name);
  }
}

playersSetupHTML=function(editable){
  v11EnsurePlayerBaseline();
  return `<section class="card">
    <h2>플레이어 4명</h2>
    <div class="sub">호스트는 고정입니다. <b>동반자 이름이 한 명이라도 바뀌면 새 ROOM 코드가 생성되고 기존 게임 기록은 삭제</b>됩니다.</div>
    <div class="stack">
      ${state.room.players.map((p,i)=>`<div class="playerset"><div class="avatar">${i+1}</div><div><input class="playerNameInput" data-id="${p.id}" value="${escapeHtml(p.name)}" maxlength="10" ${editable&&i>0?'':'readonly'}><div class="fs12 muted mt8">${i===0?'● 호스트 · 변경 불가':'○ 동반자 · 변경 가능'}</div></div></div>`).join('')}
    </div>
    <button id="changeCompanionsBtn" class="btn primary block" ${editable?'':'disabled'}>동반자 변경 적용 · 새 ROOM 생성</button>
    <div class="sub mb0" style="margin-top:9px">이름이 실제로 바뀐 경우에만 새 ROOM을 생성합니다. 새 코드가 생성되면 동반자에게 다시 공유하세요.</div>
  </section>`;
};

async function v11ChangeCompanions(){
  if(!isHost()||state.busy)return;
  v11EnsurePlayerBaseline();
  const inputs=$$('.playerNameInput');
  const names=inputs.map(x=>(x.value||'').trim());
  names[0]=identityName();
  if(names.length!==4||names.some(n=>!n)){toast('플레이어 이름 4명을 모두 입력하세요.');return;}
  if(!uniquePlayerNames(names)){toast('플레이어 이름은 서로 달라야 합니다.');return;}
  const baseline=state.v11PlayerBaseline||state.room.players.map(p=>p.name);
  if(names.every((n,i)=>n===baseline[i])){toast('변경된 동반자 이름이 없습니다.');return;}
  if(!confirm('동반자를 변경할까요?\n\n한 명이라도 변경되면 새 ROOM 코드가 생성되고 기존 게임의 모든 스코어·정산 기록은 삭제됩니다.'))return;

  const oldRoom=state.room;
  const oldCode=oldRoom.code;
  const room=newRoom(names);
  room.title=oldRoom.title;
  room.pars=clone(oldRoom.pars);
  room.rules=clone(oldRoom.rules);
  room.status='active';
  room.players[0].claimedBy=state.uid;
  room.currentHole=1;
  room.scores=emptyHoleState();
  room.confirmed=emptyHoleState();
  room.manualDouble={};
  room.gameStartedAt=Date.now();

  state.busy=true;
  try{
    const {doc,setDoc,updateDoc}=state.fx;
    await setDoc(doc(state.db,'rooms',room.code),room);
    // Delete game records from the old room and mark it replaced.
    await updateDoc(doc(state.db,'rooms',oldCode),{
      scores:emptyHoleState(),
      confirmed:emptyHoleState(),
      manualDouble:{},
      currentHole:1,
      status:'replaced',
      replacedBy:room.code,
      replacedAt:Date.now(),
      updatedAt:Date.now()
    });
    if(state.unsub){state.unsub();state.unsub=null;}
    state.room=room;
    state.myPlayerId='p1';
    state.session={roomCode:room.code,playerId:'p1',host:true,identityName:identityName()};
    saveSession();
    saveBinding(room.code,'p1');
    state.v11BaselineRoom=room.code;
    state.v11PlayerBaseline=names.slice();
    state.tab='round';
    subscribeRoom(room.code);
    render();
    alert(`새 동반자 ROOM 생성 완료\n\n새 ROOM 코드: ${room.code}\n\n기존 게임 기록은 초기화되었습니다.`);
  }catch(e){
    toast(`동반자 변경 실패: ${e?.message||e}`);
  }finally{
    state.busy=false;
  }
}

bindSetup=function(){
  v11PrevBindSetup();
  $('#changeCompanionsBtn')?.addEventListener('click',v11ChangeCompanions);
};

// ---------- EDIT ANY HOLE ----------
canEditPlayer=function(){return isHost();};

setScore=async function(playerId,v){
  if(!isHost()||state.busy)return;
  const h=currentHole();
  const prev=scoreOf(h,playerId);
  const prevConfirmed=isConfirmed(h,playerId);
  state.busy=true;
  setScoreLocal(h,playerId,v);
  // Editing any confirmed hole re-opens settlement for that hole.
  setConfirmedLocal(h,playerId,false);
  render();
  try{
    await persistRoom({
      [`scores.h${h}.${playerId}`]:v,
      [`confirmed.h${h}.${playerId}`]:false,
      updatedAt:Date.now()
    });
  }catch(e){
    setScoreLocal(h,playerId,prev);
    setConfirmedLocal(h,playerId,prevConfirmed);
    toast('스코어 수정 저장에 실패했습니다. 인터넷 연결을 확인해 주세요.');
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
    <div class="scoretop"><div><div class="pname">${escapeHtml(p.name)}</div><div class="psub">${Number.isFinite(v)?desc:'아직 미입력'} · 누적 ${cumulativeToPar(p.id).holes?parLabel(cumulativeToPar(p.id).diff):'–'}</div></div><div class="score-number">${Number.isFinite(v)?v:'-'}</div>${badge}</div>
    ${editable?`<div class="score-actions">${[-1,0,1,2,3].map(d=>{const sv=par+d,label=d===-1?'버디':d===0?'파':d===1?'보기':d===2?'더블':'트리플';return `<button class="score-choice ${v===sv?'on':''}" data-qplayer="${p.id}" data-score="${sv}" ${state.busy?'disabled':''}>${label}</button>`}).join('')}<button class="score-choice other" data-other="${p.id}" ${state.busy?'disabled':''}>기타</button></div>`:''}
  </div>`;
};

function v11HostRoundHTML(){
  const h=currentHole(),par=state.room.pars[h-1],L=holeLedger(h),complete=holeComplete(h);
  const allTie=L.allTie===true;
  const prevAllTie=h>1&&(state.room.rules.allTieCarry!==false)&&allTieHole(h-1);
  const triggers=state.room.rules.doubleTiming==='current'?triggerInfo(h):(h>1?triggerInfo(h-1):[]);
  const displayTriggers=[...(prevAllTie?['전 홀 전원 동타 이월']:[]),...triggers];
  const triggerText=allTie?(h<18?'전원 동타 · 이번 홀 0원 · 다음 홀 ×2':'전원 동타 · 이번 홀 0원'):(displayTriggers.length?`배판: ${[...new Set(displayTriggers)].join(' · ')}`:'배판 조건 없음');
  const entered=enteredScoreCount(h);
  return `<div class="statusbar"><div class="names">${state.room.players.map(p=>{const c=cumulativeToPar(p.id);return `<span class="tinyplayer">${escapeHtml(p.name)}<b>${c.holes?parLabel(c.diff):'–'}</b></span>`}).join('')}</div><div class="roundprogress">${completedCount()}/18H</div></div>
    <section class="card holehero"><div class="holehead"><div><div class="par">PAR ${par}</div><div class="holeid">${h} HOLE</div></div><div class="mult ${allTie||L.mult===1?'normal':''}">${allTie?'0원':`× ${L.mult}`}</div></div><div class="trigger">${triggerText}</div></section>
    <section class="card scorecard"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">4명 스코어</h2><span class="fs12 ${complete?'plus':'muted'}">${complete?'● 확정 · 수정 가능':`${entered}/4 입력`}</span></div>
      ${state.room.players.map(p=>scoreRowHTML(h,p,par)).join('')}
      <button id="confirmAllScores" class="btn primary block confirm-all" ${(entered!==4||complete||state.busy)?'disabled':''}>${complete?'✓ 4명 입력완료':state.busy?'저장 중...':'4명 입력완료'}</button>
      <div class="sub center mb0" style="margin-top:8px">완료된 과거 홀도 아래 홀 번호를 눌러 수정할 수 있습니다. 점수를 바꾸면 그 홀은 다시 열리고 `4명 입력완료`를 눌러 재확정합니다.</div>
      ${state.room.rules.manualTriggerEnabled?`<div class="switchrow" style="padding:10px 0 1px;margin-top:4px"><div class="switchcopy"><strong>기타 사유 배판</strong><span>OB 등 수동 조건</span></div><label class="switch"><input id="manualDouble" type="checkbox" ${state.room.manualDouble?.[`h${h}`]?'checked':''}><span class="slider"></span></label></div>`:''}
      ${complete?`<div class="score-summary">${state.room.players.map(p=>{const n=L.net[p.id]||0;return `<div><span>${escapeHtml(p.name)}</span><strong class="${n>0?'plus':n<0?'minus':'zero'}">${signed(n)}</strong></div>`}).join('')}</div>`:''}
    </section>
    <section class="card roundnav"><div class="roundnavtop"><button id="prevHole" class="btn ghost small" ${h===1?'disabled':''}>← 이전</button><b>${h}/18</b><button id="nextHole" class="btn secondary small" ${h===18?'disabled':''}>다음 →</button></div><div class="holetrack">${Array.from({length:18},(_,i)=>{const n=i+1;return `<button class="hchip ${n===h?'current':holeComplete(n)?'done':'pending'}" data-hole="${n}">${n}</button>`}).join('')}</div></section>`;
}

// ---------- COMPACT VIEWER HISTORY ----------
personalHistoryHTML=function(id){
  const rows=[];
  for(let h=1;h<=18;h++){
    if(!holeComplete(h))continue;
    const s=scoreOf(h,id),par=state.room.pars[h-1];
    if(!Number.isFinite(s))continue;
    const d=s-par;
    const rel=d===0?'E':d>0?`+${d}`:`${d}`;
    rows.push(`<div class="v11-history-line"><b>${h}H</b><span>PAR ${par}</span><strong>${s}타</strong><em>${classify(s,par)} ${rel}</em></div>`);
  }
  return rows.length?`<div class="v11-history">${rows.join('')}</div>`:`<div class="center muted fs12" style="padding:12px 0">아직 확정된 홀이 없습니다.</div>`;
};

// Keep personal viewer round, but it will now render compact one-line history via personalHistoryHTML().
roundHTML=function(){
  return state.viewerMode?personalViewerRoundHTML():v11HostRoundHTML();
};

// ---------- SAME SETTLEMENT FOR HOST + VIEWER ----------
function v11CurrentHoleSettlement(){
  const h=currentHole();
  const L=holeLedger(h);
  const net=L.complete?L.net:Object.fromEntries(state.room.players.map(p=>[p.id,0]));
  return {h,L,net,transfers:L.complete?minimalTransfers(net):[]};
}

ledgerHTML=function(){
  const hole=v11CurrentHoleSettlement();
  const cum=cumulativeLedger(18);
  const cumulativeTransfers=minimalTransfers(cum.net);
  const complete=completedCount();
  return `${state.viewerMode?viewerRefreshBar():''}
    <section class="card current-hole-ledger">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px"><div><div class="fs12 muted">CURRENT HOLE</div><h2 style="margin:3px 0 0">${hole.h}번홀 당홀 정산</h2></div><span class="confirm-badge ${hole.L.complete?'done':''}">${hole.L.complete?'확정':'입력 대기'}</span></div>
      <div class="moneygrid mt12">${state.room.players.map(p=>moneyCard(p,hole.net[p.id]||0)).join('')}</div>
      <div class="sub mt12 mb0">${hole.L.complete?'현재 선택된 홀의 확정 금액입니다.':'4명 입력완료 후 당홀 금액이 표시됩니다.'}</div>
    </section>

    <section class="card"><h2>${hole.h}번홀 · 상계 후 한번에 정산</h2><div class="sub">당홀의 모든 주고받을 돈을 상계해 최소 송금만 표시합니다.</div>
      ${hole.transfers.length?hole.transfers.map(t=>`<div class="transfer"><div class="who"><b>${escapeHtml(getPlayer(t.from).name)}</b> <span class="arrow">→</span> <b>${escapeHtml(getPlayer(t.to).name)}</b></div><strong>${fmt(t.amt)}</strong></div>`).join(''):'<div class="center muted fs12" style="padding:12px 0">현재 당홀 정산할 금액이 없습니다.</div>'}
    </section>

    <section class="card"><div style="display:flex;justify-content:space-between;align-items:start;gap:10px"><div><div class="fs12 muted">TOTAL</div><h2 style="margin:3px 0 0">누적 정산</h2></div><button id="copySummary" class="copybtn">결과 복사</button></div>
      <div class="moneygrid mt12">${state.room.players.map(p=>moneyCard(p,cum.net[p.id]||0)).join('')}</div><div class="sub mt12 mb0">${complete}/18홀 확정 기준</div>
    </section>

    <section class="card"><h2>누적 · 상계 후 한번에 정산</h2><div class="sub">지금까지 완료된 모든 홀의 금액을 합친 뒤 상계한 최종 송금안입니다.</div>
      ${cumulativeTransfers.length?cumulativeTransfers.map(t=>`<div class="transfer"><div class="who"><b>${escapeHtml(getPlayer(t.from).name)}</b> <span class="arrow">→</span> <b>${escapeHtml(getPlayer(t.to).name)}</b></div><strong>${fmt(t.amt)}</strong></div>`).join(''):'<div class="center muted fs12" style="padding:12px 0">현재 누적 정산할 금액이 없습니다.</div>'}
    </section>

    <section class="card"><h2>상대별 누적 원장</h2>${pairSummaryHTML(cum.pair)}</section>`;
};

summaryText=function(){
  const hole=v11CurrentHoleSettlement();
  const cum=cumulativeLedger(18);
  const cumTransfers=minimalTransfers(cum.net);
  return `[${state.room.title}] 골프 정산\nROOM ${state.room.code}\n\n[${hole.h}번홀 당홀]\n`+
    state.room.players.map(p=>`${p.name}: ${signed(hole.net[p.id]||0)}`).join('\n')+
    `\n\n[${hole.h}번홀 상계]\n`+(hole.transfers.length?hole.transfers.map(t=>`${getPlayer(t.from).name} → ${getPlayer(t.to).name}: ${fmt(t.amt)}`).join('\n'):'정산 없음')+
    `\n\n[누적]\n`+state.room.players.map(p=>`${p.name}: ${signed(cum.net[p.id]||0)}`).join('\n')+
    `\n\n[누적 상계]\n`+(cumTransfers.length?cumTransfers.map(t=>`${getPlayer(t.from).name} → ${getPlayer(t.to).name}: ${fmt(t.amt)}`).join('\n'):'정산 없음');
};

bindLedger=function(){
  v11PrevBindLedger();
  $('#viewerRefreshBtn')?.addEventListener('click',refreshViewerRoom);
  $('#copySummary')?.addEventListener('click',()=>copyText(summaryText(),'정산 결과가 복사되었습니다.'));
};

bindRound=function(){
  v11PrevBindRound();
};

// Repaint once with the final v11 functions.
render();
