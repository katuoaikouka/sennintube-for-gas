import { useNavigate } from "react-router-dom";

export default function VideoCard({ video }) {
  const navigate = useNavigate();

  return (
    <div style={styles.card} onClick={() => navigate(`/watch?v=${video.videoId}`)}>
      <div style={styles.thumbWrapper}>
        <img src={video.base64imge} style={styles.img} alt="" />
        <span style={styles.duration}>{video.duration}</span>
      </div>
      <div style={styles.info}>
        <h3 style={styles.title}>{video.title}</h3>
        <p style={styles.meta}>{video.metadataRow1}</p>
        <p style={styles.meta}>{video.metadataRow2Part1} • {video.metadataRow2Part2}</p>
      </div>
    </div>
  );
}

const styles = {
  card: { cursor: 'pointer', marginBottom: '12px' },
  thumbWrapper: { position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '16/9' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  duration: { position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.8)', padding: '2px 4px', fontSize: '12px', borderRadius: '4px' },
  info: { marginTop: '12px' },
  title: { fontSize: '16px', margin: '0 0 4px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  meta: { fontSize: '14px', color: 'var(--text-secondary)', margin: '2px 0' }
};
