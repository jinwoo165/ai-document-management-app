// =============================================================
// Firebase 설정
// 아래 YOUR_... 항목을 Firebase 콘솔에서 받은 값으로 바꾸면
// 4대의 휴대폰이 같은 ROOM CODE로 실시간 동기화됩니다.
// 설정하지 않아도 이 파일 자체는 로컬 단독 모드로 작동합니다.
// =============================================================
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const VERSION = "1.5.0";
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const fmt = n => `${Math.abs(Math.round(n||0)).toLocaleString('ko-KR')}원`;
const signed = n => n > 0 ? `+${fmt(n)}` : n < 0 ? `-${fmt(n)}` : '0원';
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const clone = obj => JSON.parse(JSON.stringify(obj));
const rid = () => Math.random().toString(36).slice(2,8).toUpperCase();
const pid = i => `p${i+1}`;
const roomStorageKey = "golfBetSessionV1";
const demoStorageKey = "golfBetDemoRoomV1";
const identityStorageKey = "golfBetIdentityV1";
const bindingStorageKey = "golfBetPlayerBindingsV1";
const COMMON_PASSWORD = "1234";

const defaultPars = [4,4,3,5,4,4,5,3,4, 4,5,4,3,4,5,4,3,4];
const defaultRules = {
  baseAmount: 1000,
  maxDiff: 0,
  birdieBonus: 0,
  eagleBonus: 0,
  doubleTiming: 'current',
  triple: true,
  doublePar: false,
  birdieTrigger: false,
  threeTie: true,
  fourTie: false,
  allTieCarry: true,
  manualTriggerEnabled: true,
  maxMultiplier: 4,
  multiConditionStack: false,
  consecutiveCarry: false
};

function newRoom(names=['플레이어 1','플레이어 2','플레이어 3','플레이어 4']){
  return {
    code: rid(), title: '오늘의 라운드', createdAt: Date.now(), status: 'setup',
    players: names.map((name,i)=>({id:pid(i), name, claimedBy:null})), pars: [...defaultPars], rules: clone(defaultRules),
    scores: Object.fromEntries(Array.from({length:18},(_,h)=>[`h${h+1}`,{}])), manualDouble: {},
    confirmed: Object.fromEntries(Array.from({length:18},(_,h)=>[`h${h+1}`,{}])), currentHole: 1, updatedAt: Date.now()
  };
}

let state = {
  firebaseReady:false, firebaseError:'', db:null, auth:null, uid:null, unsub:null,
  room:null, session: JSON.parse(localStorage.getItem(roomStorageKey)||'null'),
  identity: JSON.parse(localStorage.getItem(identityStorageKey)||'null'), loginVerified:false,
  myPlayerId:null, tab:'home', setupTab:'players', setupDirty:false, busy:false
};

