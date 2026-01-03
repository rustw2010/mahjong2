import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { Trophy, RotateCcw, Flame, History, Settings, Hash, BarChart3, X, Medal, User } from 'lucide-react';

// --- 請在此替換為你的真實 Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyDmMN7yIVbwb9_ypF-fSY-94nVEqKBeMDo",
  authDomain: "mahjong2-1f2c9.firebaseapp.com",
  projectId: "mahjong2-1f2c9",
  storageBucket: "mahjong2-1f2c9.firebasestorage.app",
  messagingSenderId: "868980971876",
  appId: "1:868980971876:web:96411a84493ff9620c0271",
  measurementId: "G-XBHTER1YWL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'mahjong-ultimate';

const POSITIONS = ['東', '南', '西', '北'];

export default function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState('setup');
  const [gameData, setGameData] = useState({
    players: [
      { name: '', score: 0, stats: { win: 0, self: 0, deal: 0 } },
      { name: '', score: 0, stats: { win: 0, self: 0, deal: 0 } },
      { name: '', score: 0, stats: { win: 0, self: 0, deal: 0 } },
      { name: '', score: 0, stats: { win: 0, self: 0, deal: 0 } },
    ],
    settings: { base: 100, perTai: 50 },
    currentDealerIndex: 0,
    dealerShifts: 0,
    streak: 0,
    history: [],
    startTime: Date.now()
  });

  const [loading, setLoading] = useState(true);
  const [recordModal, setRecordModal] = useState(null);
  const [recordModalData, setRecordModalData] = useState({ winner: null, loser: null, tai: 0 });
  const [showSettlement, setShowSettlement] = useState(false);

  // 計算風圈 (每4次位移換一圈風)
  const getFullStatus = (shifts, dealerIdx, streak) => {
    const windNames = ['東', '南', '西', '北'];
    const currentWind = windNames[Math.floor(shifts / 4) % 4];
    const currentHand = windNames[dealerIdx];
    return `${currentWind}風${currentHand}${streak > 0 ? ` 連${streak}` : ''}`;
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error(err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const gameDoc = doc(db, 'artifacts', appId, 'public', 'data', 'games', 'current_session');
    return onSnapshot(gameDoc, (snap) => {
      if (snap.exists()) {
        setGameData(snap.data());
        setGameState('playing');
      } else {
        setGameState('setup');
      }
      setLoading(false);
    });
  }, [user]);

  const saveGame = async (newData) => {
    const gameDoc = doc(db, 'artifacts', appId, 'public', 'data', 'games', 'current_session');
    await setDoc(gameDoc, newData);
  };

  const startNewGame = () => {
    if (gameData.players.some(p => !p.name)) return alert("請輸入完整玩家姓名");
    const initPlayers = gameData.players.map(p => ({ ...p, score: 0, stats: { win: 0, self: 0, deal: 0 } }));
    saveGame({ ...gameData, players: initPlayers, startTime: Date.now(), history: [], dealerShifts: 0, streak: 0, currentDealerIndex: 0 });
  };

  const handleRecord = async () => {
    const { winner: winIdx, loser: loseIdx, tai } = recordModalData;
    let updated = JSON.parse(JSON.stringify(gameData.players));
    const amount = gameData.settings.base + (tai * gameData.settings.perTai);
    const statusStr = getFullStatus(gameData.dealerShifts, gameData.currentDealerIndex, gameData.streak);

    let log = { status: statusStr, winner: updated[winIdx].name, tai, amount, type: recordModal };

    if (recordModal === 'self') {
      updated.forEach((p, i) => {
        if (i === winIdx) { p.score += amount * 3; p.stats.self += 1; }
        else p.score -= amount;
      });
      log.loser = '三家';
    } else {
      updated[winIdx].score += amount; updated[winIdx].stats.win += 1;
      updated[loseIdx].score -= amount; updated[loseIdx].stats.deal += 1;
      log.loser = updated[loseIdx].name;
    }

    let nextDealer = gameData.currentDealerIndex;
    let nextStreak = gameData.streak;
    let nextShifts = gameData.dealerShifts;

    if (winIdx === gameData.currentDealerIndex) {
      nextStreak += 1;
    } else {
      nextDealer = (gameData.currentDealerIndex + 1) % 4;
      nextStreak = 0;
      nextShifts += 1;
    }

    await saveGame({ ...gameData, players: updated, currentDealerIndex: nextDealer, streak: nextStreak, dealerShifts: nextShifts, history: [log, ...gameData.history].slice(0, 50) });
    setRecordModal(null);
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center font-bold text-red-600 animate-pulse text-2xl">🏮 開門中...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-10">
      <div className="bg-red-700 p-5 text-center shadow-lg border-b-4 border-yellow-500 sticky top-0 z-40">
        <h1 className="text-2xl font-black text-white flex items-center justify-center gap-2">🏮 恭喜發財．麻將計帳</h1>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {gameState === 'setup' ? (
          <div className="bg-white rounded-3xl p-6 shadow-xl space-y-4 border border-slate-200">
            <h2 className="text-xl font-bold text-red-700 flex items-center gap-2"><Settings size={20}/> 開局設定</h2>
            {gameData.players.map((p, i) => (
              <div key={i} className="flex gap-2">
                <div className="w-10 h-10 bg-red-100 text-red-700 rounded-full flex items-center justify-center font-black">{POSITIONS[i]}</div>
                <input type="text" placeholder={`玩家 ${i+1}`} className="flex-1 bg-slate-50 border rounded-xl px-4" value={p.name} onChange={e => {
                  const n = [...gameData.players]; n[i].name = e.target.value; setGameData({...gameData, players: n});
                }} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <input type="number" placeholder="底" className="bg-slate-50 border rounded-xl p-3" value={gameData.settings.base} onChange={e => setGameData({...gameData, settings: {...gameData.settings, base: Number(e.target.value)}})} />
              <input type="number" placeholder="台" className="bg-slate-50 border rounded-xl p-3" value={gameData.settings.perTai} onChange={e => setGameData({...gameData, settings: {...gameData.settings, perTai: Number(e.target.value)}})} />
            </div>
            <button onClick={startNewGame} className="w-full bg-red-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all text-xl">入 場 開 打</button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-md border border-red-50 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">當前進度</p>
                <p className="text-2xl font-black text-red-700">{getFullStatus(gameData.dealerShifts, gameData.currentDealerIndex, gameData.streak)}</p>
                <p className="text-xs text-slate-500">莊家：{gameData.players[gameData.currentDealerIndex]?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold">規則</p>
                <p className="font-bold">{gameData.settings.base}/{gameData.settings.perTai}</p>
              </div>
            </div>

            <div className="space-y-2">
              {gameData.players.map((p, i) => (
                <div key={i} className={`p-4 rounded-2xl border-2 flex justify-between items-center transition-all ${i === gameData.currentDealerIndex ? 'bg-white border-red-500 shadow-md' : 'bg-white border-slate-100 opacity-90'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${i === gameData.currentDealerIndex ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{POSITIONS[(i - gameData.currentDealerIndex + 4) % 4]}</div>
                    <div>
                      <p className="font-bold text-slate-700">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">胡 {p.stats.win} | 摸 {p.stats.self} | 槍 {p.stats.deal}</p>
                    </div>
                  </div>
                  <p className={`text-2xl font-black ${p.score >= 0 ? 'text-red-600' : 'text-slate-400'}`}>{p.score > 0 ? `+${p.score}` : p.score}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { setRecordModal('win'); setRecordModalData({winner:null, loser:null, tai:0}); }} className="bg-white border-2 border-red-600 text-red-600 font-black py-5 rounded-2xl shadow-sm flex flex-col items-center"><Trophy size={24}/>胡牌</button>
              <button onClick={() => { setRecordModal('self'); setRecordModalData({winner:null, loser:null, tai:0}); }} className="bg-red-600 text-white font-black py-5 rounded-2xl shadow-lg flex flex-col items-center"><RotateCcw size={24}/>自摸</button>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              <p className="text-[10px] text-slate-400 font-bold mb-3 flex items-center gap-1"><History size={12}/> 最近戰果</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {gameData.history.map((log, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="bg-red-50 text-red-700 px-1 py-0.5 rounded font-bold text-[9px]">{log.status}</span>
                      <span className="font-bold text-red-600">{log.winner}</span>
                      <span className="text-slate-400">{log.type==='self'?'自摸':'胡'}</span>
                      <span className="font-bold">{log.loser}</span>
                    </div>
                    <span className="font-bold text-red-600">+{log.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setShowSettlement(true)} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2"><BarChart3 size={20}/> 結束牌局並結算</button>
          </>
        )}
      </div>

      {/* 結算 Modal */}
      {showSettlement && (
        <div className="fixed inset-0 bg-red-900/95 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-yellow-500 p-6 text-center text-red-900 font-black relative">
              <button onClick={()=>setShowSettlement(false)} className="absolute top-4 right-4"><X/></button>
              <Medal size={48} className="mx-auto mb-2"/>
              <h2 className="text-2xl">最終結算戰績</h2>
            </div>
            <div className="p-6 space-y-4">
              { [...gameData.players].sort((a,b)=>b.score-a.score).map((p, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${i===0?'bg-yellow-400':'bg-slate-100'}`}>{i+1}</span>
                    <div>
                      <p className="font-black text-slate-800">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">胡:{p.stats.win} 摸:{p.stats.self} 槍:{p.stats.deal}</p>
                    </div>
                  </div>
                  <p className={`text-lg font-black ${p.score>=0?'text-red-600':'text-slate-400'}`}>{p.score>0?`+${p.score}`:p.score}</p>
                </div>
              ))}
              <div className="flex flex-col gap-2 pt-4">
                <button onClick={()=>setShowSettlement(false)} className="py-2 text-slate-400 font-bold">返回繼續</button>
                <button onClick={async ()=>{ 
                  if(confirm("確定結束並重設嗎？")){
                    const initial = { players: gameData.players.map(p=>({...p,score:0,stats:{win:0,self:0,deal:0}})), settings: gameData.settings, currentDealerIndex: 0, dealerShifts: 0, streak: 0, history: [], startTime: Date.now() };
                    setGameState('setup'); setGameData(initial); setShowSettlement(false);
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', 'current_session'), initial);
                  }
                }} className="w-full bg-red-600 text-white font-black py-4 rounded-2xl shadow-lg">確認離開牌桌</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 紀錄 Modal */}
      {recordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-xl font-black text-red-700 text-center">🏮 {recordModal==='win'?'誰胡牌？':'誰自摸？'}</h3>
            <div className="grid grid-cols-2 gap-2">
              {gameData.players.map((p, i) => (
                <button key={i} onClick={()=>setRecordModalData({...recordModalData, winner: i})} className={`py-3 rounded-xl font-bold border-2 ${recordModalData.winner===i?'bg-red-600 border-red-700 text-white shadow-md':'bg-slate-50 border-slate-100 text-slate-600'}`}>{p.name}</button>
              ))}
            </div>
            {recordModal === 'win' && (
              <div className="grid grid-cols-2 gap-2">
                <p className="col-span-2 text-center text-[10px] text-slate-400 font-bold uppercase mt-2">放槍苦主</p>
                {gameData.players.map((p, i) => (
                  <button key={i} disabled={recordModalData.winner===i} onClick={()=>setRecordModalData({...recordModalData, loser: i})} className={`py-3 rounded-xl font-bold border-2 ${recordModalData.loser===i?'bg-slate-800 border-slate-900 text-white':'bg-slate-50 border-slate-100 text-slate-600 disabled:opacity-20'}`}>{p.name}</button>
                ))}
              </div>
            )}
            <div className="text-center pt-2">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">台數</p>
              <div className="flex items-center justify-center gap-4">
                <button onClick={()=>setRecordModalData({...recordModalData, tai: Math.max(0, recordModalData.tai-1)})} className="w-10 h-10 rounded-full bg-slate-100 text-xl font-bold">-</button>
                <span className="text-4xl font-black text-red-600 w-12">{recordModalData.tai}</span>
                <button onClick={()=>setRecordModalData({...recordModalData, tai: recordModalData.tai+1})} className="w-10 h-10 rounded-full bg-slate-100 text-xl font-bold">+</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <button onClick={()=>setRecordModal(null)} className="py-4 text-slate-400 font-bold">取消</button>
              <button disabled={recordModalData.winner===null || (recordModal==='win'&&recordModalData.loser===null)} onClick={handleRecord} className="bg-red-600 text-white font-black py-4 rounded-2xl shadow-lg disabled:opacity-50">確認入帳</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}