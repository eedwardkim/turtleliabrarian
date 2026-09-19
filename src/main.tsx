import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { TurtleMark } from './ui/Icon';
import { text } from './ui/text';
import './styles.css';

class LibraryBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info.componentStack); }
  render() {
    if (this.state.error) return <main className="error-screen"><article>
      <TurtleMark /><h1>{text.error.title}</h1><p>{text.error.body}</p>
      <button className="button primary" onClick={() => window.location.reload()}>{text.error.reload}</button>
      <details><summary>{text.error.details}</summary><pre>{this.state.error.message}</pre></details>
    </article></main>;
    return this.props.children;
  }
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<LibraryBoundary><App /></LibraryBoundary>);