function configFilled(){ return FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('YOUR_') && !FIREBASE_CONFIG.projectId.startsWith('YOUR_'); }
async function initFirebase(){
  if(!configFilled()) { render(); return; }
  try{
    const [{initializeApp},{getAuth,signInAnonymously,onAuthStateChanged},{getFirestore,doc,getDoc,setDoc,updateDoc,onSnapshot,serverTimestamp,runTransaction}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'), import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'), import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    state.auth = getAuth(app); state.db = getFirestore(app);
    state.fx = {doc,getDoc,setDoc,updateDoc,onSnapshot,serverTimestamp,runTransaction,signInAnonymously,onAuthStateChanged};
    await signInAnonymously(state.auth);
    await new Promise(resolve => { const off = onAuthStateChanged(state.auth, u=>{ if(u){state.uid=u.uid; off(); resolve();} }); });
    state.firebaseReady=true;
    if(state.loginVerified && state.identity?.name && state.session?.roomCode){ await resumeSession(); }
  } catch(e){ state.firebaseError = e?.message || String(e); }
  render();
}
function saveSession(){ if(state.session) localStorage.setItem(roomStorageKey, JSON.stringify(state.session)); else localStorage.removeItem(roomStorageKey); }
function saveIdentity(){ if(state.identity?.name) localStorage.setItem(identityStorageKey, JSON.stringify(state.identity)); else localStorage.removeItem(identityStorageKey); }
function identityName(){ return (state.identity?.name||'').trim(); }
function normName(v=''){ return String(v).trim().toLocaleLowerCase('ko-KR'); }
function sameName(a,b){ return normName(a)===normName(b); }
function uniquePlayerNames(names){ return new Set(names.map(normName)).size===names.length; }
function playerBindings(){ try{return JSON.parse(localStorage.getItem(bindingStorageKey)||'{}')||{};}catch{return {};} }
function savedBinding(code){ const b=playerBindings()[String(code||'').toUpperCase()]; return b && sameName(b.identityName,identityName()) ? b : null; }
function saveBinding(code,playerId){ const all=playerBindings(); all[String(code||'').toUpperCase()]={identityName:identityName(),playerId,savedAt:Date.now()}; localStorage.setItem(bindingStorageKey,JSON.stringify(all)); }
function clearRoomSession(){ if(state.unsub){ state.unsub(); state.unsub=null; } state.room=null; state.myPlayerId=null; state.session=null; state.tab='home'; saveSession(); }
function saveDemo(){ if(state.room) localStorage.setItem(demoStorageKey, JSON.stringify(state.room)); }
async function persistRoom(patch=null){ if(!state.room) return; state.room.updatedAt = Date.now(); if(state.firebaseReady){ const {doc,setDoc,updateDoc}=state.fx; const ref=doc(state.db,'rooms',state.room.code); if(patch) await updateDoc(ref,patch); else await setDoc(ref,state.room,{merge:true}); } else saveDemo(); }
function subscribeRoom(code){
  if(!state.firebaseReady) return; if(state.unsub) state.unsub(); const {doc,onSnapshot}=state.fx;
  state.unsub=onSnapshot(doc(state.db,'rooms',code),snap=>{ if(!snap.exists()) return; state.firebaseError=''; state.room=snap.data(); if(!state.myPlayerId&&state.session?.playerId) state.myPlayerId=state.session.playerId; render(); },err=>{ state.firebaseError=err?.message||String(err); toast('실시간 연결에 문제가 생겼습니다. 인터넷 연결을 확인해 주세요.'); });
}
async function resumeSession(){
  const s=state.session; if(!s?.roomCode || !identityName()) return;
  if(state.firebaseReady){ const {doc,getDoc}=state.fx; const snap=await getDoc(doc(state.db,'rooms',s.roomCode)); if(snap.exists()){ const room=snap.data(),p=room.players?.find(x=>x.id===s.playerId); const sameLogin=s.identityName?sameName(s.identityName,identityName()):!!p&&sameName(p.name,identityName()); if(!p||!sameLogin){clearRoomSession();return;} state.room=room; state.myPlayerId=s.playerId; saveBinding(s.roomCode,s.playerId); state.tab=state.room.status==='setup'?'setup':'round'; subscribeRoom(s.roomCode); } }
  else { const saved=JSON.parse(localStorage.getItem(demoStorageKey)||'null'); if(saved?.code===s.roomCode){ const p=saved.players?.find(x=>x.id===s.playerId); const sameLogin=s.identityName?sameName(s.identityName,identityName()):!!p&&sameName(p.name,identityName()); if(!p||!sameLogin){clearRoomSession();return;} state.room=saved; state.myPlayerId=s.playerId; saveBinding(s.roomCode,s.playerId); state.tab=saved.status==='setup'?'setup':'round'; } }
}
function getPlayer(id){return state.room?.players?.find(p=>p.id===id)}
function myPlayer(){return getPlayer(state.myPlayerId)}
function isHost(){return state.session?.host===true}
function canEditPlayer(id){ return !state.firebaseReady || id===state.myPlayerId; }
function scoreOf(h,id){ const v=state.room?.scores?.[`h${h}`]?.[id]; return Number.isFinite(v)?v:null; }
function setScoreLocal(h,id,v){ state.room.scores||={}; state.room.scores[`h${h}`]||={}; state.room.scores[`h${h}`][id]=v; }
function allScores(h){ return state.room.players.map(p=>scoreOf(h,p.id)); }
function isConfirmed(h,id){ return state.room?.confirmed?.[`h${h}`]?.[id]===true; }
function setConfirmedLocal(h,id,v){ state.room.confirmed||={}; state.room.confirmed[`h${h}`]||={}; state.room.confirmed[`h${h}`][id]=!!v; }
function confirmedCount(h){ return state.room.players.filter(p=>isConfirmed(h,p.id)).length; }
function holeComplete(h){ return allScores(h).every(v=>Number.isFinite(v)) && state.room.players.every(p=>isConfirmed(h,p.id)); }
function cumulativeToPar(id,upTo=18){ let d=0,holes=0; for(let h=1;h<=upTo;h++){ if(!holeComplete(h))continue; const s=scoreOf(h,id); if(Number.isFinite(s)){d+=s-state.room.pars[h-1];holes++;} } return {diff:d,holes}; }
function parLabel(d){ return d===0?'E':d>0?`+${d}`:`${d}`; }
function classify(score,par){ if(!Number.isFinite(score))return '미입력'; const d=score-par; if(d<=-3)return '알바트로스';if(d===-2)return '이글';if(d===-1)return '버디';if(d===0)return '파';if(d===1)return '보기';if(d===2)return '더블';if(d===3)return '트리플';return `+${d}`; }
function allTieHole(h){ if(!holeComplete(h))return false; const scores=allScores(h); return scores.length===4&&scores.every(s=>s===scores[0]); }
function triggerInfo(h){ const room=state.room,r=room.rules,scores=allScores(h),par=room.pars[h-1]; if(!holeComplete(h))return[]; const t=[]; if(r.triple&&scores.some(s=>s-par>=3))t.push('트리플+'); if(r.doublePar&&scores.some(s=>s>=par*2))t.push('더블파'); if(r.birdieTrigger&&scores.some(s=>s<=par-1))t.push('버디-'); const counts={};scores.forEach(s=>counts[s]=(counts[s]||0)+1); if(r.threeTie&&Object.values(counts).some(c=>c===3))t.push('3명 동타'); if(r.fourTie&&r.allTieCarry===false&&Object.values(counts).some(c=>c===4))t.push('4명 동타'); if(r.manualTriggerEnabled&&room.manualDouble?.[`h${h}`])t.push('기타/수동'); return [...new Set(t)]; }
function multFromTriggers(list){ const r=state.room.rules; if(!list.length)return 1; if(r.multiConditionStack)return Math.min(r.maxMultiplier,Math.pow(2,list.length)); return Math.min(r.maxMultiplier,2); }
function holeMultiplier(h){ const r=state.room.rules; let mult=1; if(r.doubleTiming==='current'){mult=multFromTriggers(triggerInfo(h));}else if(h>1){const prev=triggerInfo(h-1);if(prev.length){if(r.consecutiveCarry){const prevMult=holeMultiplier(h-1);mult=Math.min(r.maxMultiplier,Math.max(2,prevMult*2));}else mult=multFromTriggers(prev);}} const allTieCarryOn=r.allTieCarry!==false; if(h>1&&allTieCarryOn&&allTieHole(h-1)){if(mult>1&&r.multiConditionStack)mult=Math.min(r.maxMultiplier,mult*2);else mult=Math.max(mult,2);} return mult; }
function holeLedger(h){ const room=state.room,r=room.rules,par=room.pars[h-1],scores=allScores(h); const net=Object.fromEntries(room.players.map(p=>[p.id,0])),pair={}; if(!holeComplete(h))return{net,pair,mult:holeMultiplier(h),complete:false,allTie:false}; if((r.allTieCarry!==false)&&allTieHole(h))return{net,pair,mult:1,complete:true,allTie:true}; const mult=holeMultiplier(h),unit=r.baseAmount*mult; for(let i=0;i<room.players.length;i++)for(let j=i+1;j<room.players.length;j++){const a=room.players[i],b=room.players[j];let diff=scores[j]-scores[i];if(r.maxDiff>0)diff=clamp(diff,-r.maxDiff,r.maxDiff);const amount=diff*unit;net[a.id]+=amount;net[b.id]-=amount;pair[`${a.id}_${b.id}`]=amount;} room.players.forEach((p,i)=>{const d=scores[i]-par;let bonus=0;if(d<=-2&&r.eagleBonus>0)bonus=r.eagleBonus;else if(d===-1&&r.birdieBonus>0)bonus=r.birdieBonus;if(bonus>0){room.players.forEach(o=>{if(o.id===p.id)return;net[p.id]+=bonus;net[o.id]-=bonus;const key=[p.id,o.id].sort().join('_');const pIsFirst=key.startsWith(p.id+'_');pair[key]=(pair[key]||0)+(pIsFirst?bonus:-bonus);});}}); return{net,pair,mult,complete:true,allTie:false}; }
function cumulativeLedger(upTo=18){ const net=Object.fromEntries(state.room.players.map(p=>[p.id,0])),pair={}; for(let h=1;h<=upTo;h++){const L=holeLedger(h);if(!L.complete)continue;Object.keys(net).forEach(id=>net[id]+=L.net[id]||0);Object.entries(L.pair).forEach(([k,v])=>pair[k]=(pair[k]||0)+v);} return{net,pair}; }
function minimalTransfers(net){ const creditors=[],debtors=[];Object.entries(net).forEach(([id,v])=>{if(v>0.5)creditors.push({id,amt:v});else if(v<-.5)debtors.push({id,amt:-v});});creditors.sort((a,b)=>b.amt-a.amt);debtors.sort((a,b)=>b.amt-a.amt);const out=[];let i=0,j=0;while(i<debtors.length&&j<creditors.length){const amt=Math.min(debtors[i].amt,creditors[j].amt);if(amt>0.5)out.push({from:debtors[i].id,to:creditors[j].id,amt});debtors[i].amt-=amt;creditors[j].amt-=amt;if(debtors[i].amt<.5)i++;if(creditors[j].amt<.5)j++;}return out; }
function relativePairs(id,pair){ const rows=[];state.room.players.filter(p=>p.id!==id).forEach(o=>{const a=[id,o.id].sort(),key=a.join('_');let v=pair[key]||0;if(a[0]!==id)v=-v;rows.push({other:o.id,amt:v});});return rows; }
function completedCount(){return Array.from({length:18},(_,i)=>holeComplete(i+1)).filter(Boolean).length}
function firstIncomplete(){for(let h=1;h<=18;h++)if(!holeComplete(h))return h;return 18}
function currentHole(){return clamp(state.room?.currentHole||firstIncomplete(),1,18)}
