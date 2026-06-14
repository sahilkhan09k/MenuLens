/**
 * ShareCard.jsx — Shareable nutrition cards
 *
 * 3 designs:
 * 1. Sunrise  — warm amber/orange gradient, story format (9:16)
 * 2. Vibrant  — dark navy/indigo gradient, story format (9:16)
 * 3. Wide     — green split panel, landscape 16:9 for WhatsApp chat
 *
 * All styles use inline CSS — NOT Tailwind — because html2canvas reads
 * computed styles. Tailwind JIT classes are unreliable with html2canvas.
 * Font: Inter, awaited via document.fonts.ready before capture.
 */

import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';

// ── Goal badge — identity framing ─────────────────────────────────────────────
function getGoalBadge(goal, matchScore) {
  if (matchScore >= 75) {
    if (goal === 'build_muscle') return '💪 Smart Muscle Pick';
    if (goal === 'lose_weight')  return '🔥 Weight Loss Win';
    return '✅ Healthy Choice';
  }
  if (goal === 'build_muscle') return '💪 Protein Source';
  if (goal === 'lose_weight')  return '🌿 Mindful Pick';
  return '🍽️ Balanced Meal';
}

// ── Dish photo with fallback ───────────────────────────────────────────────────
function DishPhoto({ url, dishName, height = 200 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (dishName || '?')[0].toUpperCase();

  if (!url || imgFailed) {
    return (
      <div style={{ height: height + 'px', background: 'linear-gradient(135deg, #f97316, #dc2626)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '64px', opacity: 0.6 }}>🍽️</span>
      </div>
    );
  }

  return (
    <div style={{ height: height + 'px', position: 'relative', overflow: 'hidden' }}>
      <img
        src={url}
        alt={dishName}
        crossOrigin="anonymous"
        onError={() => setImgFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {/* Gradient overlay — text over photo pattern */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }} />
    </div>
  );
}

// ── Design 1: Sunrise — warm gradient, story format ──────────────────────────
function CardSunrise({ dish, restaurantName, goal }) {
  const badge = getGoalBadge(goal, dish.matchScore);
  const cal     = dish.estimatedNutrition?.calories?.avg;
  const protein = dish.estimatedNutrition?.protein?.avg;
  const carbs   = dish.estimatedNutrition?.carbs?.avg;
  const fat     = dish.estimatedNutrition?.fat?.avg;
  const hasPhoto = !!dish.dishImageUrl;

  return (
    <div style={{ width: '360px', height: '640px', fontFamily: "'Inter', sans-serif",
      background: hasPhoto ? '#1a0a00' : 'linear-gradient(160deg, #7c2d12 0%, #9a3412 30%, #c2410c 60%, #ea580c 100%)',
      borderRadius: '20px', overflow: 'hidden', position: 'relative',
      boxShadow: '0 25px 50px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column' }}>

      {/* Photo or solid gradient background */}
      {hasPhoto ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          <DishPhoto url={dish.dishImageUrl} dishName={dish.name} height={640} />
          {/* Full card overlay for dark text areas */}
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(120,53,0,0.3) 0%, rgba(80,30,0,0.1) 45%, rgba(60,20,0,0.85) 65%, rgba(30,10,0,0.98) 100%)' }} />
        </div>
      ) : (
        <>
          <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '200px', height: '200px',
            borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '180px', height: '180px',
            borderRadius: '50%', background: 'rgba(0,0,0,0.15)' }} />
        </>
      )}

      {/* Header */}
      <div style={{ padding: '24px 24px 0', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '18px' }}>🍽️</span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff', letterSpacing: '1px' }}>MENULENS</span>
        </div>
      </div>

      {/* Spacer when photo fills the middle */}
      {hasPhoto && <div style={{ flex: 1 }} />}

      {/* Content area */}
      <div style={{ padding: hasPhoto ? '0 24px 24px' : '16px 24px 24px', position: 'relative' }}>
        {/* Badge */}
        <div style={{ marginBottom: '12px' }}>
          <span style={{ background: 'rgba(245,158,11,0.25)', backdropFilter: 'blur(10px)',
            color: '#fbbf24', fontSize: '12px', fontWeight: '700', padding: '6px 14px',
            borderRadius: '100px', border: '1px solid rgba(245,158,11,0.4)' }}>
            {badge}
          </span>
        </div>

        {/* Dish name */}
        <h1 style={{ fontSize: '34px', fontWeight: '900', color: '#fff', margin: '0 0 4px', lineHeight: '1.1', letterSpacing: '-0.5px' }}>
          {dish.name}
        </h1>
        {restaurantName && (
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px', fontWeight: '500' }}>
            📍 {restaurantName}
          </p>
        )}

        {/* Score — shown always, positioned differently when photo present */}
        {(
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: '2px solid rgba(245,158,11,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '17px', fontWeight: '800', color: '#fff' }}>{dish.matchScore}</span>
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#fff', margin: 0 }}>Goal Match Score</p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>Personalized for you</p>
            </div>
          </div>
        )}

        {/* Macros */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: hasPhoto ? '12px' : '4px' }}>
          {[
            { icon: '🔥', label: 'Calories', value: cal ? Math.round(cal) + ' kcal' : '—' },
            { icon: '💪', label: 'Protein',  value: protein ? Math.round(protein) + 'g' : '—' },
            { icon: '🍞', label: 'Carbs',    value: carbs ? Math.round(carbs) + 'g' : '—' },
            { icon: '🧈', label: 'Fat',      value: fat ? Math.round(fat) + 'g' : '—' },
          ].map(m => (
            <div key={m.label} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px',
              padding: '11px 13px', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ fontSize: '16px', marginBottom: '4px' }}>{m.icon}</div>
              <div style={{ fontSize: '26px', fontWeight: '900', color: '#fff', lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.55)', fontWeight: '600', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '12px 0 0', textAlign: 'center' }}>
          menulens.app · Scan menus. Eat smart.
        </p>
      </div>
    </div>
  );
}

