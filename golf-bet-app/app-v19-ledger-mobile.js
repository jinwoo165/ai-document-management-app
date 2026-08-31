// v19 settlement readability for smartphones
// Host and companion share the same settlement screen.
// Larger type + clearly separated current-hole and cumulative zones.

(function v19LedgerStyles(){
  if(document.getElementById('v19LedgerStyles')) return;
  const s=document.createElement('style');
  s.id='v19LedgerStyles';
  s.textContent=`
    .v19-ledger{font-size:14px}
    .v19-ledger .v15-ledger-head{margin-bottom:11px}
    .v19-ledger .v15-ledger-head h1{font-size:27px!important;line-height:1.1}
    .v19-ledger .v15-ledger-head .fs11{font-size:12px!important}
    .v19-ledger .v15-score-open{font-size:14px!important;font-weight:900;height:42px;padding:0 13px}
    .v19-ledger .v15-icon-btn{width:42px;height:42px;font-size:24px}

    .v19-ledger .v15-hole-picker{padding:15px!important;margin-bottom:13px!important}
    .v19-ledger .v15-section-title{margin-bottom:10px}
    .v19-ledger .v15-section-title h2{font-size:19px!important;line-height:1.2}
    .v19-ledger .v15-section-title>b{font-size:16px}
    .v19-ledger .hchip{font-size:14px!important;font-weight:900!important;min-height:36px}

    .v19-ledger .v15-score-strip{gap:6px;margin-top:11px}
    .v19-ledger .v15-score-cell{padding:9px 3px;border-radius:10px}
    .v19-ledger .v15-score-cell span{font-size:12px!important;font-weight:800}
    .v19-ledger .v15-score-cell b{font-size:21px!important;margin-top:3px}
    .v19-ledger .v15-score-cell em{font-size:11px!important;margin-top:3px}

    .v19-ledger .v18-bet-reason{padding:10px 11px;min-height:42px;margin-top:11px}
    .v19-ledger .v18-bet-reason span{font-size:12px!important}
    .v19-ledger .v18-bet-reason b{font-size:14px!important}
    .v19-ledger .v18-bet-reason em{font-size:14px!important}

    .v19-settlement-zone{border-radius:17px;padding:11px 10px 3px;margin:0 0 16px}
    .v19-current-zone{background:#eef8f2;border:2px solid #b8d9c4}
    .v19-total-zone{background:#f1f4f8;border:2px solid #c2ccd7}
    .v19-zone-head{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:2px 4px 10px}
    .v19-zone-head .eyebrow{font-size:11px;font-weight:900;letter-spacing:.04em;margin-bottom:2px}
    .v19-current-zone .eyebrow{color:#0b6a40}
    .v19-total-zone .eyebrow{color:#415a73}
    .v19-zone-head h2{font-size:21px!important;line-height:1.1;margin:0}
    .v19-zone-head .zone-note{font-size:12px;font-weight:800;color:#718078;white-space:nowrap}
    .v19-zone-gap{height:8px}

    .v19-ledger .v15-ledger-card{padding:15px!important;margin-bottom:10px!important}
    .v19-current-zone .v15-ledger-card:last-child,
    .v19-total-zone .v15-ledger-card:last-child{margin-bottom:8px!important}
    .v19-ledger .v18-current-card,
    .v19-ledger .v18-total-card{box-shadow:none!important}
    .v19-ledger .v18-kind{height:25px;padding:0 9px;font-size:11px!important;margin-right:7px}
    .v19-ledger .confirm-badge{font-size:12px!important;padding:5px 8px}

    .v19-ledger .moneygrid{gap:7px!important}
    .v19-ledger .moneycard{padding:11px 5px!important;border-radius:11px}
    .v19-ledger .moneycard .name{font-size:13px!important;font-weight:900}
    .v19-ledger .moneycard .amt{font-size:20px!important;line-height:1.15;margin-top:4px}

    .v19-ledger .transfer{padding:11px 2px!important;min-height:44px}
    .v19-ledger .transfer .who{font-size:14px!important;line-height:1.3}
    .v19-ledger .transfer>strong{font-size:16px!important;white-space:nowrap}
    .v19-ledger .arrow{font-size:15px}
    .v19-ledger .copybtn{font-size:12px!important;padding:7px 9px}

    .v19-ledger .pairgrid{margin-top:8px!important}
    .v19-ledger .pair{font-size:14px!important;min-height:38px;padding:8px 2px}
    .v19-ledger .pair b{font-size:15px!important}
    .v19-ledger .center.muted.fs12{font-size:13px!important;line-height:1.45}

    @media(max-width:390px){
      .v19-ledger{font-size:14px}
      .v19-ledger .v15-ledger-head h1{font-size:25px!important}
      .v19-ledger .v15-score-open{font-size:13px!important;height:40px;padding:0 11px}
      .v19-ledger .v15-icon-btn{width:40px;height:40px}
      .v19-ledger .hchip{font-size:13px!important;min-height:34px}
      .v19-ledger .v15-score-cell span{font-size:11px!important}
      .v19-ledger .v15-score-cell b{font-size:20px!important}
      .v19-ledger .v15-score-cell em{font-size:10px!important}
      .v19-zone-head h2{font-size:20px!important}
      .v19-zone-head .zone-note{font-size:11px}
      .v19-ledger .moneycard .name{font-size:12px!important}
      .v19-ledger .moneycard .amt{font-size:19px!important}
      .v19-ledger .transfer .who{font-size:13px!important}
      .v19-ledger .transfer>strong{font-size:15px!important}
    }
  `;
  document.head.appendChild(s);
})();

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

    <section class="v19-settlement-zone v19-current-zone">
      <div class="v19-zone-head"><div><div class="eyebrow">CURRENT HOLE</div><h2>${h}번홀 정산</h2></div><div class="zone-note">이 홀만</div></div>

      <section class="card v15-ledger-card current-hole-ledger v18-current-card">
        <div class="v15-section-title"><div class="v18-title-with-kind"><span class="v18-kind">당홀</span><h2>개인별 손익</h2></div><span class="confirm-badge ${hole.L.complete?'done':''}">${hole.L.complete?'확정':'입력 대기'}</span></div>
        <div class="moneygrid">${state.room.players.map(p=>moneyCard(p,hole.net[p.id]||0)).join('')}</div>
      </section>

      <section class="card v15-ledger-card v18-current-sub"><div class="v15-section-title"><div class="v18-title-with-kind"><span class="v18-kind" style="background:#dcebe2;color:#315b43">당홀</span><h2>상계 정산</h2></div></div>${v15Transfers(hole.transfers,'현재 당홀 정산할 금액이 없습니다.')}</section>
    </section>

    <div class="v19-zone-gap"></div>

    <section class="v19-settlement-zone v19-total-zone">
      <div class="v19-zone-head"><div><div class="eyebrow">ROUND TOTAL</div><h2>라운드 누적 정산</h2></div><div class="zone-note">${complete}/18H 완료</div></div>

      <section class="card v15-ledger-card v18-total-card">
        <div class="v15-section-title"><div class="v18-title-with-kind"><span class="v18-kind">누적</span><h2>개인별 누적 손익</h2></div></div>
        <div class="moneygrid">${state.room.players.map(p=>moneyCard(p,cum.net[p.id]||0)).join('')}</div>
      </section>

      <section class="card v15-ledger-card v18-total-sub"><div class="v15-section-title"><div class="v18-title-with-kind"><span class="v18-kind" style="background:#e2e8ef;color:#415a73">누적</span><h2>상계 후 한번에 정산</h2></div><button id="copySummary" class="copybtn">결과 복사</button></div>${v15Transfers(cumTransfers,'현재 누적 정산할 금액이 없습니다.')}</section>

      <section class="card v15-ledger-card"><div class="v15-section-title"><h2>상대별 누적 원장</h2></div>${pairSummaryHTML(cum.pair)}</section>
    </section>
  </div>`;
};

document.documentElement.dataset.ledgerMobile='v19';
render();
