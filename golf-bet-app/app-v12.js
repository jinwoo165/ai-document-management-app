// v12 hard fix: host login password is Korea current date YYYYMMDD.
// No password hint is shown in the UI.

function v12HostPassword(){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date());
  const p={};
  parts.forEach(x=>{if(x.type!=='literal')p[x.type]=x.value;});
  return `${p.year}${p.month}${p.day}`;
}

loginHTML=function(){
  const lastRoom=(localStorage.getItem(viewerRoomStorageKey)||'').toUpperCase();
  const live=state.firebaseReady;
  const err=state.firebaseError;
  return `
    <section class="card hero login-hero">
      <div class="fs12" style="opacity:.8;font-weight:900">LIVE GOLF LEDGER</div>
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
      <div class="stack">
        <div><label>호스트 이름</label><input id="loginName" maxlength="10" autocomplete="username" placeholder="이름" value="${escapeHtml(identityName())}"></div>
        <div><label>비밀번호</label><input id="loginPw" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password" placeholder="비밀번호"></div>
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
    if(pw!==v12HostPassword()){
      msg.innerHTML='<div class="notice error">비밀번호가 맞지 않습니다.</div>';
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

document.documentElement.dataset.golfBuild='v12';
render();
