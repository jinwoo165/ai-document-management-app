// v22
// Settlement header: show the host-saved betting rules to host and companions.

(function v22Styles(){
  if(document.getElementById('v22Styles')) return;
  const s=document.createElement('style');
  s.id='v22Styles';
  s.textContent=`
    .v22-rules-btn{height:42px;padding:0 12px;border:1px solid #d8e1dc;background:#fff;border-radius:10px;font-size:13px;font-weight:900;color:#315844;white-space:nowrap}
    .v22-rules-modal{width:min(96vw,520px);max-height:88vh;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.25)}
    .v22-rules-body{overflow:auto;max-height:72vh;padding:12px 14px 18px}
    .v22-rules-status{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#eef8f2;border:1px solid #c7e2d1;border-radius:12px;padding:10px 11px;margin-bottom:11px}
    .v22-rules-status strong{font-size:14px;color:#0b6a40}
    .v22-rules-status span{font-size:11px;font-weight:800;color:#718078}
    .v22-rule-section{border:1px solid #e0e7e3;border-radius:13px;padding:12px;margin-bottom:10px;background:#fbfcfb}
    .v22-rule-section h3{font-size:16px;margin:0 0 9px;font-weight:1000}
    .v22-rule-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .v22-rule-item{background:#fff;border:1px solid #e5ebe7;border-radius:10px;padding:9px 8px;min-width:0}
    .v22-rule-item span{display:block;font-size:11px;color:#718078;font-weight:800;margin-bottom:3px}
    .v22-rule-item b{display:block;font-size:15px;line-height:1.25;font-weight:1000;word-break:keep-all}
    .v22-trigger-list{display:flex;flex-wrap:wrap;gap:6px}
    .v22-trigger-chip{display:inline-flex;align-items:center;min-height:31px;padding:0 9px;border-radius:999px;background:#eef6f1;border:1px solid #cfe0d5;font-size:12px;font-weight:900;color:#315844}
    .v22-trigger-chip.manual{background:#fff5e8;border-color:#efd0a5;color:#945a10}
    .v22-rule-note{font-size:12px;line-height:1.5;color:#58655e;font-weight:700;margin-top:8px}
    @media(max-width:390px){
      .v15-head-actions{gap:5px!important}
      .v22-rules-btn{height:40px;padding:0 9px;font-size:12px}
      .v15-score-open{padding-left:9px!important;padding-right:9px!important}
      .v22-rule-grid{gap:6px}
      .v22-rule-item{padding:8px 7px}
      .v22-rule-item b{font-size:14px}
    }
  `;
  document.head.appendChild(s);
})();

function v22RuleSummaryHTML(){
  const r=state.room?.rules||{};
  const timing=r.doubleTiming==='next'?'다음 홀':'발생한 홀';
  const maxDiff=Number(r.maxDiff||0)>0?`${Number(r.maxDiff)}타`:'제한 없음';
  const triggers=[];
  if(r.triple) triggers.push('트리플 이상');
  if(r.doublePar) triggers.push('더블파');
  if(r.birdieTrigger) triggers.push('버디 이상');
  if(r.threeTie) triggers.push('3명 동타');
  if(r.fourTie && r.allTieCarry===false) triggers.push('4명 동타');
  if(r.manualTriggerEnabled) triggers.push('땅!!');

  const triggerHTML=triggers.length
    ?triggers.map(t=>`<span class="v22-trigger-chip ${t==='땅!!'?'manual':''}">${escapeHtml(t)}</span>`).join('')
    :'<span class="v22-trigger-chip">자동 배판 조건 없음</span>';

  const allTieText=r.allTieCarry===false?'별도 이월 없음':'당홀 0원 · 다음 홀 ×2';
  const stackText=r.multiConditionStack?'조건 중복 시 배수 중첩':'중복 조건도 1회 배판';
  const carryText=r.consecutiveCarry?'연속 배판 누적':'연속 배판 별도 누적 안 함';

  return `<div class="v15-modal-backdrop" id="v22RulesBackdrop">
    <div class="v22-rules-modal" role="dialog" aria-modal="true" aria-label="내기 규칙">
      <div class="v15-modal-head"><div><div class="fs11 muted">ROOM ${escapeHtml(state.room.code)}</div><h2>내기 규칙</h2></div><button id="v22RulesClose" class="v15-modal-close" aria-label="닫기">×</button></div>
      <div class="v22-rules-body">
        <div class="v22-rules-status"><strong>✓ 현재 ROOM 저장 규칙</strong><span>호스트 설정 기준</span></div>

        <section class="v22-rule-section">
          <h3>기본 정산</h3>
          <div class="v22-rule-grid">
            <div class="v22-rule-item"><span>1타당 금액</span><b>${fmt(Number(r.baseAmount||0))}</b></div>
            <div class="v22-rule-item"><span>타수차 상한</span><b>${escapeHtml(maxDiff)}</b></div>
            <div class="v22-rule-item"><span>버디 보너스 / 1인당</span><b>${fmt(Number(r.birdieBonus||0))}</b></div>
            <div class="v22-rule-item"><span>이글 이상 / 1인당</span><b>${fmt(Number(r.eagleBonus||0))}</b></div>
          </div>
        </section>

        <section class="v22-rule-section">
          <h3>배판 적용</h3>
          <div class="v22-rule-grid" style="margin-bottom:9px">
            <div class="v22-rule-item"><span>배판 적용 시점</span><b>${timing}</b></div>
            <div class="v22-rule-item"><span>최대 배수</span><b>×${Number(r.maxMultiplier||1)}</b></div>
          </div>
          <div class="v22-trigger-list">${triggerHTML}</div>
        </section>

        <section class="v22-rule-section">
          <h3>특수 규칙</h3>
          <div class="v22-rule-grid">
            <div class="v22-rule-item"><span>4명 전원 동타</span><b>${escapeHtml(allTieText)}</b></div>
            <div class="v22-rule-item"><span>조건 중복</span><b>${escapeHtml(stackText)}</b></div>
            <div class="v22-rule-item"><span>연속 배판</span><b>${escapeHtml(carryText)}</b></div>
            <div class="v22-rule-item"><span>수동 배판</span><b>${r.manualTriggerEnabled?'땅!! 사용':'사용 안 함'}</b></div>
          </div>
          <div class="v22-rule-note">이 팝업은 호스트가 ROOM에 저장한 현재 내기 규칙을 표시합니다.</div>
        </section>
      </div>
    </div>
  </div>`;
}

function v22OpenRules(){
  if(!state.room) return;
  const root=$('#modalRoot');
  root.innerHTML=v22RuleSummaryHTML();
  $('#v22RulesClose')?.addEventListener('click',()=>root.innerHTML='');
  $('#v22RulesBackdrop')?.addEventListener('click',e=>{if(e.target.id==='v22RulesBackdrop')root.innerHTML='';});
}

function v22AddRulesButton(){
  const actions=$('.v15-head-actions');
  if(!actions || $('#v22RulesBtn')) return;
  const scoreBtn=$('#openScoreTable');
  if(!scoreBtn) return;
  const b=document.createElement('button');
  b.id='v22RulesBtn';
  b.type='button';
  b.className='v22-rules-btn';
  b.textContent='내기 규칙';
  b.addEventListener('click',v22OpenRules);
  actions.insertBefore(b,scoreBtn);
}

const v22BaseBindLedger=bindLedger;
bindLedger=function(){
  v22BaseBindLedger();
  v22AddRulesButton();
};

// In case this file is loaded while the settlement screen is already rendered.
v22AddRulesButton();

document.documentElement.dataset.rulesPopup='v22';
