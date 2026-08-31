// Host-entry / viewer-only mode patch.
// Host: name + 1234 login, creates ROOM, enters all four scores.
// Viewer: ROOM code only, read-only realtime view.

state.viewerMode = false;
const viewerRoomStorageKey = 'golfBetLastViewerRoomV1';
const baseRoundHTML = roundHTML;
const baseLedgerHTML = ledgerHTML;

canEditPlayer = function(){
  return isHost();
};

loginHTML = function(){
  const lastRoom=(localStorage.getItem(viewerRoomStorageKey)||'').toUpperCase();
  const live=state.firebaseReady;
  const err=state.firebaseError;
  return `
    <section class="card hero login-hero">
      <div class="fs12" style="opacity:.8;font-weight:900">LIVE GOLF LEDGER</div>
      <h1>오늘 누가 쏴?</h1>
      <p>호스트 한 명이 4명 점수를 입력하고, 동반자는 ROOM 코드만 입력해 실시간 점수와 정산 금액을 확인합니다.</p>
    </section>

    <section class="card viewer-entry">
      <h2>동반자 바로 입장</h2>
      <div class="sub">로그인 없이 호스트에게 받은 <b>ROOM 코드</b>만 입력하세요.</div>
      <div class="join-big">
        <input id="viewerRoomCode" value="${escapeHtml(lastRoom)}" placeholder="ROOM CODE" maxlength="8" autocomplete="off" style="text-transform:uppercase">
        <button id="viewerJoinBtn" class="btn primary" ${live?'':'disabled'}>${live?'ROOM 입장':'서버 연결 확인 중'}</button>
      </div>
      <div id="viewerJoinMsg" class="mt8"></div>
    </section>

    <section class="card host-login-card">
      <h2>호스트 로그인</h2>
      <div class="sub">라운드를 만들고 4명의 점수를 입력할 사람만 로그인하세요.</div>
      <div class="stack">
        <div><label>호스트 이름</label><input id="loginName" maxlength="10" autocomplete="username" placeholder="예: 진우" value="${escapeHtml(identityName())}"></div>
        <div><label>비밀번호</label><input id="loginPw" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" placeholder="1234"></div>
        <button id="loginBtn" class="btn secondary block">호스트로 로그인</button>
        <div id="loginMsg"></div>
      </div>
    </section>

    ${!live?`<div class="notice error"><b>실시간 서버 연결 안 됨</b><br>${escapeHtml(err||'Firebase 연결을 확인하는 중입니다. 잠시 후 새로고침해 주세요.')}</div>`:''}`;
};

async function viewerJoinRoom(){
  const code=($('#viewerRoomCode')?.value||'').trim().toUpperCase();
  const msg=$('#viewerJoinMsg');
  if(!code){ if(msg) msg.innerHTML='<div class="notice error">ROOM 코드를 입력하세요.</div>'; return; }
  if(!state.firebaseReady){ if(msg) msg.innerHTML='<div class="notice error">실시간 서버가 아직 연결되지 않았습니다. 잠시 후 다시 시도하세요.</div>'; return; }
  if(msg) msg.innerHTML='<div class="notice">ROOM을 확인하는 중입니다...</div>';
  try{
    const {doc,getDoc}=state.fx;
    const readPromise=getDoc(doc(state.db,'rooms',code));
    const timeoutPromise=new Promise((_,reject)=>setTimeout(()=>reject(new Error('ROOM 확인 시간이 초과되었습니다. 인터넷 연결을 확인해 주세요.')),12000));
    const snap=await Promise.race([readPromise,timeoutPromise]);
    if(!snap.exists()){
      msg.innerHTML='<div class="notice error">ROOM을 찾을 수 없습니다. 코드를 다시 확인하세요.</div>';
      return;
    }
    if(state.unsub){state.unsub();state.unsub=null;}
    state.viewerMode=true;
    state.loginVerified=true;
    state.room=snap.data();
    state.myPlayerId=null;
    state.session={roomCode:code,host:false,viewer:true};
    state.tab='round';
    saveSession();
    localStorage.setItem(viewerRoomStorageKey,code);
    subscribeRoom(code);
    render();
  }catch(e){
    if(msg) msg.innerHTML=`<div class="notice error"><b>ROOM 입장 실패</b><br>${escapeHtml(e?.message||String(e))}</div>`;
  }
}