// ── Design 2: Vibrant — dark navy/indigo, story format ────────────────────────
function CardVibrant({ dish, restaurantName, goal }) {
  const badge = getGoalBadge(goal, dish.matchScore);
  const cal     = dish.estimatedNutrition?.calories?.avg;
  const protein = dish.estimatedNutrition?.protein?.avg;
  const carbs   = dish.estimatedNutrition?.carbs?.avg;
  const fat     = dish.estimatedNutrition?.fat?.avg;
  const hasPhoto = !!dish.dishImageUrl;

  return (
    <div style={{ width: '360px', height: '640px', fontFamily: "'Inter', sans-serif",
      background: hasPhoto ? '#080818' : 'linear-gradient(145deg, #1a0533 0%, #2d1b69 50%, #1e1b4b 100%)',
      borderRadius: '20px', overflow: 'hidden', position: 'relative',
      boxShadow: '0 25px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>

      {hasPhoto ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          <DishPhoto url={dish.dishImageUrl} dishName={dish.name} height={640} />
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(15,23,42,0.2) 0%, rgba(15,23,42,0) 45%, rgba(15,23,42,0.85) 65%, rgba(15,23,42,0.98) 100%)' }} />
        </div>
      ) : (
        <>
          <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '220px', height: '220px',
            borderRadius: '50%', background: 'rgba(34,197,94,0.12)' }} />
          <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '170px', height: '170px',
            borderRadius: '50%', background: 'rgba(99,102,241,0.15)' }} />
        </>
      )}

      {/* Header */}
      <div style={{ padding: '24px 24px 0', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '18px' }}>🍽️</span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#22c55e', letterSpacing: '1px' }}>MENULENS</span>
        </div>
      </div>

      {hasPhoto && <div style={{ flex: 1 }} />}

      {/* Content */}
      <div style={{ padding: hasPhoto ? '0 24px 24px' : '16px 24px 24px', position: 'relative' }}>
        <div style={{ marginBottom: '12px' }}>
          <span style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80',
            fontSize: '12px', fontWeight: '700', padding: '6px 14px',
            borderRadius: '100px', border: '1px solid rgba(34,197,94,0.3)' }}>
            {badge}
          </span>
        </div>

        <h1 style={{ fontSize: '34px', fontWeight: '900', color: '#fff', margin: '0 0 4px', lineHeight: '1.1', letterSpacing: '-0.5px' }}>
          {dish.name}
        </h1>
        {restaurantName && (
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', fontWeight: '500' }}>
            📍 {restaurantName}
          </p>
        )}

        {(
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', margin: '16px 0',
            background: 'rgba(255,255,255,0.07)', borderRadius: '14px', padding: '10px 16px',
            border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '17px', fontWeight: '800', color: '#fff' }}>{dish.matchScore}</span>
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#fff', margin: 0 }}>Goal Match Score</p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>Personalized for you</p>
            </div>
          </div>
        )}

        {/* Macros — all white values, no rainbow */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: hasPhoto ? '12px' : '4px' }}>
          {[
            { icon: '🔥', label: 'Calories', value: cal ? Math.round(cal) + ' kcal' : '—' },
            { icon: '💪', label: 'Protein',  value: protein ? Math.round(protein) + 'g' : '—' },
            { icon: '🍞', label: 'Carbs',    value: carbs ? Math.round(carbs) + 'g' : '—' },
            { icon: '🧈', label: 'Fat',      value: fat ? Math.round(fat) + 'g' : '—' },
          ].map(m => (
            <div key={m.label} style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '12px',
              padding: '11px 13px', border: '1px solid rgba(255,255,255,0.35)',
              backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: '16px', marginBottom: '4px' }}>{m.icon}</div>
              <div style={{ fontSize: '26px', fontWeight: '900', color: '#ffffff', lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.55)', fontWeight: '600', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '12px 0 0', textAlign: 'center' }}>
          menulens.app · Scan menus. Eat smart.
        </p>
      </div>
    </div>
  );
}

