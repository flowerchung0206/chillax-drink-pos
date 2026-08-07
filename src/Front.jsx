import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Store, Plus, Minus, Trash2, Delete, Check, Pencil, WifiOff,
  BarChart3, Download, Tag, PlusCircle, ShoppingCart,
} from "lucide-react";
import { dbGet, dbSet, dbListen } from "./store.js";

/* ---------------------------------------------------------
   design tokens
--------------------------------------------------------- */
const C = {
  bg: "#F5F3EE", surface: "#FFFFFF", ink: "#20241F", line: "#E1DCCF",
  muted: "#847C6C", faint: "#A79E8C",
  green: "#3C6B4C", greenSoft: "rgba(60,107,76,0.10)",
  gold: "#B0812F", goldSoft: "rgba(176,129,47,0.12)",
  danger: "#AE463C", dangerSoft: "rgba(174,70,60,0.10)",
};
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap');`;

const CATS = ["比薩", "飲料", "甜點"];
const DEFAULT_PRODUCTS = {
  比薩: [
    { id: "z1", name: "海鮮比薩", price: 80 },
    { id: "z2", name: "燻雞比薩", price: 80 },
    { id: "z3", name: "總匯比薩", price: 80 },
    { id: "z4", name: "夏威夷比薩", price: 80 },
  ],
  飲料: [
    { id: "d1", name: "厚奶茶", price: 80 },
    { id: "d2", name: "決明子紅萱", price: 60 },
    { id: "d3", name: "薰衣草奶茶", price: 90 },
    { id: "d4", name: "四季春茶", price: 60 },
    { id: "d5", name: "冬瓜茶", price: 60 },
    { id: "d6", name: "冬瓜檸檬", price: 70 },
  ],
  甜點: [
    { id: "s1", name: "杏仁瓦片", price: 180 },
    { id: "s2", name: "法式千層蛋糕", price: 120 },
  ],
};
const DEFAULT_CONFIG = { comboDiscount: 10, shopName: "蕎淶清飲" };

