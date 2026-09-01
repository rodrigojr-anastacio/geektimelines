import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page">
      <h1>Not on the map</h1>
      <p className="lede">That page does not exist — or it has not been mapped yet.</p>
      <p>
        <Link href="/">Back to the story map</Link>
      </p>
    </main>
  );
}
