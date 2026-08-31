// Personal viewer + single-confirm host workflow patch.
// Loaded after app-host-viewer.js.

const personalViewerStorageKey='golfBetPersonalViewerV2';
const personalBaseBindRound=bindRound;

function savedPersonalViewer(code){
  try{
    const all=JSON.parse(localStorage.getItem(personalViewerStorageKey)||'{}');
    return all[String(code||'').toUpperCase()]||null;
  }catch{return null;}
}
function savePersonalViewer(code,playerId,name){
  let all={};
  try{all=JSON.parse(localStorage.getItem(personalViewerStorageKey)||'{}')||{};}catch{}
  all[String(code||'').toUpperCase()]={playerId,name,savedAt:Date.now()};
  localStorage.setItem(personalViewerStorageKey,JSON.stringify(all));
}
function playerTotal(id){
  let strokes=0, holes=0, diff=0;
  for(let h=1;h<=18;h++){
    if(!holeComplete(h)) continue;
    const s=scoreOf(h,id);
    if(Number.isFinite(s)){
      strokes+=s; holes++; diff+=s-state.room.pars[h-1];
    }
  }
  return {strokes,holes,diff};
}
function enteredScoreCount(h){return state.room.players.filter(p=>Number.isFinite(scoreOf(h,p.id))).length;}
function personalHistoryHTML(id){
  const rows=[];
  for(let h=1;h<=18;h++){
    if(!holeComplete(h)) continue;
    const s=scoreOf(h,id),par=state.room.pars[h-1];
    if(!Number.isFinite(s)) continue;
    rows.push(`<div class="hole-record"><b>${h}H</b><strong>${s}타</strong><span>PAR ${par} · ${classify(s,par)}</span></div>`);
  }
  return rows.length?`<div class="history-grid">${rows.join('')}</div>`:`<div class="center muted fs12" style="padding:16px 0">아직 확정된 홀이 없습니다.</div>`;
}

loginHTML=function(){
  const lastRoom=(localStorage.getItem(viewerRoomStorageKey)||'').toUpperCase();
  const live=state.firebaseReady,err=state.firebaseError;
  return `
    <section class="card hero login-hero">
      <div class="fs12" style="opacity:.8;font-weight:900">LIVE GOLF LEDGER</div>
      <h1>오늘 누가 쏴?</h1>
      <p>호스트가 4명의 점수를 입력합니다. 동반자는 ROOM에 들어와 본인 이름을 선택하면 개인 스코어와 정산을 실시간으로 확인할 수 있습니다.</p>
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
      <div class="sub">ROOM 생성·설정·4명 스코어 입력은 호스트만 합니다.</div>
      <div class="stack">
        <div><label>호스트 이름</label><input id="loginName" maxlength="10" autocomplete="username" placeholder="예: 진우" value="${escapeHtml(identityName())}"></div>
        <div><label>비밀번호</label><input id="loginPw" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" placeholder="1234"></div>
        <button id="loginBtn" class="btn secondary block">호스트로 로그인</button>
        <div id="loginMsg"></div>
      </div>
    </section>
    ${!live?`<div class="notice error"><b>실시간 서버 연결 안 됨</b><br>${escapeHtml(err||'Firebase 연결을 확인하는 중입니다. 잠시 후 새로고침해 주세요.')}</div>`:''}`;
};

