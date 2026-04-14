import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomeView from "./views/HomeView";
import VideoPlayer from "./views/VideoPlayer";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomeView />} />
          <Route path="watch" element={<VideoPlayer />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
