'use client';

import { Suspense } from 'react';
import Loading from './loading';
import WorkflowPanel from '@/components/WorkflowPanel';

export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <WorkflowPanel />
    </Suspense>
  );
}