viewerJoinRoom=async function(){
  const code=($('#viewerRoomCode')?.value||'').trim().toUpperCase(),msg=$('#viewerJoinMsg');
  if(!code){msg.innerHTML='<div class="notice error">ROOM 코드를 입력하세요.</div>';return;}
  if(!state.firebaseReady){msg.innerHTML='<div class="notice error">실시간 서버가 아직 연결되지 않았습니다.</div>';return;}
  msg.innerHTML='<div class="notice">ROOM을 확인하는 중입니다...</div>';
  try{
    const {doc,getDoc}=state.fx;
    const snap=await Promise.race([
      getDoc(doc(state.db,'rooms',code)),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('ROOM 확인 시간이 초과되었습니다. 인터넷 연결을 확인해 주세요.')),12000))
    ]);
    if(!snap.exists()){msg.innerHTML='<div class="notice error">ROOM을 찾을 수 없습니다. 코드를 다시 확인하세요.</div>';return;}
    const room=snap.data(),saved=savedPersonalViewer(code);
    msg.innerHTML=`<div class="notice success"><b>ROOM ${escapeHtml(code)} 확인 완료</b><br>아래에서 본인 이름을 선택하세요.</div>
      <div class="viewer-name-picker">${(room.players||[]).map(p=>`<button class="btn ${saved?.playerId===p.id?'primary':'secondary'} viewerNamePick" data-player="${p.id}">${escapeHtml(p.name)}${saved?.playerId===p.id?' · 이전 선택':''}</button>`).join('')}</div>`;
    $$('.viewerNamePick').forEach(b=>b.addEventListener('click',()=>enterViewerAs(code,room,b.dataset.player)));
  }catch(e){msg.innerHTML=`<div class="notice error"><b>ROOM 입장 실패</b><br>${escapeHtml(e?.message||String(e))}</div>`;}
};

function enterViewerAs(code,room,playerId){
  const p=(room.players||[]).find(x=>x.id===playerId);
  if(!p) return;
  if(state.unsub){state.unsub();state.unsub=null;}
  state.viewerMode=true;
  state.loginVerified=true;
  state.room=room;
  state.myPlayerId=playerId;
  state.session={roomCode:code,host:false,viewer:true,playerId,identityName:p.name};
  state.tab='round';
  saveSession();
  savePersonalViewer(code,playerId,p.name);
  localStorage.setItem(viewerRoomStorageKey,code);
  subscribeRoom(code);
  render();
}

bindLogin=function(){
  const hostLogin=async()=>{
    const name=($('#loginName')?.value||'').trim(),pw=$('#loginPw')?.value||'',msg=$('#loginMsg');
    if(!name){msg.innerHTML='<div class="notice error">호스트 이름을 입력하세요.</div>';return;}
    if(pw!==COMMON_PASSWORD){msg.innerHTML='<div class="notice error">비밀번호가 맞지 않습니다. 공통 비밀번호는 1234입니다.</div>';return;}
    state.viewerMode=false;state.identity={name};state.loginVerified=true;saveIdentity();
    if(state.session?.host===true&&state.session?.roomCode) await resumeSession();
    else if(state.session?.viewer) clearRoomSession();
    render();
  };
  $('#loginBtn')?.addEventListener('click',hostLogin);
  $('#loginPw')?.addEventListener('keydown',e=>{if(e.key==='Enter')hostLogin();});
  $('#viewerJoinBtn')?.addEventListener('click',viewerJoinRoom);
  $('#viewerRoomCode')?.addEventListener('keydown',e=>{if(e.key==='Enter')viewerJoinRoom();});
};

canEditPlayer=function(){return isHost()&&!holeComplete(currentHole());};

setScore=async function(playerId,v){
  if(!isHost()||holeComplete(currentHole())||state.busy) return;
  const h=currentHole(),prev=scoreOf(h,playerId),prevConfirmed=isConfirmed(h,playerId);
  state.busy=true;
  setScoreLocal(h,playerId,v);setConfirmedLocal(h,playerId,false);render();
  try{
    const sp=`scores.h${h}.${playerId}`,cp=`confirmed.h${h}.${playerId}`;
    await persistRoom({[sp]:v,[cp]:false,updatedAt:Date.now()});
  }catch(e){
    setScoreLocal(h,playerId,prev);setConfirmedLocal(h,playerId,prevConfirmed);
    toast('스코어 저장에 실패했습니다. 인터넷 연결을 확인해 주세요.');
  }finally{state.busy=false;render();}
};

