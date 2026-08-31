// Firestore transport reliability patch for mobile browsers / restrictive networks.
// Loaded after app-part1.js and before app startup.

initFirebase = async function(){
  if(!configFilled()) { render(); return; }
  try{
    const [{initializeApp},{getAuth,signInAnonymously,onAuthStateChanged},{initializeFirestore,doc,getDoc,setDoc,updateDoc,onSnapshot,serverTimestamp,runTransaction}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')
    ]);

    const app = initializeApp(FIREBASE_CONFIG);
    state.auth = getAuth(app);
    state.db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      experimentalLongPollingOptions: { timeoutSeconds: 10 }
    });
    state.fx = {doc,getDoc,setDoc,updateDoc,onSnapshot,serverTimestamp,runTransaction,signInAnonymously,onAuthStateChanged};

    const authTimeout = new Promise((_,reject)=>setTimeout(()=>reject(new Error('Firebase 인증 서버 응답이 지연되고 있습니다. 인터넷 연결을 확인해 주세요.')),12000));
    await Promise.race([signInAnonymously(state.auth), authTimeout]);

    await Promise.race([
      new Promise(resolve => {
        const off = onAuthStateChanged(state.auth, u=>{ if(u){state.uid=u.uid; off(); resolve();} });
      }),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Firebase 로그인 확인 시간이 초과되었습니다.')),12000))
    ]);

    state.firebaseReady=true;
    state.firebaseError='';
    if(state.loginVerified && state.identity?.name && state.session?.roomCode){ await resumeSession(); }
  } catch(e){
    state.firebaseReady=false;
    state.firebaseError = e?.message || String(e);
  }
  render();
};
