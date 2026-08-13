import React, { useState, useEffect, useRef } from "react";
import { ChefHat, Check, RotateCcw, WifiOff, Clock, Volume2, VolumeX, Footprints, ClipboardCheck, Minus, Plus, User, Store as StoreIcon } from "lucide-react";
import { dbGet, dbSet, dbListen } from "./store.js";

const C = {
  bg: "#141613", panel: "#1E211D", line: "#333831", cream: "#F2EFE7",
  muted: "#93998C", faint: "#5F655A",
  green: "#5FAE81", greenSoft: "rgba(95,174,129,0.14)",
  amber: "#D3A24B", amberSoft: "rgba(211,162,75,0.14)",
  red: "#D06A5E", redSoft: "rgba(208,106,94,0.16)",
  blue: "#6FA8D3", blueSoft: "rgba(111,168,211,0.16)",
  purple: "#A688C4", purpleSoft: "rgba(166,136,196,0.16)",
};
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@600;700&display=swap');`;
const SCALE_KEY = "chill_kitchen_scale";

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

function StationTag({ station, scale }) {
  const isRoam = station === "流動";
  return (
    <span style={{
      display: "flex", alignItems: "center", gap: 4, padding: `${3 * scale}px ${9 * scale}px`, borderRadius: 999, fontSize: 11.5 * scale, fontWeight: 700,
      background: isRoam ? C.amberSoft : C.blueSoft, color: isRoam ? C.amber : C.blue,
    }}>
      {isRoam ? <Footprints size={11 * scale} /> : <ClipboardCheck size={11 * scale} />} {station || "櫃台"}
    </span>
  );
}
function OrderTypeTag({ isVendor, booth, scale }) {
  return (
    <span style={{
      display: "flex", alignItems: "center", gap: 4, padding: `${3 * scale}px ${9 * scale}px`, borderRadius: 999, fontSize: 11.5 * scale, fontWeight: 700,
      background: isVendor ? C.purpleSoft : "rgba(255,255,255,0.06)", color: isVendor ? C.purple : C.muted,
    }}>
      {isVendor ? <StoreIcon size={11 * scale} /> : <User size={11 * scale} />} {isVendor ? `攤位${booth ? " " + booth : ""}` : "一般客人"}
    </span>
  );
}