scoreRowHTML=function(h,p,par){
  const v=scoreOf(h,p.id),editable=isHost()&&!holeComplete(h),desc=classify(v,par),confirmed=isConfirmed(h,p.id);
  const badge=holeComplete(h)?'<span class="confirm-badge done">확정</span>':Number.isFinite(v)?'<span class="confirm-badge draft">입력됨</span>':'<span class="confirm-badge">대기</span>';
  return `<div class="scorerow"><div class="scoretop"><div><div class="pname">${escapeHtml(p.name)}</div><div class="psub">${Number.isFinite(v)?desc:'아직 미입력'} · 누적 ${cumulativeToPar(p.id).holes?parLabel(cumulativeToPar(p.id).diff):'–'}</div></div><div class="score-number">${Number.isFinite(v)?v:'-'}</div>${badge}</div>${editable?`<div class="score-actions">${[-1,0,1,2,3].map(d=>{const sv=par+d,label=d===-1?'버디':d===0?'파':d===1?'보기':d===2?'더블':'트리플';return `<button class="score-choice ${v===sv?'on':''}" data-qplayer="${p.id}" data-score="${sv}" ${state.busy?'disabled':''}>${label}</button>`}).join('')}<button class="score-choice other" data-other="${p.id}" ${state.busy?'disabled':''}>기타</button></div>`:''}</div>`;
};

async function confirmAllScores(){
  if(!isHost()||state.busy) return;
  const h=currentHole();
  if(holeComplete(h)) return;
  if(!allScores(h).every(v=>Number.isFinite(v))){toast('4명의 스코어를 모두 입력하세요.');return;}
  const prev=Object.fromEntries(state.room.players.map(p=>[p.id,isConfirmed(h,p.id)]));
  const patch={updatedAt:Date.now()};
  state.busy=true;
  state.room.players.forEach(p=>{setConfirmedLocal(h,p.id,true);patch[`confirmed.h${h}.${p.id}`]=true;});
  render();
  try{
    await persistRoom(patch);
    toast(`${h}번홀 4명 입력완료`);
  }catch(e){
    state.room.players.forEach(p=>setConfirmedLocal(h,p.id,prev[p.id]));
    toast('입력완료 저장에 실패했습니다. 인터넷 연결을 확인해 주세요.');
  }finally{state.busy=false;render();}
}

function hostRoundHTML(){
  const h=currentHole(),par=state.room.pars[h-1],L=holeLedger(h),cum=cumulativeLedger(h),complete=holeComplete(h);
  const allTie=L.allTie===true,prevAllTie=h>1&&(state.room.rules.allTieCarry!==false)&&allTieHole(h-1);
  const triggers=state.room.rules.doubleTiming==='current'?triggerInfo(h):(h>1?triggerInfo(h-1):[]),displayTriggers=[...(prevAllTie?['전 홀 전원 동타 이월']:[]),...triggers];
  const triggerText=allTie?(h<18?'전원 동타 · 이번 홀 정산 0원 · 다음 홀 자동 ×2':'전원 동타 · 이번 홀 정산 0원 · 라운드 종료'):(displayTriggers.length?`배판: ${[...new Set(displayTriggers)].join(' · ')}`:'배판 조건 없음');
  const entered=enteredScoreCount(h),ready=entered===4;
  return `<div class="statusbar"><div class="names">${state.room.players.map(p=>{const c=cumulativeToPar(p.id);return `<span class="tinyplayer">${escapeHtml(p.name)}<b>${c.holes?parLabel(c.diff):'–'}</b></span>`}).join('')}</div><div class="roundprogress">${completedCount()}/18H</div></div>
    <section class="card holehero"><div class="holehead"><div><div class="par">PAR ${par}</div><div class="holeid">${h} HOLE</div></div><div class="mult ${allTie||L.mult===1?'normal':''}">${allTie?'0원':`× ${L.mult}`}</div></div><div class="trigger">${triggerText}</div><div class="holemoney"><div class="miniStat"><span>이번 홀 정산</span><strong>${complete?'확정':'입력 중'}</strong></div><div class="miniStat"><span>현재까지 완료</span><strong>${completedCount()}/18H</strong></div></div></section>
    <section class="card scorecard"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">4명 스코어 입력</h2><span class="fs12 ${complete?'plus':'muted'}">${complete?'● 금액 확정':`${entered}/4 점수입력`}</span></div>${state.room.players.map(p=>scoreRowHTML(h,p,par)).join('')}
      <button id="confirmAllScores" class="btn primary block confirm-all" ${(!ready||complete||state.busy)?'disabled':''}>${complete?'✓ 4명 입력완료':state.busy?'저장 중...':'4명 입력완료'}</button>
      <div class="sub center mb0" style="margin-top:8px">4명 점수를 확인한 뒤 이 버튼을 한 번만 누르면 해당 홀 금액이 확정됩니다.</div>
      ${state.room.rules.manualTriggerEnabled?`<div class="switchrow" style="padding:10px 0 1px;margin-top:4px"><div class="switchcopy"><strong>기타 사유 배판</strong><span>OB 등 수동 조건</span></div><label class="switch"><input id="manualDouble" type="checkbox" ${state.room.manualDouble?.[`h${h}`]?'checked':''} ${isHost()?'':'disabled'}><span class="slider"></span></label></div>`:''}
      ${complete?`<div class="score-summary">${state.room.players.map(p=>{const n=L.net[p.id]||0;return `<div><span>${escapeHtml(p.name)}</span><strong class="${n>0?'plus':n<0?'minus':'zero'}">${signed(n)}</strong></div>`}).join('')}</div>`:''}
    </section>
    <section class="card roundnav"><div class="roundnavtop"><button id="prevHole" class="btn ghost small" ${h===1?'disabled':''}>← 이전</button><b>${h}/18</b><button id="nextHole" class="btn secondary small" ${h===18?'disabled':''}>다음 →</button></div><div class="holetrack">${Array.from({length:18},(_,i)=>{const n=i+1;return `<button class="hchip ${n===h?'current':holeComplete(n)?'done':'pending'}" data-hole="${n}">${n}</button>`}).join('')}</div></section>`;
}

