import DetailPageContent from '@/components/DetailPageContent';

export default async function TVPage({ params }) {
  const { id } = await params;
  return <DetailPageContent id={id} type="tv" />;
}