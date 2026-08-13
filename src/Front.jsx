import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Store, Trash2, Delete, Check, Pencil, WifiOff,
  BarChart3, Download, PlusCircle, ShoppingCart, X, Bell, Footprints, ClipboardCheck,
  Minus, Plus, ChevronRight,
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
    { id: "z1", name: "海鮮比薩", price: 80, stock: null },
    { id: "z2", name: "燻雞比薩", price: 80, stock: null },
    { id: "z3", name: "總匯比薩", price: 80, stock: null },
    { id: "z4", name: "夏威夷比薩", price: 80, stock: null },
  ],
  飲料: [
    { id: "d1", name: "厚奶茶", price: 80, stock: null },
    { id: "d2", name: "決明子紅萱", price: 60, stock: null },
    { id: "d3", name: "薰衣草奶茶", price: 90, stock: null },
    { id: "d4", name: "四季春茶", price: 60, stock: null },
    { id: "d5", name: "冬瓜茶", price: 60, stock: null },
    { id: "d6", name: "冬瓜檸檬", price: 70, stock: null },
  ],
  甜點: [
    { id: "s1", name: "杏仁瓦片", price: 180, stock: null },
    { id: "s2", name: "法式千層蛋糕", price: 120, stock: null },
  ],
};
const DEFAULT_CONFIG = { comboDiscount: 10, shopName: "蕎淶清飲" };
const CAT_COLOR = { 比薩: "#B0812F", 飲料: "#3C6B4C", 甜點: "#8A5A9C" };
const STATION_KEY = "chill_pos_station";

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
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, background: C.dangerSoft, color: C.danger, fontSize: 12, fontWeight: 600 }}>
      <WifiOff size={12} /> 離線中，資料不會同步
    </div>
  );
}
function NavTab({ active, icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, border: "none",
      background: active ? C.ink : "transparent", color: active ? "#fff" : C.muted,
      fontFamily: "Inter", fontWeight: 600, fontSize: 13, cursor: "pointer",
    }}><Icon size={15} />{label}</button>
  );
}