function personalViewerRoundHTML(){
  const me=state.myPlayerId,p=myPlayer(),h=currentHole(),par=state.room.pars[h-1],L=holeLedger(h),cum=cumulativeLedger(18),complete=holeComplete(h),total=playerTotal(me);
  const myScore=scoreOf(h,me),myMoney=cum.net[me]||0,entered=enteredScoreCount(h);
  return `<div class="notice success viewer-live"><b>● ${escapeHtml(p?.name||'내')} 실시간 보기</b><br>스코어 입력은 호스트가 하고, 내 기록과 정산은 자동 갱신됩니다.</div>
    <section class="card personal-summary"><div><span>내 누적 스코어</span><strong>${total.holes?parLabel(total.diff):'–'}</strong><small>${total.holes}홀 · ${total.strokes||0}타</small></div><div><span>내 누적 정산</span><strong class="${myMoney>0?'plus':myMoney<0?'minus':'zero'}">${signed(myMoney)}</strong><small>${myMoney>0?'받을 금액':myMoney<0?'줄 금액':'정산 없음'}</small></div></section>
    <div class="statusbar"><div class="names">${state.room.players.map(x=>{const c=cumulativeToPar(x.id);return `<span class="tinyplayer ${x.id===me?'personal':''}">${escapeHtml(x.name)}<b>${c.holes?parLabel(c.diff):'–'}</b></span>`}).join('')}</div><div class="roundprogress">${completedCount()}/18H</div></div>
    <section class="card holehero"><div class="holehead"><div><div class="par">PAR ${par}</div><div class="holeid">${h} HOLE</div></div><div class="mult ${L.allTie||L.mult===1?'normal':''}">${L.allTie?'0원':`× ${L.mult}`}</div></div><div class="trigger">${complete?'이번 홀 정산 확정':`호스트 입력 중 · ${entered}/4`}</div></section>
    <section class="card"><h2>${h}번홀 스코어</h2>${state.room.players.map(x=>scoreRowHTML(h,x,par)).join('')}<div class="sub mb0" style="margin-top:10px">내 스코어: <b>${Number.isFinite(myScore)?`${myScore}타 · ${classify(myScore,par)}`:'입력 대기'}</b></div></section>
    <section class="card"><h2>내 스코어 기록</h2><div class="sub">확정된 홀 기준으로 몇 번 홀에서 몇 타를 쳤는지 확인합니다.</div>${personalHistoryHTML(me)}</section>`;
}

