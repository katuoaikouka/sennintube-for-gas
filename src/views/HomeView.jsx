import { useState, useEffect } from "react";
import VideoCard from "../components/VideoCard";

export default function HomeView() {
  const [trend, setTrend] = useState({ trending: [], gaming: [], music: [] });
  const [selected, setSelected] = useState("trending");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "仙人Tube - ホーム";
    fetch("https://raw.githubusercontent.com/ajgpw/youtubedata/refs/heads/main/trend-base64.json")
      .then(r => r.json())
      .then(d => { setTrend(d); setLoading(false); });
  }, []);

  const categories = [
    { key: "trending", label: "急上昇" },
    { key: "gaming", label: "ゲーム" },
    { key: "music", label: "音楽" }
  ];

  if (loading) return <div style={{padding: '20px'}}>読み込み中...</div>;

  return (
    <div>
      <nav style={styles.nav}>
        {categories.map(c => (
          <button 
            key={c.key} 
            onClick={() => setSelected(c.key)}
            style={{...styles.btn, backgroundColor: selected === c.key ? '#fff' : 'var(--bg-secondary)', color: selected === c.key ? '#000' : '#fff'}}
          >
            {c.label}
          </button>
        ))}
      </nav>
      <div style={styles.grid}>
        {trend[selected]?.map((v, i) => <VideoCard key={i} video={v} />)}
      </div>
      <footer style={styles.footer}>
        <p>仙人Tube バージョン1.5.4</p>
        <img src="https://count.getloli.com/@:siatube?theme=minecraft" style={{width: '100px'}} />
      </footer>
    </div>
  );
}

const styles = {
  nav: { display: 'flex', gap: '12px', padding: '12px' },
  btn: { padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', padding: '16px' },
  footer: { textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)' }
};