bindLogin = function(){
  const hostLogin=async()=>{
    const name=($('#loginName')?.value||'').trim();
    const pw=$('#loginPw')?.value||'';
    const msg=$('#loginMsg');
    if(!name){msg.innerHTML='<div class="notice error">호스트 이름을 입력하세요.</div>';return;}
    if(pw!==COMMON_PASSWORD){msg.innerHTML='<div class="notice error">비밀번호가 맞지 않습니다. 공통 비밀번호는 1234입니다.</div>';return;}
    state.viewerMode=false;
    state.identity={name};
    state.loginVerified=true;
    saveIdentity();
    if(state.session?.host===true && state.session?.roomCode) await resumeSession();
    else if(state.session?.viewer) clearRoomSession();
    render();
  };
  $('#loginBtn')?.addEventListener('click',hostLogin);
  $('#loginPw')?.addEventListener('keydown',e=>{if(e.key==='Enter')hostLogin();});
  $('#viewerJoinBtn')?.addEventListener('click',viewerJoinRoom);
  $('#viewerRoomCode')?.addEventListener('keydown',e=>{if(e.key==='Enter')viewerJoinRoom();});
};

homeHTML = function(){
  const saved=state.session?.host===true?state.session?.roomCode:null;
  const live=state.firebaseReady;
  const err=state.firebaseError;
  return `
    <section class="card hero">
      <div class="fs12" style="opacity:.8;font-weight:900">HOST MODE · ${escapeHtml(identityName())}</div>
      <h1>라운드 만들기</h1>
      <p>호스트가 4명의 점수를 모두 입력합니다. 동반자는 ROOM 코드로 접속해 실시간 결과만 확인합니다.</p>
    </section>
    <div class="grid2" style="margin-bottom:10px">
      <div class="notice success" style="margin:0"><b>● ${escapeHtml(identityName())}</b><br>호스트 로그인</div>
      <button id="logoutBtn" class="btn ghost">처음 화면으로</button>
    </div>
    ${live?`<div class="notice success"><b>● 실시간 서버 연결됨</b><br>ROOM을 만들 수 있습니다.</div>`:`<div class="notice error"><b>실시간 서버 연결 안 됨</b><br>${escapeHtml(err||'Firebase 연결을 확인하는 중입니다.')}</div>`}
    ${saved?`<button id="resumeBtn" class="btn secondary block" style="margin-bottom:10px">이전 ROOM ${escapeHtml(saved)} 다시 열기</button>`:''}
    <section class="card">
      <h2>새 ROOM 만들기</h2>
      <div class="sub">4명 이름을 입력한 뒤 ROOM을 만들면 6자리 코드가 생성됩니다.</div>
      <div class="stack">
        <div><label>라운드 이름</label><input id="gameTitle" value="오늘의 라운드" maxlength="30"></div>
        ${[1,2,3,4].map((n,i)=>`<div class="playerset"><div class="avatar">${n}</div><input id="name${n}" value="${i===0?escapeHtml(identityName()):`동반자 ${n}`}" maxlength="10" ${i===0?'readonly':''}></div>`).join('')}
        <button id="createRoomBtn" class="btn primary block" ${live?'':'disabled'}>${live?'ROOM 만들기':'실시간 서버 연결 확인 중'}</button>
        <div id="roomCreateMsg"></div>
      </div>
    </section>`;
};

