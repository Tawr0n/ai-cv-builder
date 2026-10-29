import { ApiStatus } from './api-status';
import { CvList } from './cv-list';

export default function HomePage() {
  return (
    <main>
      <CvList />
      <ApiStatus />
    </main>
  );
}