const money = (n) => `$${Math.round(n).toLocaleString()}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);

function OfflineBadge() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (online) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, background: C.dangerSoft, color: C.danger, fontSize: 11.5, fontWeight: 600 }}>
      <WifiOff size={12} /> 離線中，資料不會同步
    </div>
  );
}
function NavTab({ active, icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none",
      background: active ? C.ink : "transparent", color: active ? "#fff" : C.muted,
      fontFamily: "Inter", fontWeight: 600, fontSize: 13, cursor: "pointer",
    }}><Icon size={15} />{label}</button>
  );
}

/* =========================================================
   FRONT-OF-HOUSE APP
========================================================= */
export default function FrontOfHousePOS() {
  const [shopName, setShopName] = useState(DEFAULT_CONFIG.shopName);
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [comboDiscount, setComboDiscount] = useState(DEFAULT_CONFIG.comboDiscount);
  const [cat, setCat] = useState("比薩");
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("order");
  const [editMode, setEditMode] = useState(false);
  const [ready, setReady] = useState(false);
  const [cash, setCash] = useState("");
  const [noChange, setNoChange] = useState(false);
  const [toast, setToast] = useState(null);
  const flags = useRef({ products: false, orders: false, config: false, cart: false });

  useEffect(() => {
    const checkReady = () => { if (Object.values(flags.current).every(Boolean)) setReady(true); };
    const u1 = dbListen("pos/products", (v) => { setProducts(v || DEFAULT_PRODUCTS); flags.current.products = true; checkReady(); });
    const u2 = dbListen("pos/orders", (v) => { setOrders(v || []); flags.current.orders = true; checkReady(); });
    const u3 = dbListen("pos/config", (v) => { const cfg = v || DEFAULT_CONFIG; setComboDiscount(cfg.comboDiscount); setShopName(cfg.shopName); flags.current.config = true; checkReady(); });
    const u4 = dbListen("pos/cart", (v) => { setCart(v || []); flags.current.cart = true; checkReady(); });
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  /* ---------- cart (every mutation writes straight to Firebase) ---------- */
  const addToCart = (p, category) => {
    setCart((c) => {
      const found = c.find((i) => i.id === p.id);
      const next = found ? c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i)) : [...c, { id: p.id, name: p.name, price: p.price, qty: 1, cat: category }];
      dbSet("pos/cart", next);
      return next;
    });
  };
  const changeQty = (id, delta) => {
    setCart((c) => {
      const next = c.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0);
      dbSet("pos/cart", next);
      return next;
    });
  };
  const removeItem = (id) => {
    setCart((c) => {
      const next = c.filter((i) => i.id !== id);
      dbSet("pos/cart", next);
      return next;
    });
  };

  const pizzaQty = cart.filter((i) => i.cat === "比薩").reduce((s, i) => s + i.qty, 0);
  const drinkQty = cart.filter((i) => i.cat === "飲料").reduce((s, i) => s + i.qty, 0);
  const comboPairs = Math.min(pizzaQty, drinkQty);
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = comboPairs * comboDiscount;
  const total = Math.max(0, subtotal - discount);
  const cashNum = noChange ? total : (parseFloat(cash) || 0);
  const change = Math.max(0, cashNum - total);

  const checkout = async () => {
    if (cart.length === 0) return;
    if (!noChange && cashNum < total) return;
    const latest = await dbGet("pos/orders", orders); // re-read to keep order numbers correct across 2 devices
    const order = {
      id: uid(), no: latest.length + 1, time: new Date().toISOString(),
      items: cart, subtotal, discount, total, cashReceived: cashNum, change, status: "pending",
    };
    const next = [order, ...latest];
    await dbSet("pos/orders", next);
    setCart([]); setCash(""); setNoChange(false);
    await dbSet("pos/cart", []);
    setToast(order);
  };

  const clearHistory = async () => {
    if (!window.confirm("確定要清空所有歷史訂單嗎？此動作無法復原，建議先匯出 Excel 備份。")) return;
    await dbSet("pos/orders", []);
  };

  const updateProduct = (category, id, field, value) => {
    const next = { ...products, [category]: products[category].map((p) => p.id === id ? { ...p, [field]: field === "price" ? (parseFloat(value) || 0) : value } : p) };
    dbSet("pos/products", next);
  };
  const addProduct = (category) => {
    const next = { ...products, [category]: [...products[category], { id: uid(), name: "新品項", price: 0 }] };
    dbSet("pos/products", next);
  };
  const removeProduct = (category, id) => {
    const next = { ...products, [category]: products[category].filter((p) => p.id !== id) };
    dbSet("pos/products", next);
  };
  const updateConfig = (patch) => {
    dbSet("pos/config", { comboDiscount, shopName, ...patch });
  };

  const exportExcel = () => {
    const detailRows = [];
    orders.forEach((o) => o.items.forEach((i) => {
      detailRows.push({
        單號: o.no, 時間: new Date(o.time).toLocaleString("zh-TW"), 品項: i.name, 分類: i.cat,
        單價: i.price, 數量: i.qty, 小計: i.price * i.qty, 訂單折扣: o.discount, 訂單總計: o.total,
        狀態: o.status === "done" ? "已完成" : "待製作",
      });
    }));
    const summaryMap = {};
    orders.forEach((o) => o.items.forEach((i) => {
      summaryMap[i.name] = summaryMap[i.name] || { 品項: i.name, 分類: i.cat, 銷售數量: 0, 銷售金額: 0 };
      summaryMap[i.name].銷售數量 += i.qty; summaryMap[i.name].銷售金額 += i.price * i.qty;
    }));
    const revenue = orders.reduce((s, o) => s + o.total, 0);
    const summaryRows = [
      { 項目: "訂單總數", 數值: orders.length },
      { 項目: "總營業額", 數值: revenue },
      { 項目: "平均客單價", 數值: orders.length ? Math.round(revenue / orders.length) : 0 },
      { 項目: "套組折扣總額", 數值: orders.reduce((s, o) => s + o.discount, 0) },
      {}, ...Object.values(summaryMap).sort((a, b) => b.銷售數量 - a.銷售數量),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "營業報表");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "訂單明細");
    XLSX.writeFile(wb, `${shopName}_營業報表_${todayStr()}.xlsx`);
  };

  const todayOrders = orders.filter((o) => o.time.slice(0, 10) === todayStr());
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);

  if (!ready) return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: "Inter" }}>連線 Firebase 中…</div>;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "Inter" }}>
      <style>{FONTS}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: C.ink, display: "flex", alignItems: "center", justifyContent: "center" }}><Store size={17} color="#fff" /></div>
          {editMode ? (
            <input value={shopName} onChange={(e) => updateConfig({ shopName: e.target.value })} style={{ ...smallInputStyle, fontFamily: "Sora", fontWeight: 700, fontSize: 15, width: 160 }} />
          ) : (
            <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 19 }}>{shopName} · 前台</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <OfflineBadge />
          <div style={{ display: "flex", gap: 4, background: C.bg, borderRadius: 12, padding: 4 }}>
            <NavTab active={view === "order"} icon={ShoppingCart} label="點餐" onClick={() => setView("order")} />
            <NavTab active={view === "report"} icon={BarChart3} label="營運報表" onClick={() => setView("report")} />
          </div>
          <button onClick={() => setEditMode((v) => !v)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
            border: `1px solid ${editMode ? C.gold : C.line}`, background: editMode ? C.goldSoft : "transparent",
            color: editMode ? C.gold : C.muted, fontWeight: 600, fontSize: 12.5, cursor: "pointer",
          }}><Pencil size={13} /> {editMode ? "完成編輯" : "編輯品項"}</button>
        </div>
      </div>

      {view === "order" && (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 65px)" }}>
          {/* product area — top, only as tall as its content needs */}
          <div style={{ flexShrink: 0, padding: "12px 18px 8px", overflowY: "auto", maxHeight: "46vh" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {CATS.map((c) => (
                <button key={c} onClick={() => setCat(c)} style={{
                  padding: "12px 28px", borderRadius: 12, cursor: "pointer",
                  border: `1px solid ${cat === c ? C.ink : C.line}`, background: cat === c ? C.ink : C.surface,
                  color: cat === c ? "#fff" : C.muted, fontFamily: "Sora", fontWeight: 700, fontSize: 18,
                }}>{c}</button>
              ))}
            </div>

            {editMode && cat === "比薩" && (
              <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: C.goldSoft, border: `1px dashed ${C.gold}`, display: "flex", alignItems: "center", gap: 10 }}>
                <Tag size={14} color={C.gold} />
                <span style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>比薩＋飲料套組折扣（每組折抵）</span>
                <input type="number" value={comboDiscount} onChange={(e) => updateConfig({ comboDiscount: parseFloat(e.target.value) || 0 })} style={{ ...smallInputStyle, width: 80 }} />
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
              {products[cat].map((p) => (
                editMode ? (
                  <div key={p.id} style={{ padding: 14, borderRadius: 14, background: C.surface, border: `1px solid ${C.line}` }}>
                    <input value={p.name} onChange={(e) => updateProduct(cat, p.id, "name", e.target.value)} style={{ ...smallInputStyle, width: "100%", marginBottom: 8, fontWeight: 600 }} />
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ color: C.faint, fontSize: 13 }}>$</span>
                      <input type="number" value={p.price} onChange={(e) => updateProduct(cat, p.id, "price", e.target.value)} style={{ ...smallInputStyle, flex: 1, fontFamily: "IBM Plex Mono" }} />
                      <button onClick={() => removeProduct(cat, p.id)} style={{ ...iconBtnStyle, color: C.danger }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ) : (
                  <button key={p.id} onClick={() => addToCart(p, cat)} style={{ textAlign: "left", padding: 26, minHeight: 108, borderRadius: 18, background: C.surface, border: `1px solid ${C.line}`, color: C.ink, cursor: "pointer" }}>
                    <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 22, marginBottom: 12, lineHeight: 1.3 }}>{p.name}</div>
                    <div style={{ fontFamily: "IBM Plex Mono", color: C.gold, fontSize: 23, fontWeight: 700 }}>{money(p.price)}</div>
                  </button>
                )
              ))}
              {editMode && (
                <button onClick={() => addProduct(cat)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, border: `1px dashed ${C.line}`, background: "transparent", color: C.muted, minHeight: 70, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  <PlusCircle size={16} /> 新增品項
                </button>
              )}
            </div>
          </div>

          {/* checkout bar — bottom, fills all remaining space, keypad-dominant */}
          <div style={{ borderTop: `1px solid ${C.line}`, background: C.surface, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

            {/* thin summary strip */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 18px", borderBottom: `1px solid ${C.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, overflowX: "auto", whiteSpace: "nowrap" }}>
                {cart.length === 0 && <span style={{ color: C.faint, fontSize: 14 }}>尚未選擇商品</span>}
                {cart.map((i) => (
                  <span key={i.id} onClick={() => removeItem(i.id)} style={{ padding: "5px 12px", borderRadius: 999, background: C.bg, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    {i.name} ×{i.qty}
                  </span>
                ))}
              </div>
              {comboPairs > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: C.green, fontWeight: 700, whiteSpace: "nowrap" }}>
                  <Tag size={12} /> 折扣 ×{comboPairs}
                </span>
              )}
              <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 17, whiteSpace: "nowrap" }}>應收 <span style={{ fontFamily: "IBM Plex Mono", color: C.gold, fontSize: 22 }}>{money(total)}</span></span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                <input value={noChange ? String(total) : cash} onChange={(e) => { setCash(e.target.value.replace(/[^0-9]/g, "")); setNoChange(false); }} placeholder="客收現金" style={{ ...smallInputStyle, width: 140, padding: "10px 12px", fontSize: 18, fontFamily: "IBM Plex Mono" }} />
                <button onClick={() => setNoChange((v) => !v)} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${noChange ? C.green : C.line}`, background: noChange ? C.greenSoft : "transparent", color: noChange ? C.green : C.muted, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>不找零</button>
                <span style={{ fontSize: 14, color: C.faint }}>找零 <b style={{ fontFamily: "IBM Plex Mono", color: C.gold, fontSize: 16 }}>{cash === "" && !noChange ? "—" : money(change)}</b></span>
              </div>
            </div>

            {/* mega keypad + merged confirm key — stretches to fill all remaining height */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.3fr", gridTemplateRows: "repeat(4, 1fr)",
              gap: 8, padding: "8px 12px 12px", flex: 1, minHeight: 0,
            }}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "清除", "0", "⌫"].map((k, idx) => (
                <button
                  key={k}
                  onClick={() => { if (noChange) return; k === "清除" ? (setCash(""), setNoChange(false)) : k === "⌫" ? setCash((c) => c.slice(0, -1)) : setCash((c) => c + k); }}
                  style={{
                    gridColumn: (idx % 3) + 1, gridRow: Math.floor(idx / 3) + 1,
                    borderRadius: 14, border: `1px solid ${C.line}`, background: C.bg, color: C.ink,
                    fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 40, cursor: "pointer",
                    opacity: noChange ? 0.4 : 1, pointerEvents: noChange ? "none" : "auto",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {k === "⌫" ? <Delete size={34} /> : k}
                </button>
              ))}
              <button disabled={cart.length === 0 || (!noChange && cashNum < total)} onClick={checkout} style={{
                gridColumn: 4, gridRow: "1 / span 4", borderRadius: 18, border: "none",
                background: (cart.length && (noChange || cashNum >= total)) ? C.ink : C.line,
                color: (cart.length && (noChange || cashNum >= total)) ? "#fff" : C.faint,
                fontFamily: "Sora", fontWeight: 700, fontSize: 28, cursor: "pointer", lineHeight: 1.5,
              }}>確認結帳<br />並送單</button>
            </div>
          </div>
        </div>
      )}

      {view === "report" && (
        <div style={{ padding: 24, maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18 }}>營運報表</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={exportExcel} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: C.ink, color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                <Download size={13} /> 匯出 Excel
              </button>
              <button onClick={clearHistory} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.danger, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
                <Trash2 size={13} /> 清空歷史
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <StatCard label="今日營業額" value={money(todayRevenue)} />
            <StatCard label="今日單數" value={todayOrders.length} />
            <StatCard label="累計總單數" value={orders.length} />
          </div>
        </div>
      )}

      {toast && <Toast order={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function Numpad({ onDigit, onClear, onBackspace, disabled }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "清除", "0", "⌫"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      {keys.map((k) => (
        <button key={k} onClick={() => k === "清除" ? onClear() : k === "⌫" ? onBackspace() : onDigit(k)} style={{ padding: "20px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.bg, color: C.ink, fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 26, cursor: "pointer" }}>
          {k === "⌫" ? <Delete size={22} style={{ margin: "0 auto" }} /> : k}
        </button>
      ))}
    </div>
  );
}
function Row({ label, value, muted, big, color, style }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", ...style }}>
      <span style={{ fontSize: big ? 18 : 15, color: muted ? C.faint : C.ink, fontWeight: big ? 700 : 500, fontFamily: big ? "Sora" : "Inter" }}>{label}</span>
      <span style={{ fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: big ? 26 : 17, color: color || (big ? C.ink : C.muted) }}>{value}</span>
    </div>
  );
}
const iconBtnStyle = { width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const smallInputStyle = { padding: "9px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: C.bg, color: C.ink, fontSize: 15, outline: "none", boxSizing: "border-box" };

function Toast({ order, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.ink, color: "#fff", borderRadius: 12, padding: "12px 20px" }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={14} /></div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>送單成功 · #{order.no}</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>{money(order.total)} · 找零 {money(order.change)}</div>
        </div>
      </div>
    </div>
  );
}
function StatCard({ label, value }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: C.faint, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 17, color: C.gold }}>{value}</div>
    </div>
  );
}
