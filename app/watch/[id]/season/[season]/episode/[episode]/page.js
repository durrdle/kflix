import { useParams } from 'next/navigation';

export default function WatchTV() {
  const params = useParams();
  const { id, season, episode } = params;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Watch TV Show Page</h1>
      <p className="mt-2">Show ID: {id}</p>
      <p>Season: {season}</p>
      <p>Episode: {episode}</p>
      <p className="mt-4">Vidsrc embed for this episode will appear here.</p>
    </div>
  );
}