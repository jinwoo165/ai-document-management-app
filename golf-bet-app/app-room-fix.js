// UX + reliability patch for ROOM creation / sharing

homeHTML = function(){
  const saved = state.session?.roomCode;
  const live = state.firebaseReady;
  const err = state.firebaseError;
  return `
    <section class="card hero">
      <div class="fs11" style="opacity:.75;font-weight:900">${escapeHtml(identityName())}님의 골프 장부</div>
      <h1>오늘 누가 쏴?<br>타수는 진짜, 정산은 자동.</h1>
      <p>호스트가 ROOM을 만든 뒤 생성된 코드를 동반자 3명에게 공유하면 모두 같은 라운드에 실시간 연결됩니다.</p>
    </section>

    <div class="grid2" style="margin-bottom:8px">
      <div class="notice success" style="margin:0"><b>● ${escapeHtml(identityName())}</b><br>로그인 완료</div>
      <button id="logoutBtn" class="btn ghost">다른 이름으로 로그인</button>
    </div>

    ${live
      ? `<div class="notice success"><b>● 실시간 서버 연결됨</b><br>이제 ROOM을 만들거나 기존 ROOM에 참가할 수 있습니다.</div>`
      : `<div class="notice error"><b>실시간 서버 연결 안 됨</b><br>${escapeHtml(err || 'Firebase 연결을 확인하는 중입니다. 잠시 후 새로고침해 주세요.')}</div>`}

    ${saved?`<button id="resumeBtn" class="btn secondary block" style="margin-bottom:10px">이전 ROOM ${escapeHtml(saved)} 다시 열기</button>`:''}

    <section class="card">
      <h2>① 내가 호스트 · 새 ROOM 만들기</h2>
      <div class="sub">ROOM 코드는 로그인할 때 생기는 것이 아니라, 아래 <b>ROOM 만들기</b>를 눌렀을 때 자동 생성됩니다.</div>
      <div class="stack">
        <div><label>라운드 이름</label><input id="gameTitle" value="오늘의 라운드" maxlength="30"></div>
        ${[1,2,3,4].map((n,i)=>`<div class="playerset"><div class="avatar">${n}</div><input id="name${n}" value="${i===0?escapeHtml(identityName()):`동반자 ${n}`}" maxlength="10" ${i===0?'readonly':''}></div>`).join('')}
        <button id="createRoomBtn" class="btn primary block" ${live?'':'disabled'}>${live?'ROOM 만들기':'실시간 서버 연결 확인 중'}</button>
        <div id="roomCreateMsg"></div>
      </div>
    </section>

    <section class="card">
      <h2>② 나는 동반자 · ROOM 참가하기</h2>
      <div class="sub">호스트가 만들어서 알려준 6자리 ROOM CODE를 입력하세요.</div>
      <div class="grid2">
        <input id="joinCode" placeholder="예: A7K3P2" maxlength="8" style="text-transform:uppercase" ${live?'':'disabled'}>
        <button id="autoJoinBtn" class="btn primary" ${live?'':'disabled'}>ROOM 참가</button>
      </div>
      <div id="joinSlots" class="mt12"></div>
    </section>`;
};

createRoom = async function(){
  const btn=$('#createRoomBtn');
  const msg=$('#roomCreateMsg');

  if(!state.firebaseReady){
    if(msg) msg.innerHTML='<div class="notice error">실시간 서버가 연결되지 않아 ROOM을 만들 수 없습니다. 페이지를 새로고침해 주세요.</div>';
    return;
  }
  if(state.busy) return;

  const names=[1,2,3,4].map(i=>(($(`#name${i}`)?.value)||`플레이어 ${i}`).trim());
  names[0]=identityName();
  if(names.some(n=>!n)){ toast('플레이어 이름을 모두 입력하세요.'); return; }
  if(!uniquePlayerNames(names)){ toast('같은 ROOM에서는 플레이어 이름을 중복할 수 없습니다.'); return; }

  const room=newRoom(names);
  room.title=($('#gameTitle')?.value||'').trim()||'오늘의 라운드';
  room.players[0].claimedBy=state.uid;

  state.busy=true;
  if(btn){btn.disabled=true;btn.textContent='ROOM 생성 중...';}
  if(msg) msg.innerHTML='<div class="notice">Firebase에 실시간 ROOM을 생성하는 중입니다...</div>';

  try{
    const {doc,setDoc}=state.fx;
    await setDoc(doc(state.db,'rooms',room.code),room);

    state.room=room;
    state.myPlayerId='p1';
    state.session={roomCode:room.code,playerId:'p1',host:true,identityName:identityName()};
    saveSession();
    saveBinding(room.code,'p1');
    state.tab='setup';
    subscribeRoom(room.code);
    render();
    toast(`ROOM ${room.code} 생성 완료`);
  }catch(e){
    const text=e?.code==='permission-denied'
      ? 'Firestore 권한이 거부되었습니다. Firebase의 Firestore Rules가 게시되어 있는지 확인해 주세요.'
      : (e?.message||String(e));
    state.firebaseError=text;
    if(msg) msg.innerHTML=`<div class="notice error"><b>ROOM 생성 실패</b><br>${escapeHtml(text)}</div>`;
    if(btn){btn.disabled=false;btn.textContent='ROOM 만들기';}
  }finally{
    state.busy=false;
  }
};

setupHTML = function(){
  const editable=isHost()||!state.firebaseReady;
  return `
    <section class="card" style="text-align:center;background:#f7fbf8">
      <div class="fs11 muted">동반자에게 이 코드를 공유하세요</div>
      <div style="font-size:32px;font-weight:1000;letter-spacing:5px;color:var(--brand);margin:5px 0">${escapeHtml(state.room.code)}</div>
      <div class="fs11 muted">4명 모두 같은 ROOM에 들어와야 실시간 스코어가 공유됩니다.</div>
    </section>
    <div class="setupnav">
      <button class="btn ${state.setupTab==='players'?'active':'ghost'}" data-st="players">플레이어</button>
      <button class="btn ${state.setupTab==='course'?'active':'ghost'}" data-st="course">18홀</button>
      <button class="btn ${state.setupTab==='rules'?'active':'ghost'}" data-st="rules">내기 규칙</button>
    </div>
    ${!editable?`<div class="notice">설정은 ROOM 생성자만 변경할 수 있습니다. 현재 설정은 실시간으로 확인할 수 있습니다.</div>`:''}
    ${state.setupTab==='players'?playersSetupHTML(editable):state.setupTab==='course'?courseSetupHTML(editable):rulesSetupHTML(editable)}
    <section class="card"><div class="grid2">
      <button id="copyRoom" class="btn secondary">ROOM 코드 복사</button>
      ${editable?`<button id="startRound" class="btn primary">${state.room.status==='active'?'라운드로 이동':'라운드 시작'}</button>`:`<button id="goRound" class="btn primary">라운드 보기</button>`}
    </div></section>`;
};
