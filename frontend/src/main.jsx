import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('React ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 40, color: 'red', background: '#111', minHeight: '100vh' }}>
        <h1>App Crash</h1>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#ff6b6b' }}>{String(this.state.error?.message || this.state.error)}</pre>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#888', fontSize: 12 }}>{String(this.state.error?.stack || '')}</pre>
      </div>;
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </ErrorBoundary>
)
