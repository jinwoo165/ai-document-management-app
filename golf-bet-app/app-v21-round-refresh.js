// v21
// 1) Host round: remove per-hole money summary from the bottom of score entry.
// 2) Settlement refresh: after fetching latest room data, jump to the latest completed hole.

function v21HostRoundHTML(){
  const h=currentHole();
  const par=state.room.pars[h-1];
  const L=holeLedger(h);
  const complete=holeComplete(h);
  const allTie=L.allTie===true;
  const prevAllTie=h>1&&(state.room.rules.allTieCarry!==false)&&allTieHole(h-1);
  const triggers=state.room.rules.doubleTiming==='current'?triggerInfo(h):(h>1?triggerInfo(h-1):[]);
  const displayTriggers=[...(prevAllTie?['전 홀 전원 동타 이월']:[]),...triggers];
  const triggerText=allTie
    ?(h<18?'전원 동타 · 이번 홀 0원 · 다음 홀 ×2':'전원 동타 · 이번 홀 0원')
    :(displayTriggers.length?`배판: ${[...new Set(displayTriggers)].join(' · ')}`:'배판 조건 없음');
  const entered=enteredScoreCount(h);

  return `<div class="statusbar"><div class="names">${state.room.players.map(p=>{const c=cumulativeToPar(p.id);return `<span class="tinyplayer">${escapeHtml(p.name)}<b>${c.holes?parLabel(c.diff):'–'}</b></span>`}).join('')}</div><div class="roundprogress">${completedCount()}/18H</div></div>

    <section class="card holehero"><div class="holehead"><div><div class="par">PAR ${par}</div><div class="holeid">${h} HOLE</div></div><div class="mult ${allTie||L.mult===1?'normal':''}">${allTie?'0원':`× ${L.mult}`}</div></div><div class="trigger">${triggerText}</div></section>

    <section class="card roundnav" style="margin-bottom:9px">
      <div class="roundnavtop"><button id="prevHole" class="btn ghost small" ${h===1?'disabled':''}>← 이전</button><b>${h}/18</b><button id="nextHole" class="btn secondary small" ${h===18?'disabled':''}>다음 →</button></div>
      <div class="holetrack">${Array.from({length:18},(_,i)=>{const n=i+1;return `<button class="hchip ${n===h?'current':holeComplete(n)?'done':'pending'}" data-hole="${n}">${n}</button>`}).join('')}</div>
    </section>

    <section class="card scorecard">
      <div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">4명 스코어</h2><span class="fs12 ${complete?'plus':'muted'}">${complete?'● 확정 · 수정 가능':`${entered}/4 입력`}</span></div>
      ${state.room.players.map(p=>scoreRowHTML(h,p,par)).join('')}
      ${state.room.rules.manualTriggerEnabled?`<div class="switchrow v15-manual-double"><div class="switchcopy"><strong>땅!! 배판!!</strong><span>필요할 때 수동으로 배판 적용</span></div><label class="switch"><input id="manualDouble" type="checkbox" ${state.room.manualDouble?.[`h${h}`]?'checked':''}><span class="slider"></span></label></div>`:''}
      <button id="confirmAllScores" class="btn primary block confirm-all" ${(entered!==4||complete||state.busy)?'disabled':''}>${complete?'✓ 4명 입력완료':state.busy?'저장 중...':'4명 입력완료'}</button>
      <div class="sub center mb0" style="margin-top:7px">위 홀 번호를 눌러 이전 홀도 바로 수정할 수 있습니다. 수정한 홀은 다시 입력완료하면 재정산됩니다.</div>
    </section>`;
}

v16HostRoundHTML=v21HostRoundHTML;
v15HostRoundHTML=v21HostRoundHTML;
roundHTML=function(){
  return state.viewerMode ? ledgerHTML() : v21HostRoundHTML();
};

function v21LatestCompletedHole(){
  for(let h=18;h>=1;h--){
    if(holeComplete(h)) return h;
  }
  return clamp(Number(state.room?.currentHole||1),1,18);
}

v15RefreshRoom=async function(){
  if(!state.room||!state.firebaseReady||state.busy)return;
  const btn=$('#v15RefreshBtn');
  state.busy=true;
  if(btn){btn.disabled=true;btn.textContent='…';}
  try{
    const code=state.room.code;
    const playerId=state.myPlayerId;
    const {doc,getDoc}=state.fx;
    const snap=await Promise.race([
      getDoc(doc(state.db,'rooms',code)),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('새로고침 시간이 초과되었습니다.')),10000))
    ]);
    if(!snap.exists())throw new Error('ROOM을 찾을 수 없습니다.');
    state.room=snap.data();
    state.myPlayerId=playerId;
    state.v13LedgerHole=v21LatestCompletedHole();
    render();
    toast(`${state.v13LedgerHole}번홀 최신 정산으로 이동했습니다.`);
  }catch(e){
    toast(e?.message||'새로고침에 실패했습니다.');
  }finally{
    state.busy=false;
    if($('#v15RefreshBtn'))$('#v15RefreshBtn').textContent='↻';
  }
};

document.documentElement.dataset.roundRefresh='v21';
render();