bindHome = function(){
  $('#createRoomBtn')?.addEventListener('click',createRoom);
  $('#resumeBtn')?.addEventListener('click',async()=>{await resumeSession();render();});
  $('#logoutBtn')?.addEventListener('click',()=>{
    if(state.unsub){state.unsub();state.unsub=null;}
    state.room=null;state.myPlayerId=null;state.session=null;state.tab='home';state.viewerMode=false;state.identity=null;state.loginVerified=false;
    saveSession();saveIdentity();render();
  });
};

playersSetupHTML = function(editable){
  return `<section class="card"><h2>플레이어 4명</h2><div class="sub">호스트가 아래 4명의 스코어를 모두 입력합니다. 동반자 휴대폰은 보기 전용입니다.</div><div class="stack">${state.room.players.map((p,i)=>`<div class="playerset"><div class="avatar">${i+1}</div><div><input class="playerNameInput" data-id="${p.id}" value="${escapeHtml(p.name)}" maxlength="10" ${editable&&i>0?'':'readonly'}><div class="fs12 muted mt8">${i===0?'● 호스트':'○ 동반자 · 보기 전용'}</div></div></div>`).join('')}</div>${setupSaveButton('플레이어',editable)}</section>`;
};

scoreRowHTML = function(h,p,par){
  const v=scoreOf(h,p.id), editable=isHost(), desc=classify(v,par), confirmed=isConfirmed(h,p.id);
  const badge=confirmed?'<span class="confirm-badge done">완료</span>':Number.isFinite(v)?'<span class="confirm-badge draft">저장 전</span>':'<span class="confirm-badge">대기</span>';
  return `<div class="scorerow"><div class="scoretop"><div><div class="pname">${escapeHtml(p.name)}</div><div class="psub">${Number.isFinite(v)?desc:'아직 미입력'} · 누적 ${cumulativeToPar(p.id).holes?parLabel(cumulativeToPar(p.id).diff):'–'}</div></div><div class="score-number">${Number.isFinite(v)?v:'-'}</div>${badge}</div>${editable?`<div class="score-actions">${[-1,0,1,2,3].map(d=>{const sv=par+d,label=d===-1?'버디':d===0?'파':d===1?'보기':d===2?'더블':'트리플';return `<button class="score-choice ${v===sv?'on':''}" data-qplayer="${p.id}" data-score="${sv}">${label}</button>`}).join('')}<button class="score-choice other" data-other="${p.id}">기타</button></div><button class="save-score ${confirmed?'saved':''}" data-save-score="${p.id}" ${Number.isFinite(v)?'':'disabled'}>${confirmed?'✓ 입력 완료':'입력 저장'}</button>`:''}</div>`;
};

function viewerRoundHTML(){
  const h=currentHole(), par=state.room.pars[h-1], L=holeLedger(h), cum=cumulativeLedger(h), complete=holeComplete(h);
  const allTie=L.allTie===true, prevAllTie=h>1&&(state.room.rules.allTieCarry!==false)&&allTieHole(h-1);
  const triggers=state.room.rules.doubleTiming==='current'?triggerInfo(h):(h>1?triggerInfo(h-1):[]);
  const displayTriggers=[...(prevAllTie?['전 홀 전원 동타 이월']:[]),...triggers];
  const triggerText=allTie?(h<18?'전원 동타 · 이번 홀 0원 · 다음 홀 ×2':'전원 동타 · 이번 홀 0원'):(displayTriggers.length?`배판: ${[...new Set(displayTriggers)].join(' · ')}`:'배판 조건 없음');
  return `<div class="notice success viewer-live"><b>● 실시간 보기 전용</b><br>스코어 입력은 호스트가 합니다. 화면은 자동 갱신됩니다.</div>
    <div class="statusbar"><div class="names">${state.room.players.map(p=>{const c=cumulativeToPar(p.id);return `<span class="tinyplayer">${escapeHtml(p.name)}<b>${c.holes?parLabel(c.diff):'–'}</b></span>`}).join('')}</div><div class="roundprogress">${completedCount()}/18H</div></div>
    <section class="card holehero"><div class="holehead"><div><div class="par">PAR ${par}</div><div class="holeid">${h} HOLE</div></div><div class="mult ${allTie||L.mult===1?'normal':''}">${allTie?'0원':`× ${L.mult}`}</div></div><div class="trigger">${triggerText}</div></section>
    <section class="card"><h2>이번 홀 정산</h2><div class="moneygrid">${state.room.players.map(p=>moneyCard(p,complete?(L.net[p.id]||0):0)).join('')}</div><div class="sub mt12 mb0">${complete?'4명 입력 완료 · 금액 확정':'호스트가 4명 점수를 모두 저장하면 금액이 확정됩니다.'}</div></section>
    <section class="card"><h2>현재까지 누적</h2><div class="moneygrid">${state.room.players.map(p=>moneyCard(p,cum.net[p.id]||0)).join('')}</div></section>
    <section class="card scorecard"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">스코어 현황</h2><span class="fs12 ${complete?'plus':'muted'}">${complete?'● 4/4 확정':`○ ${confirmedCount(h)}/4 입력완료`}</span></div>${state.room.players.map(p=>scoreRowHTML(h,p,par)).join('')}</section>`;
}

