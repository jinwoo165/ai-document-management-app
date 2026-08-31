// v10 correction: settlement is CURRENT HOLE + CUMULATIVE, not monthly.
// Loaded after app-v10.js.

const v10cBaseBindLedger = bindLedger;

startNewGame=async function(){
  if(!isHost()||!state.room||state.busy)return;
  const ok=confirm('새 게임을 시작할까요?\n\n현재 ROOM의 1~18홀 스코어와 정산 기록이 모두 삭제되고 1번홀부터 다시 시작합니다.\n플레이어·코스·내기 규칙·호스트 로그인·ROOM 코드는 그대로 유지됩니다.');
  if(!ok)return;
  const backup=clone(state.room);
  const scores=emptyHoleState(),confirmed=emptyHoleState(),manualDouble={};
  const now=Date.now();
  state.busy=true;
  Object.assign(state.room,{scores,confirmed,manualDouble,currentHole:1,status:'active',resetAt:now,gameStartedAt:now});
  delete state.room.settlementHistory;
  render();
  try{
    await persistRoom({scores,confirmed,manualDouble,currentHole:1,status:'active',resetAt:now,gameStartedAt:now,settlementHistory:[],updatedAt:now});
    state.tab='round';render();toast('새 게임 시작 · 모든 기록이 초기화되었습니다.');
  }catch(e){state.room=backup;render();toast('새 게임 초기화에 실패했습니다. 인터넷 연결을 확인해 주세요.');}
  finally{state.busy=false;}
};

applyLineupChange=async function(){
  if(!isHost()||state.busy)return;
  const inputs=$$('.playerNameInput');
  const names=inputs.map(x=>(x.value||'').trim());
  names[0]=identityName();
  if(names.some(n=>!n)){toast('플레이어 이름을 모두 입력하세요.');return;}
  if(!uniquePlayerNames(names)){toast('플레이어 이름은 서로 달라야 합니다.');return;}
  ensurePlayerBaseline();
  if(names.every((n,i)=>n===state.playerBaseline[i])){toast('변경된 동반자 이름이 없습니다.');return;}
  const changedNames=names.filter((n,i)=>n!==state.playerBaseline[i]);
  if(!confirm(`동반자를 변경할까요?\n\n새 ROOM 코드가 생성되고 기존 게임 기록은 모두 삭제됩니다.\n변경: ${changedNames.join(', ')}`))return;

  const oldRoom=state.room,oldCode=oldRoom.code;
  const room=newRoom(names);
  room.title=oldRoom.title;
  room.pars=clone(oldRoom.pars);
  room.rules=clone(oldRoom.rules);
  room.status='active';
  room.players[0].claimedBy=state.uid;
  room.gameStartedAt=Date.now();
  room.currentHole=1;
  room.scores=emptyHoleState();
  room.confirmed=emptyHoleState();
  room.manualDouble={};

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
};

function currentHoleSettlement(){
  const h=currentHole(),ledger=holeLedger(h);
  const net=ledger.complete?ledger.net:Object.fromEntries(state.room.players.map(p=>[p.id,0]));
  const transfers=ledger.complete?minimalTransfers(net):[];
  return {h,ledger,net,transfers};
}

ledgerHTML=function(){
  const hole=currentHoleSettlement();
  const cum=cumulativeLedger(18);
  const cumulativeTransfers=minimalTransfers(cum.net);
  const complete=completedCount();
  return `${state.viewerMode?viewerRefreshBar():''}
    <section class="card current-hole-ledger">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
        <div><div class="fs12 muted">CURRENT HOLE</div><h2 style="margin:3px 0 0">${hole.h}번홀 당홀 정산</h2></div>
        <span class="confirm-badge ${hole.ledger.complete?'done':''}">${hole.ledger.complete?'확정':'입력 대기'}</span>
      </div>
      <div class="moneygrid mt12">${state.room.players.map(p=>moneyCard(p,hole.net[p.id]||0)).join('')}</div>
      <div class="sub mt12 mb0">${hole.ledger.complete?'이 홀의 확정 스코어 기준 금액입니다.':'호스트가 4명 점수를 입력완료하면 당홀 금액이 표시됩니다.'}</div>
    </section>

    <section class="card">
      <h2>${hole.h}번홀 · 상계 후 한번에 정산</h2>
      <div class="sub">이 홀에서 서로 주고받을 금액을 상계해 최소 송금만 표시합니다.</div>
      ${hole.transfers.length?hole.transfers.map(t=>`<div class="transfer"><div class="who"><b>${escapeHtml(getPlayer(t.from).name)}</b> <span class="arrow">→</span> <b>${escapeHtml(getPlayer(t.to).name)}</b></div><strong>${fmt(t.amt)}</strong></div>`).join(''):'<div class="center muted fs12" style="padding:12px 0">현재 당홀 정산할 금액이 없습니다.</div>'}
    </section>

    <section class="card">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
        <div><div class="fs12 muted">TOTAL</div><h2 style="margin:3px 0 0">누적 정산</h2></div>
        <button id="copySummary" class="copybtn">결과 복사</button>
      </div>
      <div class="moneygrid mt12">${state.room.players.map(p=>moneyCard(p,cum.net[p.id]||0)).join('')}</div>
      <div class="sub mt12 mb0">${complete}/18홀 확정 기준</div>
    </section>

    <section class="card">
      <h2>누적 · 상계 후 한번에 정산</h2>
      <div class="sub">지금까지 완료된 모든 홀의 금액을 합쳐 서로 받을 돈과 줄 돈을 상계한 최종 송금안입니다.</div>
      ${cumulativeTransfers.length?cumulativeTransfers.map(t=>`<div class="transfer"><div class="who"><b>${escapeHtml(getPlayer(t.from).name)}</b> <span class="arrow">→</span> <b>${escapeHtml(getPlayer(t.to).name)}</b></div><strong>${fmt(t.amt)}</strong></div>`).join(''):'<div class="center muted fs12" style="padding:12px 0">현재 누적 정산할 금액이 없습니다.</div>'}
    </section>

    <section class="card"><h2>상대별 누적 원장</h2>${pairSummaryHTML(cum.pair)}</section>`;
};

summaryText=function(){
  const hole=currentHoleSettlement(),cum=cumulativeLedger(18),cumTransfers=minimalTransfers(cum.net);
  return `[${state.room.title}] 골프 정산\nROOM ${state.room.code}\n\n[${hole.h}번홀 당홀]\n`+
    state.room.players.map(p=>`${p.name}: ${signed(hole.net[p.id]||0)}`).join('\n')+
    `\n\n[${hole.h}번홀 상계]\n`+
    (hole.transfers.length?hole.transfers.map(t=>`${getPlayer(t.from).name} → ${getPlayer(t.to).name}: ${fmt(t.amt)}`).join('\n'):'정산 없음')+
    `\n\n[누적]\n`+state.room.players.map(p=>`${p.name}: ${signed(cum.net[p.id]||0)}`).join('\n')+
    `\n\n[누적 상계]\n`+
    (cumTransfers.length?cumTransfers.map(t=>`${getPlayer(t.from).name} → ${getPlayer(t.to).name}: ${fmt(t.amt)}`).join('\n'):'정산 없음');
};

bindLedger=function(){
  v10cBaseBindLedger();
  $('#viewerRefreshBtn')?.addEventListener('click',refreshViewerRoom);
  $('#copySummary')?.addEventListener('click',()=>copyText(summaryText(),'정산 결과가 복사되었습니다.'));
};
