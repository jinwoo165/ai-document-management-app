// v20 settlement focus
// Make current-hole vs round-total sections unmistakably different.
// Make the actual netted payment instructions the strongest visual element.

(function v20Styles(){
  if(document.getElementById('v20Styles')) return;
  const s=document.createElement('style');
  s.id='v20Styles';
  s.textContent=`
    .v20-zone{position:relative;overflow:hidden;border-radius:20px!important;padding:0 10px 10px!important;margin-bottom:20px!important}
    .v20-zone::before{content:"";display:block;height:7px;margin:0 -10px 12px}
    .v20-current-zone{background:#edf9f2!important;border:2px solid #8fc8a5!important}
    .v20-current-zone::before{background:#0b6a40}
    .v20-total-zone{background:#eef3f9!important;border:2px solid #9aafc3!important}
    .v20-total-zone::before{background:#385a7a}

    .v20-zone-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 4px 12px}
    .v20-zone-title{display:flex;align-items:center;gap:9px;min-width:0}
    .v20-zone-no{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:16px;font-weight:1000;flex:none}
    .v20-current-zone .v20-zone-no{background:#0b6a40}
    .v20-total-zone .v20-zone-no{background:#385a7a}
    .v20-zone-copy small{display:block;font-size:11px;font-weight:900;letter-spacing:.06em;margin-bottom:2px}
    .v20-current-zone .v20-zone-copy small{color:#0b6a40}
    .v20-total-zone .v20-zone-copy small{color:#385a7a}
    .v20-zone-copy strong{display:block;font-size:23px;line-height:1.08}
    .v20-zone-state{font-size:12px;font-weight:900;color:#66736c;text-align:right;white-space:nowrap}

    .v20-summary-card{border:0!important;box-shadow:none!important;margin-bottom:8px!important}
    .v20-current-zone .v20-summary-card{background:rgba(255,255,255,.76)!important}
    .v20-total-zone .v20-summary-card{background:rgba(255,255,255,.78)!important}

    .v20-pay-card{border-radius:15px!important;margin-bottom:0!important;padding:14px!important;box-shadow:0 7px 18px rgba(0,0,0,.07)!important}
    .v20-current-zone .v20-pay-card{border:2px solid #23935b!important;background:#fff!important}
    .v20-total-zone .v20-pay-card{border:2px solid #52789d!important;background:#fff!important}
    .v20-pay-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
    .v20-pay-head-left{display:flex;align-items:center;gap:8px}
    .v20-pay-icon{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;color:#fff;font-size:17px;font-weight:1000}
    .v20-current-zone .v20-pay-icon{background:#159052}
    .v20-total-zone .v20-pay-icon{background:#496f94}
    .v20-pay-title{font-size:20px!important;font-weight:1000!important;line-height:1.1;margin:0!important}
    .v20-pay-caption{font-size:12px;font-weight:800;color:#6b776f;line-height:1.35;margin:2px 0 10px}

    .v20-transfer-list{display:grid;gap:8px}
    .v20-transfer-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;border-radius:12px;padding:12px 12px;min-height:62px}
    .v20-current-zone .v20-transfer-row{background:#effaf3;border:1px solid #c3e4cf}
    .v20-total-zone .v20-transfer-row{background:#f0f5fa;border:1px solid #cbd8e4}
    .v20-transfer-who{display:flex;align-items:center;gap:6px;min-width:0;font-size:16px;font-weight:900;line-height:1.2}
    .v20-transfer-who b{font-size:17px;font-weight:1000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .v20-transfer-arrow{font-size:18px;font-weight:1000;flex:none}
    .v20-current-zone .v20-transfer-arrow{color:#0b6a40}
    .v20-total-zone .v20-transfer-arrow{color:#385a7a}
    .v20-transfer-amt{font-size:22px!important;font-weight:1000!important;letter-spacing:-.03em;white-space:nowrap}
    .v20-current-zone .v20-transfer-amt{color:#06703f}
    .v20-total-zone .v20-transfer-amt{color:#244f76}
    .v20-empty-pay{padding:16px 8px;text-align:center;font-size:15px;font-weight:900;color:#7a8580;background:#f7f9f8;border-radius:12px}

    .v20-total-zone .v20-pay-card{position:relative}
    .v20-total-zone .v20-pay-card::before{content:"최종 송금 기준";position:absolute;right:12px;top:-11px;background:#385a7a;color:#fff;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:1000;letter-spacing:.03em}

    .v20-divider{display:flex;align-items:center;gap:9px;margin:3px 0 16px;color:#8b9690}
    .v20-divider::before,.v20-divider::after{content:"";height:1px;background:#cfd8d3;flex:1}
    .v20-divider span{font-size:11px;font-weight:900;white-space:nowrap}

    .v19-ledger .moneycard .amt{font-weight:1000!important}
    .v19-ledger .moneycard .name{font-weight:1000!important}

    @media(max-width:390px){
      .v20-zone-copy strong{font-size:22px}
      .v20-pay-title{font-size:19px!important}
      .v20-transfer-row{padding:11px 10px;gap:7px;min-height:60px}
      .v20-transfer-who{font-size:15px}
      .v20-transfer-who b{font-size:16px}
      .v20-transfer-amt{font-size:21px!important}
    }
  `;
  document.head.appendChild(s);
})();

