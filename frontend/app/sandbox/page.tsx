import { Suspense } from 'react';
import Loading from '../loading';
import Sandbox from '@/components/Sandbox/Sandbox';

export default function SandboxPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Sandbox />
    </Suspense>
  );
}