/* =========================================================
   KITCHEN DISPLAY — realtime, no polling needed
   flow: pending (待製作) -> ready (待取餐, front station sees + collects) -> collected (hidden here)
========================================================= */
export default function KitchenDisplay() {
  const [orders, setOrders] = useState([]);
  const [ready, setReady] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [scale, setScale] = useState(() => parseFloat(localStorage.getItem(SCALE_KEY)) || 1);
  const prevPendingCount = useRef(0);
  const soundOnRef = useRef(true);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  useEffect(() => { localStorage.setItem(SCALE_KEY, String(scale)); }, [scale]);

  const bumpScale = (d) => setScale((s) => Math.min(1.8, Math.max(0.7, Math.round((s + d) * 10) / 10)));

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

  const setStatus = async (id, status) => {
    const latest = await dbGet("pos/orders", orders);
    const next = latest.map((o) => o.id === id ? { ...o, status } : o);
    await dbSet("pos/orders", next);
  };

  const pending = [...orders.filter((o) => o.status === "pending")].sort((a, b) => new Date(a.time) - new Date(b.time));
  const readyList = [...orders.filter((o) => o.status === "ready")].sort((a, b) => new Date(a.time) - new Date(b.time));

  if (!ready) return <div style={{ height: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: "Inter" }}>連線中…</div>;

  return (
    <div style={{ height: "100dvh", background: C.bg, color: C.cream, fontFamily: "Inter", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{FONTS}</style>

      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: C.amberSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChefHat size={22} color={C.amber} />
          </div>
          <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 24 }}>後廚出單看板</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <OfflineBadge />
          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18, color: C.amber }}>待製作 {pending.length}</div>
          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18, color: C.blue }}>待取餐 {readyList.length}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 2, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: 3 }}>
            <button onClick={() => bumpScale(-0.1)} style={scaleBtnStyle}><Minus size={14} /></button>
            <span style={{ width: 40, textAlign: "center", fontFamily: "IBM Plex Mono", fontSize: 12, color: C.muted }}>{Math.round(scale * 100)}%</span>
            <button onClick={() => bumpScale(0.1)} style={scaleBtnStyle}><Plus size={14} /></button>
          </div>

          <button onClick={() => setSoundOn((v) => !v)} style={{
            width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: C.panel,
            color: soundOn ? C.amber : C.faint, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 0 }}>
        <div style={{ padding: 16, overflowY: "auto", borderRight: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 17, color: C.amber, marginBottom: 12 }}>待製作</div>
          {pending.length === 0 && <div style={{ textAlign: "center", color: C.faint, fontSize: 17, padding: "40px 0" }}>目前沒有待製作的訂單</div>}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${230 * scale}px, 1fr))`, gap: 12 }}>
            {pending.map((o) => (
              <OrderTicket key={o.id} o={o} now={now} scale={scale}
                actionLabel="出餐完成" actionColor={C.green}
                onAction={() => setStatus(o.id, "ready")} />
            ))}
          </div>
        </div>
        <div style={{ padding: 16, overflowY: "auto" }}>
          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 17, color: C.blue, marginBottom: 12 }}>待取餐（等對應站別取走）</div>
          {readyList.length === 0 && <div style={{ textAlign: "center", color: C.faint, fontSize: 17, padding: "40px 0" }}>目前沒有待取餐的訂單</div>}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${230 * scale}px, 1fr))`, gap: 12 }}>
            {readyList.map((o) => (
              <OrderTicket key={o.id} o={o} now={now} scale={scale}
                actionLabel="退回待製作" actionColor={C.muted} actionIcon={RotateCcw}
                onAction={() => setStatus(o.id, "pending")} muted />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const scaleBtnStyle = {
  width: 26, height: 26, borderRadius: 6, border: "none", background: "transparent",
  color: C.cream, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};

function OrderTicket({ o, now, actionLabel, actionColor, actionIcon: ActionIcon = Check, onAction, muted, scale }) {
  const elapsedMin = Math.floor((now - new Date(o.time).getTime()) / 60000);
  const urgency = muted ? "muted" : elapsedMin >= 10 ? "red" : elapsedMin >= 5 ? "amber" : "green";
  const palette = { red: [C.red, C.redSoft], amber: [C.amber, C.amberSoft], green: [C.green, C.greenSoft], muted: [C.faint, "rgba(255,255,255,0.04)"] }[urgency];

  return (
    <div style={{ background: C.panel, border: `2px solid ${palette[0]}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: `${10 * scale}px ${14 * scale}px`, background: palette[1] }}>
        <span style={{ fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 24 * scale }}>#{o.no}</span>
        <StationTag station={o.station} scale={scale} />
        <OrderTypeTag isVendor={o.isVendor} booth={o.booth} scale={scale} />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, color: palette[0], fontWeight: 700, fontSize: 15 * scale }}>
          <Clock size={15 * scale} /> {elapsedMin}分
        </div>
      </div>
      <div style={{ padding: `${12 * scale}px ${14 * scale}px` }}>
        {o.items.map((i) => (
          <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: `${8 * scale}px 0`, borderBottom: `1px solid ${C.line}`, fontSize: 20 * scale }}>
            <span style={{ fontWeight: 600 }}>{i.name}</span>
            <span style={{ fontFamily: "IBM Plex Mono", fontWeight: 700, color: C.amber }}>× {i.qty}</span>
          </div>
        ))}
        <button onClick={onAction} style={{
          width: "100%", marginTop: 12, padding: `${16 * scale}px 0`, borderRadius: 11, border: "none",
          background: actionColor, color: muted ? C.cream : "#0F1410", fontFamily: "Sora", fontWeight: 700, fontSize: 17 * scale, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <ActionIcon size={17 * scale} /> {actionLabel}
        </button>
      </div>
    </div>
  );
}
