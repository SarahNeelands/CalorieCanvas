import { supabase } from '../supabaseClient';

// Helpers: normalize to array of { date, label, value, extra }
function dayLabel(iso) {
  try{ const d = new Date(iso); return d.toLocaleDateString(undefined, { weekday: 'short' }); }catch(e){ return iso; }
}

export async function fetchWeightSeries(userId, scope = 'all') {
  try{
    if (!userId) return [];
    // scope not used for now; return last 60 weights for all
    const { data, error } = await supabase.from('weights').select('date,value,unit').eq('user_id', userId).order('date', { ascending: false }).limit(365);
    if (error) throw error;
    return (data || []).map(d => ({ date: d.date, label: dayLabel(d.date), value: Number(d.value) }));
  }catch(e){
    console.warn('fetchWeightSeries failed', e);
    return [];
  }
}

export async function fetchCalorieSeries(userId, scope = 'all') {
  try{
    if (!userId) return [];
    // Aggregate meal_logs by date
    const { data, error } = await supabase.rpc('daily_calorie_totals', { p_user_id: userId });
    // If RPC not available, fallback to client-side aggregate
    if (error || !data) {
      const { data: rows, error: e2 } = await supabase.from('meal_logs').select('logged_at,kcal').eq('user_id', userId);
      if (e2) throw e2;
      const byDate = {};
      (rows || []).forEach(r => {
        const d = r.logged_at ? r.logged_at.slice(0,10) : (new Date()).toISOString().slice(0,10);
        byDate[d] = (byDate[d] || 0) + Number(r.kcal || 0);
      });
      return Object.keys(byDate).sort().map(d => ({ date: d, label: dayLabel(d), value: byDate[d], extra: { calories: byDate[d] } }));
    }
    return (data || []).map(d => ({ date: d.date, label: dayLabel(d.date), value: Number(d.total_kcal), extra: { calories: Number(d.total_kcal) } }));
  }catch(e){ console.warn('fetchCalorieSeries failed', e); return []; }
}

export async function fetchExerciseSeries(userId, scope = 'all') {
  try{
    if (!userId) return [];
    const { data, error } = await supabase.from('exercise_logs').select('timestamp_iso,minutes,type_id').eq('user_id', userId);
    if (error) throw error;
    const byDate = {};
    (data || []).forEach(r => {
      const d = r.timestamp_iso ? r.timestamp_iso.slice(0,10) : (new Date()).toISOString().slice(0,10);
      byDate[d] = byDate[d] || { total: 0, types: {} };
      byDate[d].total += Number(r.minutes || 0);
      const t = r.type_id || 'other';
      byDate[d].types[t] = (byDate[d].types[t] || 0) + Number(r.minutes || 0);
    });
    return Object.keys(byDate).sort().map(d => ({ date: d, label: dayLabel(d), value: byDate[d].total, extra: { types: Object.entries(byDate[d].types).map(([name, minutes]) => ({ name, minutes })) } }));
  }catch(e){ console.warn('fetchExerciseSeries failed', e); return []; }
}
