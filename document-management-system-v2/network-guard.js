(()=>{
  const API_URL='https://mzwuwltiyzvxalqhcrzb.supabase.co/functions/v1/doc-api';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const isNetworkError=e=>e && (e.name==='TypeError'||e.name==='AbortError'||/fetch|network|load failed|abort|timeout/i.test(String(e.message||e)));

  class FriendlyApiError extends Error{
    constructor(message,code='API_ERROR',status=0){super(message);this.name='FriendlyApiError';this.code=code;this.status=status}
  }

  function ensureNetworkBox(){
    const loginMsg=document.getElementById('loginMsg');
    if(!loginMsg||document.getElementById('networkStatusBox')) return;
    const box=document.createElement('div');
    box.id='networkStatusBox';
    box.style.cssText='margin-top:8px;padding:10px 11px;border-radius:10px;font-size:11px;line-height:1.55;background:#f8fafc;border:1px solid #d8e1ec;color:#475569;display:none';
    loginMsg.insertAdjacentElement('afterend',box);
  }

  function showNet(message,type='info',showRetry=false){
    ensureNetworkBox();
    const box=document.getElementById('networkStatusBox');
    if(!box) return;
    const styles={
      info:['#f8fafc','#d8e1ec','#475569'],
      ok:['#f0fdf4','#bbf7d0','#14532d'],
      warn:['#fff7ed','#fed7aa','#7c2d12'],
      error:['#fff7f7','#fecaca','#7f1d1d']
    }[type]||['#f8fafc','#d8e1ec','#475569'];
    box.style.background=styles[0];box.style.borderColor=styles[1];box.style.color=styles[2];box.style.display='block';
    box.innerHTML=`${message}${showRetry?'<div style="margin-top:8px"><button id="networkRetryBtn" type="button" style="padding:7px 10px;border:0;border-radius:8px;background:#0f4c81;color:white;font-weight:800;cursor:pointer">연결 다시 확인</button></div>':''}`;
    if(showRetry){
      document.getElementById('networkRetryBtn')?.addEventListener('click',async()=>{
        const ok=await healthCheck(true);
        if(ok) document.getElementById('loginId')?.focus();
      });
    }
  }

  async function rawFetch(body,form=false,timeoutMs=12000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const options=form
        ?{method:'POST',body,signal:controller.signal,cache:'no-store'}
        :{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'};
      return await fetch(API_URL,options);
    }finally{clearTimeout(timer)}
  }

  async function resilientApi(body,form=false){
    if(typeof setLoading==='function') setLoading(true);
    const action=form?String(body.get?.('action')||''):String(body?.action||'');
    const safeToRetry=['systemStatus','login','me','listDocuments','listApprovers','listDocumentHistory'].includes(action);
    const attempts=safeToRetry?3:1;
    let lastError=null;
    try{
      for(let i=0;i<attempts;i++){
        if(!navigator.onLine){
          lastError=new FriendlyApiError('인터넷 연결이 끊어져 있습니다. 네트워크 연결 후 다시 시도해 주세요.','OFFLINE');
          if(i<attempts-1){await sleep(700*(i+1));continue}
          throw lastError;
        }
        try{
          const res=await rawFetch(body,form,12000);
          const text=await res.text();
          let data={};
          try{data=text?JSON.parse(text):{}}catch{data={error:text||'서버 응답을 해석하지 못했습니다.'}}
          if(!res.ok){
            const msg=data.error||`서버 오류 (${res.status})`;
            if(res.status===401) throw new FriendlyApiError(msg,'UNAUTHORIZED',401);
            if(res.status===403) throw new FriendlyApiError(msg,'FORBIDDEN',403);
            if(res.status>=500 && i<attempts-1){lastError=new FriendlyApiError(msg,'SERVER',res.status);await sleep(700*(i+1));continue}
            throw new FriendlyApiError(msg,'SERVER',res.status);
          }
          return data;
        }catch(e){
          if(e instanceof FriendlyApiError && ['UNAUTHORIZED','FORBIDDEN'].includes(e.code)) throw e;
          if(isNetworkError(e)){
            lastError=e?.name==='AbortError'
              ?new FriendlyApiError('서버 응답이 지연되고 있습니다. 자동 재시도 후에도 연결되지 않았습니다.','TIMEOUT')
              :new FriendlyApiError('문서관리 서버에 연결하지 못했습니다. 네트워크 또는 회사 보안망에서 Supabase 연결이 차단되었을 수 있습니다.','NETWORK');
            if(i<attempts-1){await sleep(700*(i+1));continue}
            throw lastError;
          }
          throw e;
        }
      }
      throw lastError||new FriendlyApiError('서버 연결에 실패했습니다.','NETWORK');
    }finally{if(typeof setLoading==='function') setLoading(false)}
  }

  async function healthCheck(show=true){
    if(!navigator.onLine){if(show)showNet('현재 인터넷 연결이 없습니다. Wi-Fi/LAN/VPN 상태를 확인해 주세요.','error',true);return false}
    if(show)showNet('문서관리 서버 연결 상태를 확인하는 중입니다.','info');
    try{
      const res=await rawFetch({action:'systemStatus'},false,8000);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      if(show)showNet('문서관리 서버 연결 정상 · 로그인할 수 있습니다.','ok');
      return true;
    }catch(e){
      const timeout=e?.name==='AbortError';
      if(show)showNet(timeout
        ?'서버 응답 시간이 초과되었습니다. 회사망/VPN을 바꾸거나 잠시 후 다시 시도해 주세요.'
        :'서버까지 연결되지 않습니다. 브라우저 캐시보다 네트워크·VPN·회사 보안망 차단 가능성이 높습니다.','error',true);
      return false;
    }
  }

  const originalLogin=window.login;
  window.api=resilientApi;
  try{api=resilientApi}catch(_){/* global binding may be readonly in some browsers */}

  window.login=async function(){
    const id=document.getElementById('loginId')?.value.trim()||'';
    const pw=document.getElementById('loginPw')?.value||'';
    const msg=document.getElementById('loginMsg');
    if(!id||!pw){if(msg)msg.textContent='사번과 비밀번호를 입력하세요.';return}
    if(msg){msg.style.color='#475569';msg.textContent='로그인 확인 중...'}
    showNet('네트워크와 서버 연결을 자동 확인합니다.','info');
    try{
      const j=await resilientApi({action:'login',employee_no:id,password:pw});
      sessionToken=j.token;user=j.user;localStorage.setItem('hdcDocSession',sessionToken);
      if(msg){msg.style.color='#15803d';msg.textContent='로그인 성공'}
      showNet('서버 연결 정상','ok');
      enterApp();
      if(user.must_change_password){pwDialog.showModal()}else await loadAll();
    }catch(e){
      if(msg)msg.style.color='#b91c1c';
      if(e.code==='UNAUTHORIZED'||e.code==='FORBIDDEN'){
        if(msg)msg.textContent=e.message;
        showNet('서버 연결은 정상입니다. 사번·비밀번호 또는 계정 상태를 확인해 주세요.','warn');
      }else if(e.code==='OFFLINE'){
        if(msg)msg.textContent='인터넷 연결이 없습니다.';
        showNet('인터넷 연결이 끊어져 있습니다. 연결 후 아래 버튼으로 재확인하세요.','error',true);
      }else if(e.code==='TIMEOUT'){
        if(msg)msg.textContent='서버 응답 지연으로 로그인하지 못했습니다.';
        showNet('자동으로 3회 재시도했지만 응답이 없었습니다. 회사망/VPN/보안프로그램을 확인해 주세요.','error',true);
      }else{
        if(msg)msg.textContent='서버 연결에 실패했습니다.';
        showNet('자동으로 3회 재시도했습니다. 계속 실패하면 회사 네트워크에서 supabase.co 접속이 차단되었는지 확인해 주세요.','error',true);
      }
    }
  };
  try{login=window.login}catch(_){ }

  window.addEventListener('online',()=>{showNet('인터넷 연결이 복구되었습니다. 서버 연결을 다시 확인합니다.','ok');healthCheck(true)});
  window.addEventListener('offline',()=>showNet('인터넷 연결이 끊어졌습니다. 연결 복구 후 다시 시도해 주세요.','error',true));
  document.addEventListener('DOMContentLoaded',()=>{ensureNetworkBox();setTimeout(()=>healthCheck(true),250)});
})();