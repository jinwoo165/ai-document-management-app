// v10: date password, lineup replacement, previous-hole editing, compact history, unified/monthly settlement.

const v10BaseBindSetup = bindSetup;
const v10BaseBindRound = bindRound;
const v10BaseBindLedger = bindLedger;
const v10BaseCreateRoom = createRoom;

function kstParts(ts=Date.now()){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date(ts));
  const out={};
  parts.forEach(p=>{if(p.type!=='literal')out[p.type]=p.value;});
  return {year:out.year,month:out.month,day:out.day};
}
function kstDateKey(ts=Date.now()){
  const p=kstParts(ts);return `${p.year}${p.month}${p.day}`;
}
function kstMonthKey(ts=Date.now()){
  const p=kstParts(ts);return `${p.year}${p.month}`;
}
function kstMonthLabel(monthKey=kstMonthKey()){
  return `${monthKey.slice(0,4)}년 ${Number(monthKey.slice(4,6))}월`;
}
function hostPasswordToday(){return kstDateKey();}

loginHTML=function(){
  const lastRoom=(localStorage.getItem(viewerRoomStorageKey)||'').toUpperCase();
  const live=state.firebaseReady,err=state.firebaseError;
  return `
    <section class="card hero login-hero">
      <div class="fs12" style="opacity:.8;font-weight:900">LIVE GOLF LEDGER</div>
      <h1>오늘 누가 쏴?</h1>
      <p>호스트가 4명의 점수를 입력합니다. 동반자는 ROOM에 들어와 본인 이름을 선택하면 개인 스코어와 전체 정산을 실시간으로 확인합니다.</p>
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
      <div class="sub">호스트 비밀번호는 <b>한국시간 오늘 날짜 8자리(YYYYMMDD)</b>입니다. 날짜가 바뀌면 비밀번호도 자동으로 바뀝니다.</div>
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
    const name=($('#loginName')?.value||'').trim(),pw=$('#loginPw')?.value||'',msg=$('#loginMsg');
    if(!name){msg.innerHTML='<div class="notice error">호스트 이름을 입력하세요.</div>';return;}
    if(pw!==hostPasswordToday()){
      msg.innerHTML='<div class="notice error">호스트 비밀번호가 맞지 않습니다. 한국시간 오늘 날짜 8자리를 입력하세요.</div>';return;
    }
    state.viewerMode=false;state.identity={name};state.loginVerified=true;saveIdentity();
    if(state.session?.host===true&&state.session?.roomCode)await resumeSession();
    else if(state.session?.viewer)clearRoomSession();
    render();
  };
  $('#loginBtn')?.addEventListener('click',hostLogin);
  $('#loginPw')?.addEventListener('keydown',e=>{if(e.key==='Enter')hostLogin();});
  $('#viewerJoinBtn')?.addEventListener('click',viewerJoinRoom);
  $('#viewerRoomCode')?.addEventListener('keydown',e=>{if(e.key==='Enter')viewerJoinRoom();});
};

createRoom=async function(){
  await v10BaseCreateRoom();
  if(state.room&&isHost()){
    const patch={};
    if(!state.room.gameStartedAt){state.room.gameStartedAt=Date.now();patch.gameStartedAt=state.room.gameStartedAt;}
    if(!Array.isArray(state.room.settlementHistory)){state.room.settlementHistory=[];patch.settlementHistory=[];}
    if(Object.keys(patch).length){patch.updatedAt=Date.now();try{await persistRoom(patch);}catch{}}
  }
};

function archiveCurrentGame(history,reason='new-game'){
  const out=Array.isArray(history)?clone(history):[];
  const holes=completedCount();
  if(!holes)return out;
  const cum=cumulativeLedger(18);
  const startTs=state.room.gameStartedAt||state.room.resetAt||state.room.createdAt||Date.now();
  const entry={
    id:`${state.room.code}-${startTs}`,
    roomCode:state.room.code,
    title:state.room.title||'라운드',
    reason,
    dateKey:kstDateKey(startTs),
    monthKey:kstMonthKey(startTs),
    startedAt:startTs,
    archivedAt:Date.now(),
    completedHoles:holes,
    netByName:{},
    players:state.room.players.map(p=>({id:p.id,name:p.name}))
  };
  state.room.players.forEach(p=>entry.netByName[p.name]=(entry.netByName[p.name]||0)+(cum.net[p.id]||0));
  if(!out.some(x=>x.id===entry.id))out.push(entry);
  return out;
}

startNewGame=async function(){
  if(!isHost()||!state.room||state.busy)return;
  const ok=confirm('새 게임을 시작할까요?\n\n현재 게임의 홀별 스코어와 정산 진행상태는 초기화됩니다.\n이번 달 정산을 위해 게임별 최종 정산 합계만 월간 장부에 보관합니다.\n플레이어·코스·내기 규칙·호스트 로그인·ROOM 코드는 유지됩니다.');
  if(!ok)return;
  const backup=clone(state.room);
  const scores=emptyHoleState(),confirmed=emptyHoleState(),manualDouble={};
  const now=Date.now(),history=archiveCurrentGame(state.room.settlementHistory,'new-game');
  state.busy=true;
  Object.assign(state.room,{scores,confirmed,manualDouble,currentHole:1,status:'active',resetAt:now,gameStartedAt:now,settlementHistory:history});
  render();
  try{
    await persistRoom({scores,confirmed,manualDouble,currentHole:1,status:'active',resetAt:now,gameStartedAt:now,settlementHistory:history,updatedAt:now});
    state.tab='round';render();toast('새 게임 시작 · 1번홀로 초기화되었습니다.');
  }catch(e){state.room=backup;render();toast('새 게임 초기화에 실패했습니다. 인터넷 연결을 확인해 주세요.');}
  finally{state.busy=false;}
};

function ensurePlayerBaseline(){
  if(state.playerBaselineRoom!==state.room.code){
    state.playerBaselineRoom=state.room.code;
    state.playerBaseline=state.room.players.map(p=>p.name);
  }
}
playersSetupHTML=function(editable){
  ensurePlayerBaseline();
  const changed=state.room.players.some((p,i)=>p.name!==state.playerBaseline[i]);
  return `<section class="card"><h2>플레이어 4명</h2><div class="sub">호스트 이름은 유지됩니다. <b>동반자 이름이 한 명이라도 바뀌면 새 ROOM 코드가 생성</b>되고 현재 게임의 홀 기록은 초기화됩니다.</div><div class="stack">${state.room.players.map((p,i)=>`<div class="playerset"><div class="avatar">${i+1}</div><div><input class="playerNameInput" data-id="${p.id}" value="${escapeHtml(p.name)}" maxlength="10" ${editable&&i>0?'':'readonly'}><div class="fs12 muted mt8">${i===0?'● 호스트 · 변경 불가':'○ 동반자'}</div></div></div>`).join('')}</div><button id="applyLineupChange" class="btn ${changed?'primary':'secondary'} block" ${editable?'':'disabled'}>${changed?'새 동반자로 변경 · 새 ROOM 생성':'동반자 이름 변경 후 적용'}</button><div class="sub mb0" style="margin-top:9px">변경 적용 시 기존 ROOM은 종료되고, 동반자에게 새 ROOM 코드를 다시 알려줘야 합니다.</div></section>`;
};

async function applyLineupChange(){
  if(!isHost()||state.busy)return;
  const inputs=$$('.playerNameInput');
  const names=inputs.map(x=>(x.value||'').trim());
  names[0]=identityName();
  if(names.some(n=>!n)){toast('플레이어 이름을 모두 입력하세요.');return;}
  if(!uniquePlayerNames(names)){toast('플레이어 이름은 서로 달라야 합니다.');return;}
  ensurePlayerBaseline();
  if(names.every((n,i)=>n===state.playerBaseline[i])){toast('변경된 동반자 이름이 없습니다.');return;}
  const changedNames=names.filter((n,i)=>n!==state.playerBaseline[i]);
  if(!confirm(`동반자를 변경할까요?\n\n변경 후 새 ROOM 코드가 생성되고 현재 홀 기록은 초기화됩니다.\n변경: ${changedNames.join(', ')}`))return;

  const oldRoom=state.room,oldCode=oldRoom.code;
  const history=archiveCurrentGame(oldRoom.settlementHistory,'lineup-change');
  const room=newRoom(names);
  room.title=oldRoom.title;
  room.pars=clone(oldRoom.pars);
  room.rules=clone(oldRoom.rules);
  room.status='active';
  room.players[0].claimedBy=state.uid;
  room.settlementHistory=history;
  room.gameStartedAt=Date.now();
  room.currentHole=1;
  const emptyScores=emptyHoleState();
  room.scores=emptyScores;room.confirmed=emptyHoleState();room.manualDouble={};

  state.busy=true;
  try{
    const {doc,setDoc,updateDoc}=state.fx;
    await setDoc(doc(state.db,'rooms',room.code),room);
    await updateDoc(doc(state.db,'rooms',oldCode),{
      status:'replaced',replacedBy:room.code,replacedAt:Date.now(),
      scores:emptyHoleState(),confirmed:emptyHoleState(),manualDouble:{},currentHole:1,updatedAt:Date.now()
    });
    if(state.unsub){state.unsub();state.unsub=null;}
    state.room=room;state.myPlayerId='p1';
    state.session={roomCode:room.code,playerId:'p1',host:true,identityName:identityName()};
    saveSession();saveBinding(room.code,'p1');
    state.playerBaselineRoom=room.code;state.playerBaseline=names.slice();
    state.tab='round';subscribeRoom(room.code);render();
    alert(`새 ROOM이 생성되었습니다.\n\n새 ROOM 코드: ${room.code}\n\n동반자에게 새 코드를 공유해 주세요.`);
  }catch(e){toast(`동반자 변경 실패: ${e?.message||e}`);}
  finally{state.busy=false;}
}

bindSetup=function(){
  v10BaseBindSetup();
  $('#applyLineupChange')?.addEventListener('click',applyLineupChange);
};

// Host may edit any hole in the current game. Editing a confirmed hole re-opens that hole until the single confirm button is pressed again.
canEditPlayer=function(){return isHost();};
setScore=async function(playerId,v){
  if(!isHost()||state.busy)return;
  const h=currentHole(),prev=scoreOf(h,playerId),prevConfirmed=isConfirmed(h,playerId);
  state.busy=true;
  setScoreLocal(h,playerId,v);setConfirmedLocal(h,playerId,false);render();
  try{
    const sp=`scores.h${h}.${playerId}`,cp=`confirmed.h${h}.${playerId}`;
    await persistRoom({[sp]:v,[cp]:false,updatedAt:Date.now()});
  }catch(e){setScoreLocal(h,playerId,prev);setConfirmedLocal(h,playerId,prevConfirmed);toast('스코어 수정 저장에 실패했습니다.');}
  finally{state.busy=false;render();}
};

scoreRowHTML=function(h,p,par){
  const v=scoreOf(h,p.id),editable=isHost(),desc=classify(v,par),confirmed=isConfirmed(h,p.id);
  const badge=holeComplete(h)?'<span class="confirm-badge done">확정</span>':Number.isFinite(v)?'<span class="confirm-badge draft">입력됨</span>':'<span class="confirm-badge">대기</span>';
  return `<div class="scorerow"><div class="scoretop"><div><div class="pname">${escapeHtml(p.name)}</div><div class="psub">${Number.isFinite(v)?desc:'아직 미입력'} · 누적 ${cumulativeToPar(p.id).holes?parLabel(cumulativeToPar(p.id).diff):'–'}</div></div><div class="score-number">${Number.isFinite(v)?v:'-'}</div>${badge}</div>${editable?`<div class="score-actions">${[-1,0,1,2,3].map(d=>{const sv=par+d,label=d===-1?'버디':d===0?'파':d===1?'보기':d===2?'더블':'트리플';return `<button class="score-choice ${v===sv?'on':''}" data-qplayer="${p.id}" data-score="${sv}" ${state.busy?'disabled':''}>${label}</button>`}).join('')}<button class="score-choice other" data-other="${p.id}" ${state.busy?'disabled':''}>기타</button></div>`:''}</div>`;
};

hostRoundHTML=function(){
  const h=currentHole(),par=state.room.pars[h-1],L=holeLedger(h),complete=holeComplete(h);
  const allTie=L.allTie===true,prevAllTie=h>1&&(state.room.rules.allTieCarry!==false)&&allTieHole(h-1);
  const triggers=state.room.rules.doubleTiming==='current'?triggerInfo(h):(h>1?triggerInfo(h-1):[]),displayTriggers=[...(prevAllTie?['전 홀 전원 동타 이월']:[]),...triggers];
  const triggerText=allTie?(h<18?'전원 동타 · 이번 홀 정산 0원 · 다음 홀 자동 ×2':'전원 동타 · 이번 홀 정산 0원'):(displayTriggers.length?`배판: ${[...new Set(displayTriggers)].join(' · ')}`:'배판 조건 없음');
  const entered=enteredScoreCount(h),ready=entered===4&&!complete;
  return `<div class="statusbar"><div class="names">${state.room.players.map(p=>{const c=cumulativeToPar(p.id);return `<span class="tinyplayer">${escapeHtml(p.name)}<b>${c.holes?parLabel(c.diff):'–'}</b></span>`}).join('')}</div><div class="roundprogress">${completedCount()}/18H</div></div>
    <section class="card holehero"><div class="holehead"><div><div class="par">PAR ${par}</div><div class="holeid">${h} HOLE</div></div><div class="mult ${allTie||L.mult===1?'normal':''}">${allTie?'0원':`× ${L.mult}`}</div></div><div class="trigger">${triggerText}</div><div class="holemoney"><div class="miniStat"><span>이번 홀</span><strong>${complete?'정산 확정':'입력/수정 중'}</strong></div><div class="miniStat"><span>완료 홀</span><strong>${completedCount()}/18H</strong></div></div></section>
    <section class="card scorecard"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">4명 스코어 ${complete?'· 수정 가능':''}</h2><span class="fs12 ${complete?'plus':'muted'}">${complete?'● 확정됨':`${entered}/4 점수입력`}</span></div>${state.room.players.map(p=>scoreRowHTML(h,p,par)).join('')}
      <button id="confirmAllScores" class="btn primary block confirm-all" ${(!ready||state.busy)?'disabled':''}>${complete?'✓ 4명 입력완료':state.busy?'저장 중...':'4명 입력완료'}</button>
      <div class="sub center mb0" style="margin-top:8px">완료된 과거 홀도 아래 홀 번호를 눌러 점수를 수정할 수 있습니다. 수정 후 다시 `4명 입력완료`를 누르면 정산이 재계산됩니다.</div>
      ${state.room.rules.manualTriggerEnabled?`<div class="switchrow" style="padding:10px 0 1px;margin-top:4px"><div class="switchcopy"><strong>기타 사유 배판</strong><span>OB 등 수동 조건</span></div><label class="switch"><input id="manualDouble" type="checkbox" ${state.room.manualDouble?.[`h${h}`]?'checked':''}><span class="slider"></span></label></div>`:''}
      ${complete?`<div class="score-summary">${state.room.players.map(p=>{const n=L.net[p.id]||0;return `<div><span>${escapeHtml(p.name)}</span><strong class="${n>0?'plus':n<0?'minus':'zero'}">${signed(n)}</strong></div>`}).join('')}</div>`:''}
    </section>
    <section class="card roundnav"><div class="roundnavtop"><button id="prevHole" class="btn ghost small" ${h===1?'disabled':''}>← 이전</button><b>${h}/18</b><button id="nextHole" class="btn secondary small" ${h===18?'disabled':''}>다음 →</button></div><div class="holetrack">${Array.from({length:18},(_,i)=>{const n=i+1;return `<button class="hchip ${n===h?'current':holeComplete(n)?'done':'pending'}" data-hole="${n}">${n}</button>`}).join('')}</div></section>`;
};

function personalHistoryHTML(id){
  const rows=[];
  for(let h=1;h<=18;h++){
    if(!holeComplete(h))continue;
    const s=scoreOf(h,id),par=state.room.pars[h-1];if(!Number.isFinite(s))continue;
    const d=s-par,rel=d===0?'E':d>0?`+${d}`:`${d}`;
    rows.push(`<div class="hole-record-line"><b>${h}H</b><span>PAR ${par}</span><strong>${s}타</strong><em>${classify(s,par)} · ${rel}</em></div>`);
  }
  return rows.length?`<div class="history-lines">${rows.join('')}</div>`:`<div class="center muted fs12" style="padding:12px 0">아직 확정된 홀이 없습니다.</div>`;
}

function currentGameNetByName(){
  const cum=cumulativeLedger(18),out={};
  state.room.players.forEach(p=>out[p.name]=(out[p.name]||0)+(cum.net[p.id]||0));
  return out;
}
function mergeNameNet(target,source){Object.entries(source||{}).forEach(([n,v])=>target[n]=(target[n]||0)+(Number(v)||0));return target;}
function monthlySettlement(monthKey=kstMonthKey()){
  const net={},history=Array.isArray(state.room.settlementHistory)?state.room.settlementHistory:[];
  const archived=history.filter(x=>x.monthKey===monthKey);
  archived.forEach(x=>mergeNameNet(net,x.netByName));
  const startTs=state.room.gameStartedAt||state.room.resetAt||state.room.createdAt||Date.now();
  const includeCurrent=kstMonthKey(startTs)===monthKey&&completedCount()>0;
  if(includeCurrent)mergeNameNet(net,currentGameNetByName());
  return {net,rounds:archived.length+(includeCurrent?1:0),archived:archived.length};
}
function minimalNameTransfers(net){
  const creditors=[],debtors=[];
  Object.entries(net||{}).forEach(([name,v])=>{if(v>.5)creditors.push({name,amt:v});else if(v<-.5)debtors.push({name,amt:-v});});
  creditors.sort((a,b)=>b.amt-a.amt);debtors.sort((a,b)=>b.amt-a.amt);
  const out=[];let i=0,j=0;
  while(i<debtors.length&&j<creditors.length){
    const amt=Math.min(debtors[i].amt,creditors[j].amt);if(amt>.5)out.push({from:debtors[i].name,to:creditors[j].name,amt});
    debtors[i].amt-=amt;creditors[j].amt-=amt;if(debtors[i].amt<.5)i++;if(creditors[j].amt<.5)j++;
  }
  return out;
}
function nameMoneyGrid(net){
  const entries=Object.entries(net||{});
  if(!entries.length)return '<div class="center muted fs12" style="padding:12px 0">아직 정산 기록이 없습니다.</div>';
  return `<div class="moneygrid mt12">${entries.map(([name,n])=>`<div class="moneycard"><div class="name">${escapeHtml(name)}</div><div class="amt ${n>0?'plus':n<0?'minus':'zero'}">${signed(n)}</div></div>`).join('')}</div>`;
}
function transferList(transfers){
  return transfers.length?transfers.map(t=>`<div class="transfer"><div class="who"><b>${escapeHtml(t.from)}</b> <span class="arrow">→</span> <b>${escapeHtml(t.to)}</b></div><strong>${fmt(t.amt)}</strong></div>`).join(''):'<div class="center muted fs12" style="padding:12px 0">현재 정산할 금액이 없습니다.</div>';
}

ledgerHTML=function(){
  const cum=cumulativeLedger(18),currentTransfers=minimalTransfers(cum.net),monthKey=kstMonthKey(),monthly=monthlySettlement(monthKey),monthlyTransfers=minimalNameTransfers(monthly.net),complete=completedCount();
  return `<section class="card"><div style="display:flex;justify-content:space-between;align-items:start;gap:10px"><div><div class="fs12 muted">${escapeHtml(state.room.title)}</div><h2 style="margin:3px 0 0">현재 게임 누적 정산</h2></div><button id="copySummary" class="copybtn">결과 복사</button></div><div class="moneygrid mt12">${state.room.players.map(p=>moneyCard(p,cum.net[p.id]||0)).join('')}</div><div class="sub mt12 mb0">${complete}/18홀 확정 기준</div></section>
    <section class="card"><h2>현재 게임 · 상계 후 한번에 정산</h2><div class="sub">이번 게임의 모든 주고받을 금액을 상계해서 최소 송금만 표시합니다.</div>${currentTransfers.length?currentTransfers.map(t=>`<div class="transfer"><div class="who"><b>${escapeHtml(getPlayer(t.from).name)}</b> <span class="arrow">→</span> <b>${escapeHtml(getPlayer(t.to).name)}</b></div><strong>${fmt(t.amt)}</strong></div>`).join(''):'<div class="center muted fs12" style="padding:12px 0">현재 정산할 금액이 없습니다.</div>'}</section>
    <section class="card monthly-card"><div class="month-head"><div><div class="fs12 muted">MONTHLY SETTLEMENT</div><h2>${kstMonthLabel(monthKey)} 누적 정산</h2></div><b>${monthly.rounds}게임</b></div>${nameMoneyGrid(monthly.net)}<div class="sub mt12 mb0">새 게임을 시작해도 월간 정산용 최종 합계는 계속 누적됩니다.</div></section>
    <section class="card"><h2>${kstMonthLabel(monthKey)} · 상계 후 한번에 정산</h2><div class="sub">이번 달 여러 게임을 모두 합친 뒤 서로 받을 돈과 줄 돈을 상계한 최종 송금안입니다.</div>${transferList(monthlyTransfers)}</section>
    <section class="card"><h2>현재 게임 상대별 원장</h2>${pairSummaryHTML(cum.pair)}</section>`;
};

summaryText=function(){
  const cum=cumulativeLedger(18),current=minimalTransfers(cum.net),monthKey=kstMonthKey(),monthly=monthlySettlement(monthKey),mt=minimalNameTransfers(monthly.net);
  return `[${state.room.title}] 골프 정산\nROOM ${state.room.code}\n\n[현재 게임]\n`+state.room.players.map(p=>`${p.name}: ${signed(cum.net[p.id]||0)}`).join('\n')+`\n\n[현재 게임 상계]\n`+(current.length?current.map(t=>`${getPlayer(t.from).name} → ${getPlayer(t.to).name}: ${fmt(t.amt)}`).join('\n'):'정산 없음')+`\n\n[${kstMonthLabel(monthKey)} 월간 상계]\n`+(mt.length?mt.map(t=>`${t.from} → ${t.to}: ${fmt(t.amt)}`).join('\n'):'정산 없음');
};

bindLedger=function(){
  v10BaseBindLedger();
  $('#copySummary')?.addEventListener('click',()=>copyText(summaryText(),'정산 결과가 복사되었습니다.'));
};

// Re-bind the final host round interactions after v10 hostRoundHTML overrides.
bindRound=function(){
  v10BaseBindRound();
};
