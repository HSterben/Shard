import { Routes, Route, Link } from 'react-router-dom';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useAuth } from '@workos-inc/authkit-react';
import LandingPage from './LandingPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<AppShell />} />
    </Routes>
  );
}

function AppShell() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-light dark:bg-dark p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link to="/">Shard</Link>
        <AuthButton />
      </header>
      <main className="p-8 flex flex-col gap-16">
        <h1 className="text-4xl font-bold text-center">Convex + React + WorkOS AuthKit</h1>
        <Authenticated>
          <Content />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col gap-8 w-96 mx-auto">
            <p>Log in to see the numbers</p>
            <AuthButton />
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function AuthButton() {
  const { user, signIn, signOut } = useAuth();

  if (user) {
    return (
      <button
        onClick={() => signOut()}
        className="bg-dark dark:bg-light text-light dark:text-dark text-sm px-4 py-2 rounded-md border-2"
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      onClick={() => void signIn()}
      className="bg-dark dark:bg-light text-light dark:text-dark text-sm px-4 py-2 rounded-md border-2"
    >
      Sign in
    </button>
  );
}

function Content() {
  const { user } = useAuth();
  const displayName = user?.firstName ?? user?.email ?? 'there';

  return (
    <div className="flex flex-col gap-8 max-w-lg mx-auto">
      <p>Welcome, {displayName}!</p>
      <p>
        You’re signed in. Use the Shard desktop app for AI chat, or head back to the landing page
        to download it.
      </p>
      <p>
        <Link
          to="/"
          className="inline-block bg-dark dark:bg-light text-light dark:text-dark text-sm px-4 py-2 rounded-md border-2"
        >
          Back to Shard
        </Link>
      </p>
    </div>
  );
}
