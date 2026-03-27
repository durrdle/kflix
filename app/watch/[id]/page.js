'use client';
import { useParams } from 'next/navigation';

export default function WatchMovie() {
  const params = useParams();
  const { id } = params;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Watch Movie Page</h1>
      <p className="mt-2">Movie ID: {id}</p>
      <p className="mt-4">Vidsrc embed will appear here.</p>
    </div>
  );
}