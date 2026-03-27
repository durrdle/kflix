import DetailPageContent from '@/components/DetailPageContent';

export default async function MoviePage({ params }) {
  const { id } = await params;
  return <DetailPageContent id={id} type="movie" />;
}