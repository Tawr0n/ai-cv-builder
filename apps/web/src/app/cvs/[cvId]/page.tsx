import { CvPage } from '@/components/cv-page';

export default async function CvRoute(props: PageProps<'/cvs/[cvId]'>) {
  const { cvId } = await props.params;
  return <CvPage cvId={cvId} />;
}