function v20TransferCards(list,emptyText){
  if(!list.length) return `<div class="v20-empty-pay">${emptyText}</div>`;
  return `<div class="v20-transfer-list">${list.map(t=>{
    const from=getPlayer(t.from),to=getPlayer(t.to);
    return `<div class="v20-transfer-row">
      <div class="v20-transfer-who"><b>${escapeHtml(from?.name||'')}</b><span class="v20-transfer-arrow">→</span><b>${escapeHtml(to?.name||'')}</b></div>
      <strong class="v20-transfer-amt">${fmt(t.amt)}</strong>
    </div>`;
  }).join('')}</div>`;
}

ledgerHTML=function(){
  const h=v15LedgerHole();
  const hole=v15HoleSettlement(h);
  const cum=cumulativeLedger(18);
  const cumTransfers=minimalTransfers(cum.net);
  const complete=completedCount();
  const reason=v18BetReason(h);

  return `<div class="v19-ledger">
    <div class="v15-ledger-head">
      <div><div class="fs11 muted">ROOM ${escapeHtml(state.room.code)}</div><h1>정산</h1></div>
      <div class="v15-head-actions"><button id="openScoreTable" class="v15-score-open">전체 스코어</button><button id="v15RefreshBtn" class="v15-icon-btn" aria-label="새로고침" title="새로고침">↻</button></div>
    </div>

    <section class="card v15-ledger-card v15-hole-picker">
      <div class="v15-section-title"><h2>당홀 선택</h2><b>${h}H</b></div>
      <div class="holetrack ledger-holetrack">${Array.from({length:18},(_,i)=>{const n=i+1;return `<button class="hchip ${n===h?'current':holeComplete(n)?'done':'pending'}" data-ledger-hole="${n}">${n}</button>`}).join('')}</div>
      ${v15HoleScoreStrip(h)}
      <div class="v18-bet-reason ${reason.active?'active':''}"><span>배판 사유</span><b>${escapeHtml(reason.text)}</b><em>${reason.mult>1?`×${reason.mult}`:'×1'}</em></div>
    </section>

    <section class="v19-settlement-zone v19-current-zone v20-zone v20-current-zone">
      <div class="v20-zone-header">
        <div class="v20-zone-title"><span class="v20-zone-no">1</span><div class="v20-zone-copy"><small>CURRENT HOLE</small><strong>${h}번홀 정산</strong></div></div>
        <div class="v20-zone-state">${hole.L.complete?'정산 확정':'입력 대기'}</div>
      </div>

      <section class="card v15-ledger-card v20-summary-card">
        <div class="v15-section-title"><h2>개인별 당홀 손익</h2></div>
        <div class="moneygrid">${state.room.players.map(p=>moneyCard(p,hole.net[p.id]||0)).join('')}</div>
      </section>

      <section class="card v15-ledger-card v20-pay-card">
        <div class="v20-pay-head"><div class="v20-pay-head-left"><span class="v20-pay-icon">₩</span><h2 class="v20-pay-title">당홀 실제 주고받을 금액</h2></div></div>
        <div class="v20-pay-caption">상계 적용 후 이 금액대로 주고받으면 됩니다.</div>
        ${v20TransferCards(hole.transfers,'이 홀에서 실제 주고받을 금액이 없습니다.')}
      </section>
    </section>

    <div class="v20-divider"><span>라운드 전체 누적</span></div>

    <section class="v19-settlement-zone v19-total-zone v20-zone v20-total-zone">
      <div class="v20-zone-header">
        <div class="v20-zone-title"><span class="v20-zone-no">2</span><div class="v20-zone-copy"><small>ROUND TOTAL</small><strong>누적 정산</strong></div></div>
        <div class="v20-zone-state">${complete}/18H 완료</div>
      </div>

      <section class="card v15-ledger-card v20-summary-card">
        <div class="v15-section-title"><h2>개인별 누적 손익</h2></div>
        <div class="moneygrid">${state.room.players.map(p=>moneyCard(p,cum.net[p.id]||0)).join('')}</div>
      </section>

      <section class="card v15-ledger-card v20-pay-card">
        <div class="v20-pay-head"><div class="v20-pay-head-left"><span class="v20-pay-icon">₩</span><h2 class="v20-pay-title">최종 실제 주고받을 금액</h2></div><button id="copySummary" class="copybtn">결과 복사</button></div>
        <div class="v20-pay-caption">현재까지 모든 거래를 상계한 최종 송금 기준입니다.</div>
        ${v20TransferCards(cumTransfers,'현재 최종 정산할 금액이 없습니다.')}
      </section>

      <section class="card v15-ledger-card"><div class="v15-section-title"><h2>상대별 누적 원장</h2></div>${pairSummaryHTML(cum.pair)}</section>
    </section>
  </div>`;
};

document.documentElement.dataset.settlementFocus='v20';
render();