// ── Design 3: Wide — green split panel, landscape 16:9 ────────────────────────
function CardWide({ dish, restaurantName, goal }) {
  const badge = getGoalBadge(goal, dish.matchScore);
  const cal     = dish.estimatedNutrition?.calories?.avg;
  const protein = dish.estimatedNutrition?.protein?.avg;
  const carbs   = dish.estimatedNutrition?.carbs?.avg;
  const fat     = dish.estimatedNutrition?.fat?.avg;

  return (
    <div style={{ width: '540px', height: '304px', fontFamily: "'Inter', sans-serif",
      borderRadius: '20px', overflow: 'hidden', display: 'flex',
      boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>

      {/* Left panel — photo or gradient */}
      <div style={{ width: '230px', position: 'relative', overflow: 'hidden' }}>
        {dish.dishImageUrl ? (
          <>
            <DishPhoto url={dish.dishImageUrl} dishName={dish.name} height={304} />
            <div style={{ position: 'absolute', inset: 0,
              background: 'linear-gradient(to right, rgba(0,0,0,0) 50%, rgba(0,0,0,0.1) 100%)' }} />
          </>
        ) : (
          <div style={{ height: '100%', background: 'linear-gradient(160deg, #16a34a, #15803d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '64px', opacity: 0.4 }}>🍽️</span>
          </div>
        )}
        {/* Left panel overlay with text */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(22,163,74,0.85), rgba(21,128,61,0.75))',
          padding: '24px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>🍽️</span>
            <span style={{ fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: '1px' }}>MENULENS</span>
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#fff', margin: '0 0 6px', lineHeight: '1.2' }}>
              {dish.name}
            </h1>
            {restaurantName && (
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', margin: '0 0 8px', fontWeight: '500' }}>
                📍 {restaurantName}
              </p>
            )}
            <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff',
              fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '100px' }}>
              {badge}
            </span>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
        padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

        {/* Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#22c55e',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#fff' }}>{dish.matchScore}</span>
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', margin: 0 }}>Goal Match Score</p>
            <p style={{ fontSize: '10px', color: '#86efac', margin: '1px 0 0' }}>Personalized for you</p>
          </div>
        </div>

        {/* Macros */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
          {[
            { icon: '🔥', label: 'Cal',     value: cal     ? Math.round(cal)     + ' kcal' : '—' },
            { icon: '💪', label: 'Protein', value: protein ? Math.round(protein) + 'g'     : '—' },
            { icon: '🍞', label: 'Carbs',   value: carbs   ? Math.round(carbs)   + 'g'     : '—' },
            { icon: '🧈', label: 'Fat',     value: fat     ? Math.round(fat)     + 'g'     : '—' },
          ].map(m => (
            <div key={m.label} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '8px 10px',
              display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ fontSize: '15px' }}>{m.icon}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>{m.value}</div>
                <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600' }}>{m.label}</div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '10px', color: '#86efac', margin: 0, fontWeight: '500' }}>
          menulens.app · Scan menus. Eat smart.
        </p>
      </div>
    </div>
  );
}

// ── Share Modal ────────────────────────────────────────────────────────────────
const DESIGNS = [
  { id: 'sunrise', label: 'Sunrise',  desc: 'Warm & bold' },
  { id: 'vibrant', label: 'Vibrant',  desc: 'Dark & sleek' },
  { id: 'wide',    label: 'Wide',     desc: 'WhatsApp chat' },
];

export default function ShareCardModal({ dish, restaurantName, goal, onClose }) {
  const [selected, setSelected] = useState('vibrant');
  const [generating, setGenerating] = useState(false);

  const sunriseRef  = useRef(null);
  const vibrantRef  = useRef(null);
  const wideRef     = useRef(null);

  const refs = { sunrise: sunriseRef, vibrant: vibrantRef, wide: wideRef };

  const generateAndShare = async (action) => {
    setGenerating(true);
    try {
      await document.fonts.ready;

      const ref = refs[selected].current;
      if (!ref) return;

      const canvas = await html2canvas(ref, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
      });

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
      const safeName = (dish.name || 'dish').replace(/\s+/g, '-').toLowerCase();
      const file = new File([blob], 'menulens-' + safeName + '.png', { type: 'image/png' });

      if (action === 'share' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: dish.name + ' — Nutrition Card',
          text: 'Check out the nutrition info for ' + dish.name + ' via MenuLens!',
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'menulens-' + safeName + '.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Share card error:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px 16px 32px',
        width: '100%', maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '17px', fontWeight: '700', margin: 0, color: '#111827' }}>
            Share Nutrition Card
          </h2>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%',
            width: '30px', height: '30px', cursor: 'pointer', fontSize: '15px', fontFamily: "'Inter', sans-serif" }}>
            ×
          </button>
        </div>

        {/* Design selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {DESIGNS.map(d => (
            <button key={d.id} onClick={() => setSelected(d.id)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                background: selected === d.id ? '#111827' : '#f3f4f6',
                color: selected === d.id ? '#fff' : '#374151' }}>
              <div style={{ fontSize: '12px', fontWeight: '700' }}>{d.label}</div>
              <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>{d.desc}</div>
            </button>
          ))}
        </div>

        {/* Card preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', minHeight: '240px', alignItems: 'center' }}>
          <div style={{
            transform: selected === 'wide' ? 'scale(0.58)' : 'scale(0.66)',
            transformOrigin: 'top center',
            display: 'inline-block',
            marginBottom: selected === 'wide' ? '-100px' : '-80px',
          }}>
            <div ref={sunriseRef} style={{ display: selected === 'sunrise' ? 'block' : 'none' }}>
              <CardSunrise dish={dish} restaurantName={restaurantName} goal={goal} />
            </div>
            <div ref={vibrantRef} style={{ display: selected === 'vibrant' ? 'block' : 'none' }}>
              <CardVibrant dish={dish} restaurantName={restaurantName} goal={goal} />
            </div>
            <div ref={wideRef} style={{ display: selected === 'wide' ? 'block' : 'none' }}>
              <CardWide dish={dish} restaurantName={restaurantName} goal={goal} />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button onClick={() => generateAndShare('download')} disabled={generating}
            style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '2px solid #e5e7eb',
              background: '#fff', fontFamily: "'Inter', sans-serif",
              fontSize: '14px', fontWeight: '700', color: '#374151', cursor: 'pointer',
              opacity: generating ? 0.6 : 1 }}>
            {generating ? '⏳ Saving...' : '⬇️ Save'}
          </button>
          <button onClick={() => generateAndShare('share')} disabled={generating}
            style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none',
              background: generating ? '#6b7280' : '#111827', fontFamily: "'Inter', sans-serif",
              fontSize: '14px', fontWeight: '700', color: '#fff', cursor: 'pointer' }}>
            {generating ? '⏳ Generating...' : '📤 Share'}
          </button>
        </div>
      </div>
    </div>
  );
}
