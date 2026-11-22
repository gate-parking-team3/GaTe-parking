import { Link } from "react-router";

export default function NotFound() {
  return (
    <>
      <h1 className="page-heading">Page Not Found</h1>
      <p className="page-description">
        The page you are looking for does not exist.
      </p>
      <Link to="/" className="not-found__link">
        Go to the home page
      </Link>
    </>
  );
}