/* =========================================================
   FRONT-OF-HOUSE APP — one screen, no tabs, no scrolling
========================================================= */
export default function FrontOfHousePOS() {
  const [shopName, setShopName] = useState(DEFAULT_CONFIG.shopName);
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [comboDiscount, setComboDiscount] = useState(DEFAULT_CONFIG.comboDiscount);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("order");
  const [editMode, setEditMode] = useState(false);
  const [ready, setReady] = useState(false);
  const [cash, setCash] = useState("");
  const [noChange, setNoChange] = useState(false);
  const [toast, setToast] = useState(null);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [booth, setBooth] = useState("");
  const [station, setStation] = useState(() => {
    const urlParam = new URLSearchParams(window.location.search).get("station");
    if (urlParam === "roam") { localStorage.setItem(STATION_KEY, "流動"); return "流動"; }
    if (urlParam === "counter") { localStorage.setItem(STATION_KEY, "櫃台"); return "櫃台"; }
    return localStorage.getItem(STATION_KEY) || null;
  });
  const [stationMenuOpen, setStationMenuOpen] = useState(false);
  const chooseStation = (s) => { localStorage.setItem(STATION_KEY, s); setStation(s); setStationMenuOpen(false); };
  const [isMobile, setIsMobile] = useState(window.innerWidth < 820);
  const [mobileCat, setMobileCat] = useState(CATS[0]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 820);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const flags = useRef({ products: false, orders: false, config: false, cart: false });

  useEffect(() => {
    const checkReady = () => { if (Object.values(flags.current).every(Boolean)) setReady(true); };
    const u1 = dbListen("pos/products", (v) => { setProducts(v || DEFAULT_PRODUCTS); flags.current.products = true; checkReady(); });
    const u2 = dbListen("pos/orders", (v) => { setOrders(v || []); flags.current.orders = true; checkReady(); });
    const u3 = dbListen("pos/config", (v) => { const cfg = v || DEFAULT_CONFIG; setComboDiscount(cfg.comboDiscount); setShopName(cfg.shopName); flags.current.config = true; checkReady(); });
    const u4 = dbListen("pos/cart", (v) => { setCart(v || []); flags.current.cart = true; checkReady(); });
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  /* ---------- cart ---------- */
  const stockOf = (catName, id) => {
    const p = (products[catName] || []).find((x) => x.id === id);
    return p ? p.stock : null;
  };
  const qtyInCart = (id) => cart.find((i) => i.id === id)?.qty || 0;

  const addToCart = (p, category) => {
    if (p.stock != null && qtyInCart(p.id) >= p.stock) return; // out of stock
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
    const latest = await dbGet("pos/orders", orders);
    const order = {
      id: uid(), no: latest.length + 1, time: new Date().toISOString(),
      items: cart, subtotal, discount, total, cashReceived: cashNum, change,
      status: "pending", station,
      isVendor, booth: isVendor ? booth.trim() : "",
    };
    const next = [order, ...latest];
    await dbSet("pos/orders", next);

    // decrement stock for items that track it
    const latestProducts = await dbGet("pos/products", products);
    const nextProducts = { ...latestProducts };
    cart.forEach((i) => {
      const list = nextProducts[i.cat];
      if (!list) return;
      nextProducts[i.cat] = list.map((p) => p.id === i.id && p.stock != null ? { ...p, stock: Math.max(0, p.stock - i.qty) } : p);
    });
    await dbSet("pos/products", nextProducts);

    setCart([]); setCash(""); setNoChange(false); setIsVendor(false); setBooth("");
    await dbSet("pos/cart", []);
    setToast(order);
  };

  const markCollected = async (id) => {
    const latest = await dbGet("pos/orders", orders);
    const next = latest.map((o) => o.id === id ? { ...o, status: "collected" } : o);
    await dbSet("pos/orders", next);
  };

  const clearHistory = async () => {
    if (!window.confirm("確定要清空所有歷史訂單嗎？此動作無法復原，建議先匯出 Excel 備份。")) return;
    await dbSet("pos/orders", []);
  };

  const updateProduct = (category, id, field, value) => {
    const next = { ...products, [category]: products[category].map((p) => {
      if (p.id !== id) return p;
      if (field === "price") return { ...p, price: parseFloat(value) || 0 };
      if (field === "stock") return { ...p, stock: value === "" ? null : Math.max(0, parseInt(value) || 0) };
      return { ...p, [field]: value };
    }) };
    dbSet("pos/products", next);
  };
  const addProduct = (category) => {
    const next = { ...products, [category]: [...products[category], { id: uid(), name: "新品項", price: 0, stock: null }] };
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
        單號: o.no, 時間: new Date(o.time).toLocaleString("zh-TW"), 站別: o.station || "-",
        訂單類型: o.isVendor ? "廠商攤位" : "一般客人", 攤位: o.booth || "",
        品項: i.name, 分類: i.cat,
        單價: i.price, 數量: i.qty, 小計: i.price * i.qty, 訂單折扣: o.discount, 訂單總計: o.total,
        狀態: o.status === "collected" ? "已取餐" : o.status === "ready" ? "待取餐" : "待製作",
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
  const pickupList = orders.filter((o) => o.station === station && o.status === "ready");

  if (!ready) return <div style={{ height: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: "Inter" }}>連線 Firebase 中…</div>;

  if (!station) {
    return (
      <div style={{ height: "100dvh", background: C.bg, color: C.ink, fontFamily: "Inter", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <style>{FONTS}</style>
        <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 20 }}>這台裝置是哪一站？</div>
        <div style={{ fontSize: 13, color: C.faint, marginTop: -14 }}>選一次之後這台平板會一直記得，不用每次重選</div>
        <div style={{ display: "flex", gap: 16 }}>
          <button onClick={() => chooseStation("櫃台")} style={{
            width: 200, padding: "28px 0", borderRadius: 18, border: `2px solid ${C.line}`, background: C.surface,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer",
          }}>
            <ClipboardCheck size={32} color={C.green} />
            <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18 }}>櫃台</span>
            <span style={{ fontSize: 12, color: C.faint }}>固定收銀點餐</span>
          </button>
          <button onClick={() => chooseStation("流動")} style={{
            width: 200, padding: "28px 0", borderRadius: 18, border: `2px solid ${C.line}`, background: C.surface,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer",
          }}>
            <Footprints size={32} color={C.gold} />
            <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18 }}>流動</span>
            <span style={{ fontSize: 12, color: C.faint }}>展場走動接單</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100dvh", background: C.bg, color: C.ink, fontFamily: "Inter", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{FONTS}</style>

      {/* header */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: C.ink, display: "flex", alignItems: "center", justifyContent: "center" }}><Store size={14} color="#fff" /></div>
          {editMode ? (
            <input value={shopName} onChange={(e) => updateConfig({ shopName: e.target.value })} style={{ ...smallInputStyle, fontFamily: "Sora", fontWeight: 700, fontSize: 14, width: 140 }} />
          ) : (
            <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15 }}>{shopName} · 前台</div>
          )}
          <button onClick={() => setStationMenuOpen((v) => !v)} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700,
            border: "none", cursor: "pointer",
            background: station === "流動" ? C.goldSoft : C.greenSoft, color: station === "流動" ? C.gold : C.green,
          }}>
            {station === "流動" ? <Footprints size={11} /> : <ClipboardCheck size={11} />} {station}站
          </button>
          {stationMenuOpen && (
            <div style={{ position: "fixed", top: 52, left: 18, zIndex: 80, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden" }}>
              {["櫃台", "流動"].filter((s) => s !== station).map((s) => (
                <button key={s} onClick={() => chooseStation(s)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", border: "none", background: "transparent", fontSize: 13, fontWeight: 600, color: C.ink, cursor: "pointer", whiteSpace: "nowrap" }}>
                  切換為「{s}」
                </button>
              ))}
              <button onClick={() => setStationMenuOpen(false)} style={{ display: "block", width: "100%", padding: "8px 16px", border: "none", borderTop: `1px solid ${C.line}`, background: "transparent", fontSize: 12, color: C.faint, cursor: "pointer" }}>取消</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <OfflineBadge />
          {pickupList.length > 0 && (
            <button onClick={() => setPickupOpen((v) => !v)} style={{
              position: "relative", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9,
              border: `1px solid ${C.gold}`, background: C.goldSoft, color: C.gold, fontWeight: 700, fontSize: 12.5, cursor: "pointer",
            }}>
              <Bell size={13} /> {pickupList.length} 筆可取餐
            </button>
          )}
          <div style={{ display: "flex", gap: 4, background: C.bg, borderRadius: 10, padding: 3 }}>
            <NavTab active={view === "order"} icon={ShoppingCart} label="點餐" onClick={() => setView("order")} />
            <NavTab active={view === "report"} icon={BarChart3} label="營運報表" onClick={() => setView("report")} />
          </div>
          <button onClick={() => setEditMode((v) => !v)} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9,
            border: `1px solid ${editMode ? C.gold : C.line}`, background: editMode ? C.goldSoft : "transparent",
            color: editMode ? C.gold : C.muted, fontWeight: 600, fontSize: 12, cursor: "pointer",
          }}><Pencil size={12} /> {editMode ? "完成編輯" : "編輯品項"}</button>
        </div>
      </div>

      {pickupOpen && pickupList.length > 0 && (
        <div style={{ position: "fixed", top: 56, right: 18, zIndex: 70, width: 300, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 13 }}>可取餐訂單</span>
            <button onClick={() => setPickupOpen(false)} style={iconBtnStyle}><X size={13} /></button>
          </div>
          {pickupList.map((o) => (
            <div key={o.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 14 }}>#{o.no}</div>
                <div style={{ fontSize: 11, color: C.faint }}>{o.items.map((i) => `${i.name}×${i.qty}`).join("、")}</div>
              </div>
              <button onClick={() => markCollected(o.id)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: C.green, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>已取餐</button>
            </div>
          ))}
        </div>
      )}

      {view === "order" && isMobile && (
        <MobileOrder
          products={products} editMode={editMode} mobileCat={mobileCat} setMobileCat={setMobileCat}
          addToCart={addToCart} updateProduct={updateProduct} addProduct={addProduct} removeProduct={removeProduct}
          cart={cart} changeQty={changeQty} removeItem={removeItem} comboPairs={comboPairs}
          subtotal={subtotal} discount={discount} total={total}
          checkoutOpen={checkoutOpen} setCheckoutOpen={setCheckoutOpen}
          cash={cash} setCash={setCash} noChange={noChange} setNoChange={setNoChange}
          cashNum={cashNum} change={change} isVendor={isVendor} setIsVendor={setIsVendor}
          booth={booth} setBooth={setBooth} checkout={checkout}
        />
      )}

      {view === "order" && !isMobile && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

          {/* TOP — all categories side by side, no tabs, no scroll: rows stretch to fill height */}
          <div style={{ flex: 1, display: "flex", gap: 1, background: C.line, minHeight: 0, overflow: "hidden" }}>
            {CATS.map((c) => (
              <div key={c} style={{ flex: 1, background: C.bg, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{
                  flexShrink: 0, padding: "10px 16px", fontFamily: "Sora", fontWeight: 700, fontSize: 16,
                  color: "#fff", background: CAT_COLOR[c], display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  {c}
                  {editMode && (
                    <button onClick={() => addProduct(c)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 7, color: "#fff", padding: "4px 9px", display: "flex", alignItems: "center", gap: 4, fontSize: 11, cursor: "pointer" }}>
                      <PlusCircle size={12} /> 新增
                    </button>
                  )}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "2px 8px", minHeight: 0 }}>
                  {products[c].map((p) => {
                    const soldOut = p.stock != null && p.stock <= 0;
                    return editMode ? (
                      <div key={p.id} style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, padding: "4px 6px", borderBottom: `1px solid ${C.line}`, minHeight: 0 }}>
                        <input value={p.name} onChange={(e) => updateProduct(c, p.id, "name", e.target.value)} style={{ ...smallInputStyle, flex: 1, fontWeight: 600 }} />
                        <span style={{ color: C.faint, fontSize: 11 }}>$</span>
                        <input type="number" value={p.price} onChange={(e) => updateProduct(c, p.id, "price", e.target.value)} style={{ ...smallInputStyle, width: 52, fontFamily: "IBM Plex Mono" }} />
                        <span style={{ color: C.faint, fontSize: 11 }}>庫存</span>
                        <input type="number" value={p.stock ?? ""} placeholder="不限" onChange={(e) => updateProduct(c, p.id, "stock", e.target.value)} style={{ ...smallInputStyle, width: 52, fontFamily: "IBM Plex Mono" }} />
                        <button onClick={() => removeProduct(c, p.id)} style={{ ...iconBtnStyle, color: C.danger, flexShrink: 0 }}><Trash2 size={12} /></button>
                      </div>
                    ) : (
                      <button key={p.id} onClick={() => addToCart(p, c)} disabled={soldOut} style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "0 12px", border: "none", borderBottom: `1px solid ${C.line}`,
                        background: soldOut ? C.line : "transparent",
                        cursor: soldOut ? "not-allowed" : "pointer", textAlign: "left", minHeight: 0,
                      }}>
                        <span style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 19, color: soldOut ? C.faint : C.ink }}>{p.name}</span>
                          {p.stock != null && (
                            <span style={{ fontSize: 11, color: soldOut ? C.danger : C.faint, fontWeight: 600 }}>
                              {soldOut ? "已售完" : `剩 ${p.stock}`}
                            </span>
                          )}
                        </span>
                        <span style={{ fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 19, color: soldOut ? C.faint : C.gold }}>{money(p.price)}</span>
                      </button>
                    );
                  })}
                  {editMode && products[c].length === 0 && (
                    <div style={{ padding: "6px 0", color: C.faint, fontSize: 12, textAlign: "center" }}>尚無品項，點右上角「新增」</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* BOTTOM — cart strip + mega keypad + confirm, fixed height */}
          <div style={{ flexShrink: 0, height: 250, borderTop: `1px solid ${C.line}`, background: C.surface, display: "flex" }}>

            <div style={{ width: 300, padding: "10px 16px", borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <ShoppingCart size={14} color={C.gold} />
                <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 13 }}>本次點單</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: C.faint }}>{cart.reduce((s, i) => s + i.qty, 0)} 項</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                {cart.length === 0 && <div style={{ color: C.faint, fontSize: 13, padding: "8px 0" }}>尚未選擇商品</div>}
                {cart.map((i) => (
                  <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", fontSize: 13 }}>
                    <span style={{ flex: 1 }}>{i.name} × {i.qty}</span>
                    <button onClick={() => removeItem(i.id)} style={{ ...iconBtnStyle, width: 20, height: 20, color: C.danger, flexShrink: 0 }}><X size={11} /></button>
                  </div>
                ))}
              </div>
              {comboPairs > 0 && (
                <div style={{ fontSize: 11.5, color: C.green, fontWeight: 600, marginTop: 2 }}>已套用 {comboPairs} 組套組折扣</div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, cursor: "pointer" }}>
                <input type="checkbox" checked={isVendor} onChange={(e) => setIsVendor(e.target.checked)} style={{ width: 15, height: 15, cursor: "pointer" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isVendor ? C.gold : C.muted }}>廠商攤位訂單</span>
              </label>
              {isVendor && (
                <input value={booth} onChange={(e) => setBooth(e.target.value)} placeholder="攤位編號 / 名稱" style={{ ...smallInputStyle, marginTop: 4, fontSize: 12.5 }} />
              )}
              <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 5, marginTop: 4 }}>
                {discount > 0 && <Row label="套組折扣" value={`− ${money(discount)}`} color={C.green} />}
                <Row label="應收金額" value={money(total)} big />
              </div>
            </div>

            <div style={{ flex: 1, padding: "10px 12px", display: "flex", gap: 8, minHeight: 0 }}>
              <div style={{ width: 150, display: "flex", flexDirection: "column", gap: 6 }}>
                <input value={noChange ? String(total) : cash} onChange={(e) => { setCash(e.target.value.replace(/[^0-9]/g, "")); setNoChange(false); }} placeholder="客收現金" style={{ ...smallInputStyle, padding: "10px 12px", fontSize: 18, fontFamily: "IBM Plex Mono" }} />
                <button onClick={() => setNoChange((v) => !v)} style={{ padding: "8px 0", borderRadius: 9, border: `1px solid ${noChange ? C.green : C.line}`, background: noChange ? C.greenSoft : "transparent", color: noChange ? C.green : C.muted, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>不找零</button>
                <Row label="找零" value={cash === "" && !noChange ? "—" : money(change)} color={C.gold} />
              </div>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(4, 1fr)", gap: 6 }}>
                <Numpad onDigit={(d) => setCash((c) => (noChange ? "" : c) + d)} onClear={() => { setCash(""); setNoChange(false); }} onBackspace={() => setCash((c) => c.slice(0, -1))} disabled={noChange} />
              </div>
              <div style={{ width: 150 }}>
                <button disabled={cart.length === 0 || (!noChange && cashNum < total)} onClick={checkout} style={{
                  width: "100%", height: "100%", borderRadius: 14, border: "none",
                  background: (cart.length && (noChange || cashNum >= total)) ? C.ink : C.line,
                  color: (cart.length && (noChange || cashNum >= total)) ? "#fff" : C.faint,
                  fontFamily: "Sora", fontWeight: 700, fontSize: 17, cursor: "pointer", lineHeight: 1.4,
                }}>確認結帳<br />並送單</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "report" && (
        <div style={{ flex: 1, padding: 24, maxWidth: 760, margin: "0 auto", overflowY: "auto" }}>
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
    <>
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => k === "清除" ? onClear() : k === "⌫" ? onBackspace() : onDigit(k)}
          style={{
            borderRadius: 11, border: `1px solid ${C.line}`, background: C.bg, color: C.ink,
            fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 22, cursor: "pointer",
            opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? "none" : "auto",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {k === "⌫" ? <Delete size={19} /> : k}
        </button>
      ))}
    </>
  );
}
function Row({ label, value, muted, big, color, style }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", ...style }}>
      <span style={{ fontSize: big ? 15 : 12, color: muted ? C.faint : C.ink, fontWeight: big ? 700 : 500, fontFamily: big ? "Sora" : "Inter" }}>{label}</span>
      <span style={{ fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: big ? 21 : 13, color: color || (big ? C.ink : C.muted) }}>{value}</span>
    </div>
  );
}
const iconBtnStyle = { width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const smallInputStyle = { padding: "6px 8px", borderRadius: 7, border: `1px solid ${C.line}`, background: C.bg, color: C.ink, fontSize: 12.5, outline: "none", boxSizing: "border-box" };

function Toast({ order, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, order.isVendor ? 6000 : 3000); return () => clearTimeout(t); }, [onClose, order.isVendor]);
  if (order.isVendor) {
    return (
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.gold, color: "#fff", borderRadius: 14, padding: "16px 24px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Check size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "Sora" }}>請告知客人取餐編號：#{order.no}</div>
            <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>
              {order.booth ? `攤位：${order.booth} · ` : ""}{money(order.total)} · 找零 {money(order.change)}
            </div>
          </div>
        </div>
      </div>
    );
  }
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

