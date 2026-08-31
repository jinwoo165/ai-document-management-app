// v14 login UI refinement for /golf-bet-live/
// - Host name always starts blank on the first login screen.
// - Viewer ROOM code always starts blank.
// - Viewer entry is the primary action.
// - Host login is intentionally compact and secondary.

const v14HostPassword = typeof v12HostPassword === 'function' ? v12HostPassword : function(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const p={};parts.forEach(x=>{if(x.type!=='literal')p[x.type]=x.value;});
  return `${p.year}${p.month}${p.day}`;
};

(function addV14LoginStyles(){
  if(document.getElementById('v14LoginStyles'))return;
  const style=document.createElement('style');
  style.id='v14LoginStyles';
  style.textContent=`
    .login-hero-v14{padding:18px 18px 16px;margin-bottom:10px}
    .login-hero-v14 h1{font-size:28px;margin:5px 0 6px}
    .login-hero-v14 p{margin:0;font-size:14px;line-height:1.45}

    .viewer-entry-v14{
      border:2px solid #0b5f3b;
      box-shadow:0 8px 22px rgba(11,95,59,.12);
      padding:18px;
      margin-bottom:12px;
    }
    .viewer-entry-v14 .entry-kicker{font-size:12px;font-weight:900;color:#0b5f3b;letter-spacing:.04em;margin-bottom:3px}
    .viewer-entry-v14 h2{font-size:23px;margin:0 0 6px}
    .viewer-entry-v14 .sub{font-size:14px;margin-bottom:12px}
    .viewer-room-input{
      width:100%;
      min-height:52px;
      font-size:20px!important;
      font-weight:900;
      text-align:center;
      letter-spacing:.08em;
      margin-bottom:10px;
    }
    .viewer-room-input::placeholder{color:#a6aea9;font-weight:700;letter-spacing:0}
    .viewer-enter-btn{
      width:100%;
      min-height:56px;
      font-size:18px!important;
      font-weight:900;
      border-radius:13px;
      box-shadow:0 5px 12px rgba(11,95,59,.18);
    }

    .host-login-compact{
      padding:12px 14px;
      margin-top:8px;
      border:1px solid #dfe5e1;
      box-shadow:none;
      background:#fafbfa;
    }
    .host-login-compact .host-title-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
    .host-login-compact h3{font-size:14px;margin:0;color:#66736b}
    .host-login-compact .host-badge{font-size:10px;color:#8a958e;background:#eef1ef;border-radius:999px;padding:4px 7px}
    .host-login-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:7px}
    .host-login-grid input{min-height:40px;font-size:14px!important;padding:9px 10px}
    .host-login-btn{min-height:40px;font-size:13px!important;padding:9px 12px}
    .host-login-compact #loginMsg .notice{font-size:12px;padding:8px 10px;margin-top:7px}

    @media(max-width:390px){
      .host-login-grid{grid-template-columns:1fr 1fr}
      .host-login-grid input{font-size:13px!important;padding:8px}
    }
  `;
  document.head.appendChild(style);
})();

loginHTML=function(){
  const live=state.firebaseReady;
  const err=state.firebaseError;
  return `
    <section class="card hero login-hero-v14">
      <div class="fs12" style="opacity:.8;font-weight:900">LIVE GOLF LEDGER</div>
      <h1>오늘 누가 쏴?</h1>
      <p>ROOM에 입장해 실시간 스코어와 정산을 확인하세요.</p>
    </section>

    <section class="card viewer-entry-v14">
      <div class="entry-kicker">동반자 전용</div>
      <h2>동반자 입장</h2>
      <div class="sub">호스트에게 받은 ROOM 코드를 입력한 뒤 본인 이름을 선택하세요.</div>
      <input id="viewerRoomCode" class="viewer-room-input" value="" placeholder="룸코드 입력" maxlength="8" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase">
      <button id="viewerJoinBtn" class="btn primary viewer-enter-btn" ${live?'':'disabled'}>${live?'동반자 입장':'서버 연결 확인 중'}</button>
      <div id="viewerJoinMsg" class="mt8"></div>
    </section>

    <section class="card host-login-compact">
      <div class="host-title-row"><h3>호스트 로그인</h3><span class="host-badge">HOST</span></div>
      <div class="host-login-grid">
        <input id="loginName" value="" maxlength="10" autocomplete="off" placeholder="호스트 이름">
        <input id="loginPw" type="password" inputmode="numeric" maxlength="8" autocomplete="off" placeholder="비밀번호">
      </div>
      <button id="loginBtn" class="btn ghost block host-login-btn">호스트 로그인</button>
      <div id="loginMsg"></div>
    </section>

    ${!live?`<div class="notice error"><b>실시간 서버 연결 안 됨</b><br>${escapeHtml(err||'서버 연결을 확인하는 중입니다. 잠시 후 다시 시도해 주세요.')}</div>`:''}`;
};

bindLogin=function(){
  const hostLogin=async()=>{
    const name=($('#loginName')?.value||'').trim();
    const pw=$('#loginPw')?.value||'';
    const msg=$('#loginMsg');
    if(!name){msg.innerHTML='<div class="notice error">호스트 이름을 입력하세요.</div>';return;}
    if(pw!==v14HostPassword()){
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

document.documentElement.dataset.loginUi='v14';
render();
