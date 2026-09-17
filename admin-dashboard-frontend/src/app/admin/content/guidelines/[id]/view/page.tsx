'use client';

import { useParams } from 'next/navigation';
import ContentDetail from '../../../ContentDetail';

export default function GuidelineDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  return <ContentDetail resource="communityGuidelines" id={id} />;
}
