import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export default function VideoPlayer() {
  const [params] = useSearchParams();
  const videoId = params.get("v");
  const [video, setVideo] = useState(null);

  useEffect(() => {
    if (!videoId) return;
    fetch(`http://localhost:5000/api?__rawQuery=video=${videoId}==p==depth==i==1`)
      .then(r => r.json())
      .then(d => {
        setVideo(d);
        document.title = d.title;
      });
    window.scrollTo(0,0);
  }, [videoId]);

  if (!video) return <div style={{padding: '20px'}}>読み込み中...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.main}>
        <div style={styles.playerBox}>
          <iframe 
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} 
            style={styles.iframe} 
            allowFullScreen 
          />
        </div>
        <h1 style={styles.title}>{video.title}</h1>
        <div style={styles.authorRow}>
          <img src={video.author?.thumbnail} style={styles.avatar} />
          <div>
            <div style={{fontWeight: 'bold'}}>{video.author?.name}</div>
            <div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>{video.author?.subscribers}</div>
          </div>
          <button style={styles.subBtn}>チャンネル登録</button>
        </div>
        <div style={styles.descBox}>
          <div style={{fontWeight: 'bold', marginBottom: '8px'}}>{video.views}回視聴 • {video.relativeDate}</div>
          <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit'}}>{video.description?.text}</pre>
        </div>
      </div>
      <aside style={styles.sidebar}>
        {video["Related-videos"]?.relatedVideos?.map((rv, i) => (
          <div key={i} style={styles.rvCard} onClick={() => window.location.href=`/watch?v=${rv.videoId}`}>
            <img src={rv.thumbnail} style={styles.rvThumb} />
            <div>
              <div style={styles.rvTitle}>{rv.title}</div>
              <div style={styles.rvMeta}>{rv.channelName}</div>
              <div style={styles.rvMeta}>{rv.viewCountText}</div>
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}

const styles = {
  container: { display: 'flex', gap: '24px', padding: '24px', maxWidth: '1700px', margin: '0 auto' },
  main: { flex: 1 },
  playerBox: { width: '100%', aspectRatio: '16/9', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden' },
  iframe: { width: '100%', height: '100%', border: 'none' },
  title: { fontSize: '20px', margin: '12px 0' },
  authorRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  avatar: { width: '40px', height: '40px', borderRadius: '50%' },
  subBtn: { backgroundColor: '#fff', color: '#000', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', marginLeft: 'auto' },
  descBox: { backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '12px' },
  sidebar: { width: '400px' },
  rvCard: { display: 'flex', gap: '8px', marginBottom: '12px', cursor: 'pointer' },
  rvThumb: { width: '160px', aspectRatio: '16/9', borderRadius: '8px', objectFit: 'cover' },
  rvTitle: { fontSize: '14px', fontWeight: 'bold', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  rvMeta: { fontSize: '12px', color: 'var(--text-secondary)' }
};
