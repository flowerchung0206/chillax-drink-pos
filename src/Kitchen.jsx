import React, { useState, useEffect, useRef } from "react";
import { ChefHat, Check, RotateCcw, WifiOff, Clock, Volume2, VolumeX } from "lucide-react";
import { dbGet, dbSet, dbListen } from "./store.js";

const C = {
  bg: "#141613", panel: "#1E211D", line: "#333831", cream: "#F2EFE7",
  muted: "#93998C", faint: "#5F655A",
  green: "#5FAE81", greenSoft: "rgba(95,174,129,0.14)",
  amber: "#D3A24B", amberSoft: "rgba(211,162,75,0.14)",
  red: "#D06A5E", redSoft: "rgba(208,106,94,0.16)",
};
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@600;700&display=swap');`;

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.35);
  } catch { /* audio not available */ }
}

function OfflineBadge() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (online) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: C.redSoft, color: C.red, fontSize: 12.5, fontWeight: 700 }}>
      <WifiOff size={13} /> 離線中，新訂單不會同步
    </div>
  );
}

/* =========================================================
   KITCHEN DISPLAY — realtime, no polling needed
========================================================= */
export default function KitchenDisplay() {
  const [orders, setOrders] = useState([]);
  const [ready, setReady] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [now, setNow] = useState(Date.now());
  const prevPendingCount = useRef(0);
  const soundOnRef = useRef(true);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  useEffect(() => {
    const unsub = dbListen("pos/orders", (v) => {
      const o = v || [];
      const pendingNow = o.filter((x) => x.status === "pending").length;
      if (ready && soundOnRef.current && pendingNow > prevPendingCount.current) beep();
      prevPendingCount.current = pendingNow;
      setOrders(o);
      setReady(true);
    });
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { unsub(); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStatus = async (id) => {
    const latest = await dbGet("pos/orders", orders);
    const next = latest.map((o) => o.id === id ? { ...o, status: o.status === "pending" ? "done" : "pending" } : o);
    await dbSet("pos/orders", next);
  };

  const pending = [...orders.filter((o) => o.status === "pending")].sort((a, b) => new Date(a.time) - new Date(b.time));
  const done = [...orders.filter((o) => o.status === "done")].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 12);

  if (!ready) return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: "Inter" }}>連線 Firebase 中…</div>;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.cream, fontFamily: "Inter" }}>
      <style>{FONTS}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: C.amberSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChefHat size={20} color={C.amber} />
          </div>
          <div>
            <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 23 }}>後廚出單看板</div>
            <div style={{ fontSize: 11.5, color: C.faint, fontFamily: "IBM Plex Mono" }}>即時同步</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <OfflineBadge />
          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15, color: C.amber }}>待製作 {pending.length} 單</div>
          <button onClick={() => setSoundOn((v) => !v)} style={{
            width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: C.panel,
            color: soundOn ? C.amber : C.faint, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>

      <div style={{ padding: 22 }}>
        {pending.length === 0 ? (
          <div style={{ textAlign: "center", color: C.faint, fontSize: 16, padding: "80px 0" }}>目前沒有待製作的訂單</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {pending.map((o) => <OrderTicket key={o.id} o={o} now={now} onDone={() => toggleStatus(o.id)} />)}
          </div>
        )}

        {done.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 14, color: C.faint, marginBottom: 12 }}>最近已完成</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {done.map((o) => (
                <button key={o.id} onClick={() => toggleStatus(o.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10,
                  border: `1px solid ${C.line}`, background: C.panel, color: C.muted, cursor: "pointer", fontSize: 12.5,
                }}>
                  <Check size={12} color={C.green} /> #{o.no}
                  <RotateCcw size={11} style={{ opacity: 0.5 }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderTicket({ o, now, onDone }) {
  const elapsedMin = Math.floor((now - new Date(o.time).getTime()) / 60000);
  const urgency = elapsedMin >= 10 ? "red" : elapsedMin >= 5 ? "amber" : "green";
  const palette = { red: [C.red, C.redSoft], amber: [C.amber, C.amberSoft], green: [C.green, C.greenSoft] }[urgency];

  return (
    <div style={{ background: C.panel, border: `2px solid ${palette[0]}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: palette[1] }}>
        <span style={{ fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 26 }}>#{o.no}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: palette[0], fontWeight: 700, fontSize: 16 }}>
          <Clock size={16} /> {elapsedMin} 分鐘
        </div>
      </div>
      <div style={{ padding: "16px 18px" }}>
        {o.items.map((i) => (
          <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 20 }}>
            <span style={{ fontWeight: 600 }}>{i.name}</span>
            <span style={{ fontFamily: "IBM Plex Mono", fontWeight: 700, color: C.amber }}>× {i.qty}</span>
          </div>
        ))}
        <button onClick={onDone} style={{
          width: "100%", marginTop: 16, padding: "16px 0", borderRadius: 12, border: "none",
          background: C.green, color: "#0F1410", fontFamily: "Sora", fontWeight: 700, fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <Check size={20} /> 出餐完成
        </button>
      </div>
    </div>
  );
}
