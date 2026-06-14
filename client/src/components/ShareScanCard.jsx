/**
 * ShareScanCard.jsx — Shareable scan summary card
 *
 * Shows a beautiful summary of the entire scan:
 * - Restaurant name
 * - Total dishes, recommended count
 * - Top 3 picks with scores
 * - Branding footer
 *
 * Uses inline CSS (not Tailwind) for reliable html2canvas rendering.
 */

import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';

function ScanSummaryCard({ scan, dishes, restaurantName }) {
  const recommended = dishes.filter(d => d.matchScore >= 65).sort((a, b) => b.matchScore - a.matchScore);
  const topPicks = recommended.slice(0, 3);
  const totalDishes = dishes.length;
  const recCount = recommended.length;

  return (
    <div style={{
      width: '360px', height: '640px', fontFamily: "'Inter', sans-serif",
      background: 'linear-gradient(155deg, #064e3b 0%, #065f46 30%, #047857 60%, #059669 100%)',
      borderRadius: '20px', overflow: 'hidden', position: 'relative',
      boxShadow: '0 25px 50px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column',
    }}>
      {/* Decorative circles */}
      <div style={{ position: 'absolute', top: '-50px', right: '-30px', width: '180px', height: '180px',
        borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ position: 'absolute', bottom: '-30px', left: '-30px', width: '150px', height: '150px',
        borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ position: 'absolute', top: '40%', right: '-60px', width: '120px', height: '120px',
        borderRadius: '50%', background: 'rgba(16,185,129,0.15)' }} />

      {/* Header */}
      <div style={{ padding: '28px 24px 0', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '24px' }}>
          <span style={{ fontSize: '18px' }}>🍽️</span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#6ee7b7', letterSpacing: '1.5px' }}>MENULENS</span>
        </div>

        {/* Restaurant name */}
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#fff', margin: '0 0 6px', lineHeight: '1.15', letterSpacing: '-0.5px' }}>
          {restaurantName || 'Menu Scan'}
        </h1>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '0 0 20px', fontWeight: '500' }}>
          📊 AI-Powered Nutrition Analysis
        </p>
      </div>

      {/* Stats row */}
      <div style={{ padding: '0 24px', position: 'relative' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: '14px', padding: '14px', textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#fff', lineHeight: 1 }}>{totalDishes}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)', fontWeight: '600', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Dishes Found
            </div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: '14px', padding: '14px', textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#4ade80', lineHeight: 1 }}>{recCount}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)', fontWeight: '600', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Recommended
            </div>
          </div>
        </div>
      </div>

      {/* Top picks */}
      <div style={{ padding: '0 24px', position: 'relative', flex: 1 }}>
        <p style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
          🏆 Top Picks
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {topPicks.length > 0 ? topPicks.map((dish, idx) => (
            <div key={dish._id || idx} style={{
              background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              border: '1px solid rgba(255,255,255,0.12)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '16px', width: '24px', textAlign: 'center' }}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                </span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {dish.name}
                </span>
              </div>
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '8px',
              }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>{dish.matchScore}</span>
              </div>
            </div>
          )) : (
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '20px 0' }}>
              No top picks for this scan
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 24px 24px', position: 'relative' }}>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: 0, textAlign: 'center' }}>
          menulens.app · Scan menus. Eat smart.
        </p>
      </div>
    </div>
  );
}

export default function ShareScanCardModal({ scan, dishes, restaurantName, onClose }) {
  const [generating, setGenerating] = useState(false);
  const cardRef = useRef(null);

  const generateAndShare = async (action) => {
    setGenerating(true);
    try {
      await document.fonts.ready;

      const ref = cardRef.current;
      if (!ref) return;

      const canvas = await html2canvas(ref, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
      });

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
      const safeName = (restaurantName || 'scan').replace(/\s+/g, '-').toLowerCase();
      const file = new File([blob], 'menulens-scan-' + safeName + '.png', { type: 'image/png' });

      if (action === 'share' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: (restaurantName || 'Scan') + ' — MenuLens Results',
          text: 'Check out my menu scan results via MenuLens!',
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'menulens-scan-' + safeName + '.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Share scan card error:', err);
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
            Share Scan Results
          </h2>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%',
            width: '30px', height: '30px', cursor: 'pointer', fontSize: '15px', fontFamily: "'Inter', sans-serif" }}>
            ×
          </button>
        </div>

        {/* Card preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', minHeight: '240px', alignItems: 'center' }}>
          <div style={{ transform: 'scale(0.62)', transformOrigin: 'top center', display: 'inline-block', marginBottom: '-100px' }}>
            <div ref={cardRef}>
              <ScanSummaryCard scan={scan} dishes={dishes} restaurantName={restaurantName} />
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
