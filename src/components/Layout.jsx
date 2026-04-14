import { Outlet, Link } from "react-router-dom";

export default function Layout() {
  return (
    <div>
      <header style={styles.header}>
        <Link to="/" style={styles.logo}>仙人Tube</Link>
      </header>
      <main><Outlet /></main>
    </div>
  );
}

const styles = {
  header: {
    height: '56px',
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-primary)',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  logo: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: '-1px'
  }
};
