import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// コンソール制御
if (typeof console !== 'undefined') {
  ['log', 'warn', 'info', 'debug'].forEach((m) => {
    console[m] = () => {};
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
