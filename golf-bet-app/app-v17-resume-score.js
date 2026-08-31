// v17
// 1) Score popup: cumulative score row at the top.
// 2) Host: automatically resume the saved in-progress ROOM after reopening the app.

const v17BaseRender = render;
const v17BaseScoreTableHTML = v15ScoreTableHTML;

(function v17Styles(){
  if(document.getElementById('v17Styles')) return;
  const s=document.createElement('style');
  s.id='v17Styles';
  s.textContent=`
    .v17-total-row td{background:#eef6f1!important;font-weight:900!important;border-bottom:2px solid #bfd7c8!important;padding-top:9px!important;padding-bottom:9px!important}
    .v17-total-row td:first-child{color:#0b5f3b!important}
    .v17-total-score{display:block;font-size:15px;line-height:1.05}
    .v17-total-rel{display:block;font-size:9px;color:#718078;margin-top:3px;font-weight:800}
    .v17-restore-card{margin-top:28px;text-align:center;padding:28px 18px}
    .v17-restore-spin{width:34px;height:34px;border:3px solid #dce8e1;border-top-color:#0b5f3b;border-radius:50%;margin:0 auto 14px;animation:v17spin .8s linear infinite}
    @keyframes v17spin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(s);
})();

function v17PlayerAccumulated(playerId){
  let strokes=0;
  let parSum=0;
  let holes=0;
  for(let h=1;h<=18;h++){
    if(!holeComplete(h)) continue;
    const score=scoreOf(h,playerId);
    if(!Number.isFinite(score)) continue;
    strokes+=score;
    parSum+=state.room.pars[h-1];
    holes++;
  }
  return {strokes,holes,diff:strokes-parSum};
}

v15ScoreTableHTML=function(){
  const myId=state.myPlayerId;
  const totals=Object.fromEntries(state.room.players.map(p=>[p.id,v17PlayerAccumulated(p.id)]));
  return `<div class="v15-modal-backdrop" id="v15ScoreModalBackdrop">
    <div class="v15-modal" role="dialog" aria-modal="true" aria-label="전체 스코어">
      <div class="v15-modal-head"><div><div class="fs11 muted">18 HOLES</div><h2>전체 스코어</h2></div><button id="v15ScoreModalClose" class="v15-modal-close" aria-label="닫기">×</button></div>
      <div class="v15-score-table-wrap">
        <table class="v15-score-table">
          <thead><tr><th>H</th>${state.room.players.map(p=>`<th class="${p.id===myId?'mine':''}">${escapeHtml(p.name)}</th>`).join('')}</tr></thead>
          <tbody>
            <tr class="v17-total-row"><td>누계</td>${state.room.players.map(p=>{
              const t=totals[p.id];
              const rel=t.holes?(t.diff===0?'E':t.diff>0?`+${t.diff}`:`${t.diff}`):'-';
              return `<td class="${p.id===myId?'mine':''}"><span class="v17-total-score">${t.holes?t.strokes:'-'}</span><span class="v17-total-rel">${t.holes?`${rel} · ${t.holes}H`:'-'}</span></td>`;
            }).join('')}</tr>
            ${Array.from({length:18},(_,i)=>{const h=i+1;return `<tr><td>${h}</td>${state.room.players.map(p=>{const s=scoreOf(h,p.id);return `<td class="${p.id===myId?'mine':''}">${Number.isFinite(s)?s:'-'}</td>`}).join('')}</tr>`}).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
};

// v15OpenScoreTable resolves v15ScoreTableHTML dynamically, so replacing the
// function above updates both host and companion score popups.

function v17HasHostSession(){
  return !!(state.session?.host===true && state.session?.roomCode && state.session?.playerId && state.identity?.name);
}

render=function(){
  if(state.v17RestoringHost && !state.room){
    const main=$('#main'),nav=$('#bottomNav'),roomLine=$('#roomLine');
    document.body.classList.remove('v15-viewer-mode');
    nav?.classList.add('hidden');
    roomLine?.classList.add('hidden');
    if(main) main.innerHTML=`<section class="card v17-restore-card"><div class="v17-restore-spin"></div><h2>진행 중인 게임 불러오는 중</h2><div class="sub mb0">저장된 ROOM에 다시 연결하고 있습니다.</div></section>`;
    return;
  }
  return v17BaseRender();
};

async function v17ResumeSavedHost(){
  if(!v17HasHostSession() || state.room) return;

  state.viewerMode=false;
  state.loginVerified=true;
  state.v17RestoringHost=true;
  render();

  const started=Date.now();
  while(!state.firebaseReady && !state.firebaseError && Date.now()-started<15000){
    await new Promise(r=>setTimeout(r,100));
  }

  if(!state.firebaseReady){
    state.v17RestoringHost=false;
    state.loginVerified=false;
    render();
    return;
  }

  try{
    await resumeSession();
    if(state.room && state.session?.host===true){
      state.viewerMode=false;
      state.loginVerified=true;
      state.tab='round';
      state.v17RestoringHost=false;
      render();
      return;
    }
  }catch(e){
    console.warn('Host session restore failed',e);
  }

  state.v17RestoringHost=false;
  state.loginVerified=false;
  render();
}

// Run after all UI overrides have loaded. The stored host name is used only
// internally for session matching; the normal first-login form remains blank.
setTimeout(v17ResumeSavedHost,0);

document.documentElement.dataset.resumeScore='v17';
render();