roundHTML=function(){return state.viewerMode?personalViewerRoundHTML():hostRoundHTML();};

ledgerHTML=function(){
  if(!state.viewerMode) return baseLedgerHTML();
  const me=state.myPlayerId,p=myPlayer(),cum=cumulativeLedger(18),rel=relativePairs(me,cum.pair),transfers=minimalTransfers(cum.net),complete=completedCount(),myNet=cum.net[me]||0;
  return `<div class="notice success viewer-live"><b>● ${escapeHtml(p?.name||'내')} 개인 정산</b><br>호스트 입력 결과가 실시간으로 반영됩니다.</div>
    <section class="card personal-money"><div class="fs12 muted">현재 내 누적 정산</div><div class="personal-money-amt ${myNet>0?'plus':myNet<0?'minus':'zero'}">${signed(myNet)}</div><div class="sub mb0">${complete}/18홀 확정 기준</div></section>
    <section class="card"><h2>내가 누구에게 주고 · 받을 돈</h2>${rel.map(r=>{const o=getPlayer(r.other);return `<div class="transfer"><div class="who">${r.amt>0?`<b>${escapeHtml(o.name)}</b>에게 받을 금액`:r.amt<0?`<b>${escapeHtml(o.name)}</b>에게 줄 금액`:`<b>${escapeHtml(o.name)}</b>과 정산 없음`}</div><strong class="${r.amt>0?'plus':r.amt<0?'minus':'zero'}">${signed(r.amt)}</strong></div>`;}).join('')}</section>
    <section class="card"><h2>전체 최소 송금 정산</h2><div class="sub">라운드 전체를 상계해 실제 이체 횟수를 줄인 결과입니다.</div>${transfers.length?transfers.map(t=>`<div class="transfer ${t.from===me||t.to===me?'personal-transfer':''}"><div class="who"><b>${escapeHtml(getPlayer(t.from).name)}</b> <span class="arrow">→</span> <b>${escapeHtml(getPlayer(t.to).name)}</b></div><strong>${fmt(t.amt)}</strong></div>`).join(''):`<div class="center muted fs12">현재 정산할 금액이 없습니다.</div>`}</section>
    <section class="card"><h2>내 스코어 기록</h2>${personalHistoryHTML(me)}</section>`;
};

bindRound=function(){
  personalBaseBindRound();
  $('#confirmAllScores')?.addEventListener('click',confirmAllScores);
};

render=function(){
  const main=$('#main'),nav=$('#bottomNav'),roomLine=$('#roomLine');
  if(!state.loginVerified){roomLine.classList.add('hidden');nav.classList.add('hidden');main.innerHTML=loginHTML();bindLogin();return;}
  if(state.room){
    roomLine.classList.remove('hidden');$('#roomCodeTop').textContent=state.room.code;
    $('#myIdentity').textContent=state.viewerMode?`내 이름 · ${escapeHtml(myPlayer()?.name||'선택됨')}`:`호스트 · ${identityName()}`;
  }else roomLine.classList.add('hidden');
  if(!state.room){nav.classList.add('hidden');main.innerHTML=homeHTML();bindHome();return;}
  nav.classList.remove('hidden');
  const setupBtn=$('[data-tab="setup"]',nav);if(setupBtn)setupBtn.style.display=state.viewerMode?'none':'';
  nav.style.gridTemplateColumns=state.viewerMode?'repeat(2,1fr)':'repeat(3,1fr)';
  if(state.viewerMode&&state.tab==='setup')state.tab='round';
  $$('.navbtn',nav).forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));
  if(state.tab==='setup'&&!state.viewerMode){main.innerHTML=setupHTML();bindSetup();}
  else if(state.tab==='ledger'){main.innerHTML=ledgerHTML();bindLedger();}
  else{state.tab='round';main.innerHTML=roundHTML();bindRound();}
};

// In case Firebase initialized before this patch loaded, repaint with the final UI.
render();
