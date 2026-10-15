import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Compass, AlertOctagon, Loader2 } from 'lucide-react';
import { StateView } from '../../components/ui/feedback';

export const UnauthorizedPage = ({ message }) => {
  const navigate = useNavigate();
  return (
    <div className="card fade-in">
      <StateView
        variant="error"
        icon={Lock}
        title="You don't have access to this page"
        text={message || 'Your role does not include permission for this area. If you need access, ask a Super Admin to update your role or platform assignment.'}
        actions={(
          <>
            <button type="button" className="btn btn--secondary" onClick={() => navigate(-1)}>Go back</button>
            <Link to="/overview" className="btn btn--primary">Overview dashboard</Link>
          </>
        )}
      />
    </div>
  );
};

export const NotFoundPage = () => (
  <div className="card fade-in">
    <StateView
      icon={Compass}
      title="Page not found"
      text="The page you're looking for doesn't exist or has moved."
      actions={<Link to="/overview" className="btn btn--primary">Go to the overview dashboard</Link>}
    />
  </div>
);

export const FullPageLoader = ({ label = 'Loading…' }) => (
  <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#64748B' }} role="status">
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Loader2 size={20} className="spin" /> {label}
    </div>
  </div>
);

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[UI error]', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card fade-in" style={{ margin: this.props.fullPage ? 24 : 0 }}>
        <StateView
          variant="error"
          icon={AlertOctagon}
          title="This page ran into a problem"
          text="An unexpected error occurred while displaying this page. The rest of the application is still available."
          actions={(
            <>
              <button type="button" className="btn btn--primary" onClick={() => this.setState({ error: null })}>Try again</button>
              <a className="btn btn--secondary" href="/overview">Back to overview</a>
            </>
          )}
        />
      </div>
    );
  }
}
