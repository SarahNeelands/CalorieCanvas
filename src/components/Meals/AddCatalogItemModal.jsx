import React from "react";
import { supabase } from "../../lib/supabaseClient";
import BarcodeScanner from "../BarcodeScanner.jsx";
import { fetchOFFProduct, mapOFFToCatalog } from "../../utils/openfoodfacts";

export default function AddCatalogItemModal({ open, onClose, userId, defaultType = 'meal' }) {
  const [tab, setTab] = React.useState("manual");
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState(defaultType);
  const [kcal100, setKcal100] = React.useState(0);
  const [p100, setP100] = React.useState(0);
  const [c100, setC100] = React.useState(0);
  const [f100, setF100] = React.useState(0);
  const [barcode, setBarcode] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);

  if (!open) return null;

  async function handleSave(e) {
    e?.preventDefault?.();
    try {
      setSaving(true); setError(null);
      if (!userId) throw new Error("Missing user");
      if (!title) throw new Error("Give it a name");
      const { error } = await supabase.from("meals").insert({
        user_id: userId, title, type, barcode: barcode || null,
        kcal_per_100g: Number(kcal100)||0, protein_g_per_100g: Number(p100)||0,
        carbs_g_per_100g: Number(c100)||0, fat_g_per_100g: Number(f100)||0,
      });
      if (error) throw error;
      onClose?.();
    } catch (e) { setError(e); } finally { setSaving(false); }
  }

  async function onScanDetected(code) {
    try {
      setBarcode(code); setError(null);
      const product = await fetchOFFProduct(code);
      const mapped = mapOFFToCatalog(product);
      setTitle(mapped.name);
      setKcal100(mapped.per100g.kcal); setP100(mapped.per100g.protein_g);
      setC100(mapped.per100g.carbs_g); setF100(mapped.per100g.fat_g);
      setTab("manual");
    } catch (e) { setError(e); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal frame">
        <h3>Add New {type === 'meal' ? 'Meal' : 'Snack'}</h3>
        <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className={tab==='manual'?'tab active':'tab'} onClick={()=>setTab('manual')}>Manual</button>
          <button className={tab==='scan'?'tab active':'tab'} onClick={()=>setTab('scan')}>Scan</button>
        </div>
        {tab==='scan' ? (
          <BarcodeScanner onDetected={onScanDetected} onError={setError} />
        ) : (
          <form onSubmit={handleSave} className="grid" style={{ gap:12 }}>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Name"/>
            <select value={type} onChange={e=>setType(e.target.value)}>
              <option value="meal">Meal</option><option value="snack">Snack</option>
            </select>
            <input type="number" value={kcal100} onChange={e=>setKcal100(e.target.value)} placeholder="kcal/100g"/>
            <input type="number" value={p100} onChange={e=>setP100(e.target.value)} placeholder="protein/100g"/>
            <input type="number" value={c100} onChange={e=>setC100(e.target.value)} placeholder="carbs/100g"/>
            <input type="number" value={f100} onChange={e=>setF100(e.target.value)} placeholder="fat/100g"/>
            <button type="submit" className="btn btn-solid">{saving ? "Saving..." : "Add"}</button>
          </form>
        )}
        {error && <div style={{color:'#b00020'}}>{String(error.message || error)}</div>}
      </div>
    </div>
  );
}
