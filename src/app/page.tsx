import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
  // Optionally, you can return a loading component or null
  // return <main className="flex min-h-screen flex-col items-center justify-center p-24">Loading...</main>;
  return null;
}
