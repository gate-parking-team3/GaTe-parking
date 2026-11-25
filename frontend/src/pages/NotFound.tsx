import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="page">
      <div className="head">
        <div>
          <h1>Page Not Found</h1>
          <p>The page you are looking for does not exist.</p>
        </div>
      </div>
      <div>
        <Link to="/" className="btn btn-primary">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