roundHTML = function(){
  return state.viewerMode ? viewerRoundHTML() : baseRoundHTML();
};

ledgerHTML = function(){
  if(!state.viewerMode) return baseLedgerHTML();
  const cum=cumulativeLedger(18), transfers=minimalTransfers(cum.net), complete=completedCount();
  return `<div class="notice success viewer-live"><b>● 실시간 정산 보기</b><br>호스트 입력 결과가 자동 반영됩니다.</div>
    <section class="card"><h2>누적 정산</h2><div class="moneygrid mt12">${state.room.players.map(p=>moneyCard(p,cum.net[p.id]||0)).join('')}</div><div class="sub mt12 mb0">${complete}/18홀 입력 완료</div></section>
    <section class="card"><h2>최소 송금 정산</h2><div class="sub">전체 내역을 상계한 최종 이체 기준입니다.</div>${transfers.length?transfers.map(t=>`<div class="transfer"><div class="who"><b>${escapeHtml(getPlayer(t.from).name)}</b> <span class="arrow">→</span> <b>${escapeHtml(getPlayer(t.to).name)}</b></div><strong>${fmt(t.amt)}</strong></div>`).join(''):`<div class="center muted fs12">현재 정산할 금액이 없습니다.</div>`}</section>
    <section class="card"><h2>상대별 누적 원장</h2>${pairSummaryHTML(cum.pair)}</section>`;
};

render = function(){
  const main=$('#main'), nav=$('#bottomNav'), roomLine=$('#roomLine');
  if(!state.loginVerified){
    roomLine.classList.add('hidden');nav.classList.add('hidden');main.innerHTML=loginHTML();bindLogin();return;
  }
  if(state.room){
    roomLine.classList.remove('hidden');
    $('#roomCodeTop').textContent=state.room.code;
    $('#myIdentity').textContent=state.viewerMode?'동반자 보기':`호스트 · ${identityName()}`;
  }else roomLine.classList.add('hidden');
  if(!state.room){nav.classList.add('hidden');main.innerHTML=homeHTML();bindHome();return;}

  nav.classList.remove('hidden');
  const setupBtn=$('[data-tab="setup"]',nav);
  if(setupBtn) setupBtn.style.display=state.viewerMode?'none':'';
  nav.style.gridTemplateColumns=state.viewerMode?'repeat(2,1fr)':'repeat(3,1fr)';
  if(state.viewerMode&&state.tab==='setup') state.tab='round';
  $$('.navbtn',nav).forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));

  if(state.tab==='setup'&&!state.viewerMode){main.innerHTML=setupHTML();bindSetup();}
  else if(state.tab==='ledger'){main.innerHTML=ledgerHTML();bindLedger();}
  else {state.tab='round';main.innerHTML=roundHTML();bindRound();}
};
