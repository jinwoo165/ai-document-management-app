// New game reset + manual viewer refresh patch.
// Loaded last so it can extend the finalized personal-view workflow.

const baseSetupHTMLFinal = setupHTML;
const baseBindSetupFinal = bindSetup;
const basePersonalViewerRoundHTMLFinal = personalViewerRoundHTML;
const baseLedgerHTMLFinal = ledgerHTML;
const baseBindRoundFinal = bindRound;
const baseBindLedgerFinal = bindLedger;

function emptyHoleState(){
  return Object.fromEntries(Array.from({length:18},(_,i)=>[`h${i+1}`,{}]));
}

async function startNewGame(){
  if(!isHost() || !state.room || state.busy) return;
  const ok=confirm('새 게임을 시작할까요?\n\n현재 ROOM의 1~18홀 스코어와 정산 내역이 모두 초기화됩니다.\n플레이어·코스·내기 규칙과 호스트 로그인 상태는 그대로 유지됩니다.');
  if(!ok) return;

  const backup={
    scores:clone(state.room.scores||{}),
    confirmed:clone(state.room.confirmed||{}),
    manualDouble:clone(state.room.manualDouble||{}),
    currentHole:state.room.currentHole,
    status:state.room.status
  };

  const scores=emptyHoleState();
  const confirmed=emptyHoleState();
  const manualDouble={};
  const resetAt=Date.now();

  state.busy=true;
  state.room.scores=scores;
  state.room.confirmed=confirmed;
  state.room.manualDouble=manualDouble;
  state.room.currentHole=1;
  state.room.status='active';
  state.room.resetAt=resetAt;
  render();

  try{
    await persistRoom({scores,confirmed,manualDouble,currentHole:1,status:'active',resetAt,updatedAt:resetAt});
    state.tab='round';
    render();
    toast('새 게임 시작 · 1번홀로 초기화되었습니다.');
  }catch(e){
    state.room.scores=backup.scores;
    state.room.confirmed=backup.confirmed;
    state.room.manualDouble=backup.manualDouble;
    state.room.currentHole=backup.currentHole;
    state.room.status=backup.status;
    render();
    toast('새 게임 초기화에 실패했습니다. 인터넷 연결을 확인해 주세요.');
  }finally{
    state.busy=false;
  }
}

setupHTML=function(){
  const base=baseSetupHTMLFinal();
  if(!isHost()) return base;
  return `${base}
    <section class="card new-game-card">
      <h2>새 게임 시작하기</h2>
      <div class="sub">현재 ROOM과 로그인은 그대로 유지하고, <b>1~18홀 스코어·정산 기록만 전부 삭제</b>한 뒤 1번홀부터 다시 시작합니다.</div>
      <button id="newGameBtn" class="btn danger block new-game-btn" ${state.busy?'disabled':''}>↻ 새 게임 시작하기</button>
    </section>`;
};

bindSetup=function(){
  baseBindSetupFinal();
  $('#newGameBtn')?.addEventListener('click',startNewGame);
};

async function refreshViewerRoom(){
  if(!state.viewerMode || !state.room || !state.firebaseReady || state.busy) return;
  const btn=$('#viewerRefreshBtn');
  const old=btn?.textContent;
  state.busy=true;
  if(btn){btn.disabled=true;btn.textContent='새로고침 중...';}
  try{
    const code=state.room.code;
    const playerId=state.myPlayerId;
    const {doc,getDoc}=state.fx;
    const snap=await Promise.race([
      getDoc(doc(state.db,'rooms',code)),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('새로고침 시간이 초과되었습니다.')),10000))
    ]);
    if(!snap.exists()) throw new Error('ROOM을 찾을 수 없습니다.');
    const room=snap.data();
    if(!room.players?.some(p=>p.id===playerId)) throw new Error('선택한 플레이어 정보가 ROOM에 없습니다.');
    state.room=room;
    state.myPlayerId=playerId;
    render();
    toast('최신 정보로 새로고침했습니다.');
  }catch(e){
    toast(e?.message||'새로고침에 실패했습니다.');
    if(btn){btn.disabled=false;btn.textContent=old||'↻ 최신정보 새로고침';}
  }finally{
    state.busy=false;
  }
}

function viewerRefreshBar(){
  return `<div class="viewer-refresh-bar">
    <div><b>실시간 자동 반영</b><span>필요할 때 직접 최신 데이터를 다시 불러올 수 있습니다.</span></div>
    <button id="viewerRefreshBtn" class="btn secondary viewer-refresh-btn" ${state.busy?'disabled':''}>↻ 최신정보 새로고침</button>
  </div>`;
}

personalViewerRoundHTML=function(){
  return viewerRefreshBar()+basePersonalViewerRoundHTMLFinal();
};

ledgerHTML=function(){
  const base=baseLedgerHTMLFinal();
  return state.viewerMode ? viewerRefreshBar()+base : base;
};

bindRound=function(){
  baseBindRoundFinal();
  $('#viewerRefreshBtn')?.addEventListener('click',refreshViewerRoom);
};

bindLedger=function(){
  baseBindLedgerFinal();
  $('#viewerRefreshBtn')?.addEventListener('click',refreshViewerRoom);
};