/* =========================================================
   MOBILE ORDER — for narrow phone screens (e.g. iPhone roaming station)
   category tabs + scroll list on top, sticky cart bar, full-screen checkout sheet
========================================================= */
function MobileOrder({
  products, editMode, mobileCat, setMobileCat,
  addToCart, updateProduct, addProduct, removeProduct,
  cart, changeQty, removeItem, comboPairs,
  subtotal, discount, total,
  checkoutOpen, setCheckoutOpen,
  cash, setCash, noChange, setNoChange, cashNum, change,
  isVendor, setIsVendor, booth, setBooth, checkout,
}) {
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const qtyInCart = (id) => cart.find((i) => i.id === id)?.qty || 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* category tabs */}
      <div style={{ flexShrink: 0, display: "flex", gap: 6, padding: "10px 12px", borderBottom: `1px solid ${C.line}` }}>
        {CATS.map((c) => (
          <button key={c} onClick={() => setMobileCat(c)} style={{
            flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
            background: mobileCat === c ? CAT_COLOR[c] : C.bg, color: mobileCat === c ? "#fff" : C.muted,
            fontFamily: "Sora", fontWeight: 700, fontSize: 14,
          }}>{c}</button>
        ))}
      </div>

      {/* item list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px" }}>
        {editMode && (
          <button onClick={() => addProduct(mobileCat)} style={{
            width: "100%", margin: "8px 0", padding: "10px 0", borderRadius: 10, border: `1px dashed ${C.line}`,
            background: "transparent", color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}><PlusCircle size={15} /> 新增品項</button>
        )}
        {products[mobileCat].map((p) => {
          const soldOut = p.stock != null && p.stock <= 0;
          const qty = qtyInCart(p.id);
          if (editMode) {
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 4px", borderBottom: `1px solid ${C.line}` }}>
                <input value={p.name} onChange={(e) => updateProduct(mobileCat, p.id, "name", e.target.value)} style={{ ...smallInputStyle, flex: 1, fontWeight: 600 }} />
                <span style={{ color: C.faint, fontSize: 12 }}>$</span>
                <input type="number" value={p.price} onChange={(e) => updateProduct(mobileCat, p.id, "price", e.target.value)} style={{ ...smallInputStyle, width: 56, fontFamily: "IBM Plex Mono" }} />
                <span style={{ color: C.faint, fontSize: 11 }}>庫存</span>
                <input type="number" value={p.stock ?? ""} placeholder="不限" onChange={(e) => updateProduct(mobileCat, p.id, "stock", e.target.value)} style={{ ...smallInputStyle, width: 52, fontFamily: "IBM Plex Mono" }} />
                <button onClick={() => removeProduct(mobileCat, p.id)} style={{ ...iconBtnStyle, color: C.danger, flexShrink: 0 }}><Trash2 size={13} /></button>
              </div>
            );
          }
          return (
            <div key={p.id} onClick={() => !soldOut && addToCart(p, mobileCat)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 6px",
              borderBottom: `1px solid ${C.line}`, opacity: soldOut ? 0.5 : 1, cursor: soldOut ? "not-allowed" : "pointer",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 17 }}>{p.name}</span>
                <span style={{ fontFamily: "IBM Plex Mono", fontSize: 14, color: C.gold, fontWeight: 600 }}>{money(p.price)}</span>
                {p.stock != null && <span style={{ fontSize: 11, color: soldOut ? C.danger : C.faint, fontWeight: 600 }}>{soldOut ? "已售完" : `剩 ${p.stock}`}</span>}
              </div>
              {qty > 0 && !soldOut && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => changeQty(p.id, -1)} style={iconBtnStyle}><Minus size={14} /></button>
                  <span style={{ width: 20, textAlign: "center", fontFamily: "IBM Plex Mono", fontWeight: 700 }}>{qty}</span>
                  <button onClick={() => addToCart(p, mobileCat)} style={iconBtnStyle}><Plus size={14} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* sticky cart bar */}
      <button onClick={() => cartCount > 0 && setCheckoutOpen(true)} disabled={cartCount === 0} style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", border: "none", borderTop: `1px solid ${C.line}`,
        background: cartCount > 0 ? C.ink : C.bg, color: cartCount > 0 ? "#fff" : C.faint, cursor: cartCount > 0 ? "pointer" : "default",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "Sora", fontWeight: 700, fontSize: 16 }}>
          <ShoppingCart size={17} /> {cartCount > 0 ? `${cartCount} 項 · ${money(total)}` : "尚未選擇商品"}
        </span>
        {cartCount > 0 && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 700 }}>去結帳 <ChevronRight size={16} /></span>}
      </button>

      {checkoutOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, background: C.bg, display: "flex", flexDirection: "column" }}>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${C.line}`, background: C.surface }}>
            <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 17 }}>結帳</span>
            <button onClick={() => setCheckoutOpen(false)} style={iconBtnStyle}><X size={16} /></button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px" }}>
            {cart.map((i) => (
              <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{i.name}</div>
                  <div style={{ fontSize: 12, color: C.faint, fontFamily: "IBM Plex Mono" }}>{money(i.price)} × {i.qty}</div>
                </div>
                <button onClick={() => changeQty(i.id, -1)} style={iconBtnStyle}><Minus size={14} /></button>
                <span style={{ width: 20, textAlign: "center", fontFamily: "IBM Plex Mono" }}>{i.qty}</span>
                <button onClick={() => changeQty(i.id, 1)} style={iconBtnStyle}><Plus size={14} /></button>
                <button onClick={() => removeItem(i.id)} style={{ ...iconBtnStyle, color: C.danger }}><Trash2 size={14} /></button>
              </div>
            ))}

            {comboPairs > 0 && <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginTop: 8 }}>已套用 {comboPairs} 組套組折扣</div>}

            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={isVendor} onChange={(e) => setIsVendor(e.target.checked)} style={{ width: 15, height: 15 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: isVendor ? C.gold : C.muted }}>廠商攤位訂單</span>
            </label>
            {isVendor && <input value={booth} onChange={(e) => setBooth(e.target.value)} placeholder="攤位編號 / 名稱" style={{ ...smallInputStyle, marginTop: 6, width: "100%", fontSize: 13 }} />}

            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 12, paddingTop: 8 }}>
              <Row label="小計" value={money(subtotal)} muted />
              {discount > 0 && <Row label="套組折扣" value={`− ${money(discount)}`} color={C.green} />}
              <Row label="應收金額" value={money(total)} big />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input value={noChange ? String(total) : cash} onChange={(e) => setCash(e.target.value.replace(/[^0-9]/g, ""))} placeholder="客收現金" style={{ ...smallInputStyle, flex: 1, padding: "12px 14px", fontSize: 18, fontFamily: "IBM Plex Mono" }} />
              <button onClick={() => setNoChange((v) => !v)} style={{ padding: "0 14px", borderRadius: 10, border: `1px solid ${noChange ? C.green : C.line}`, background: noChange ? C.greenSoft : "transparent", color: noChange ? C.green : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>不找零</button>
            </div>
            <Row label="找零" value={cash === "" && !noChange ? "—" : money(change)} color={C.gold} style={{ marginTop: 6 }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
              <Numpad onDigit={(d) => setCash((c) => (noChange ? "" : c) + d)} onClear={() => setCash("")} onBackspace={() => setCash((c) => c.slice(0, -1))} disabled={noChange} />
            </div>
          </div>

          <div style={{ flexShrink: 0, padding: "12px 18px", borderTop: `1px solid ${C.line}`, background: C.surface }}>
            <button disabled={cart.length === 0 || (!noChange && cashNum < total)} onClick={() => { checkout(); setCheckoutOpen(false); }} style={{
              width: "100%", padding: "16px 0", borderRadius: 14, border: "none",
              background: (cart.length && (noChange || cashNum >= total)) ? C.ink : C.line,
              color: (cart.length && (noChange || cashNum >= total)) ? "#fff" : C.faint,
              fontFamily: "Sora", fontWeight: 700, fontSize: 17, cursor: "pointer",
            }}>確認結帳並送單到後廚</button>
          </div>
        </div>
      )}
    </div>
  );
}
