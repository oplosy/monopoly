import { Link } from 'react-router';
import { PaperPage } from './PaperPage';

export function NotFound() {
  return (
    <PaperPage className="center-message">
      <h1>Page not found</h1>
      <Link to="/">Go home</Link>
    </PaperPage>
  );
}
