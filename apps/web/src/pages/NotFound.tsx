import { Link } from 'react-router';

export function NotFound() {
  return (
    <main className="center-message">
      <h1>Page not found</h1>
      <Link to="/">Go home</Link>
    </main>
  );
}
