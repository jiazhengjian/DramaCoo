import Link from 'next/link';
import { SearchX } from 'lucide-react';
export default function NotFound() {
  return <div className="xyq-page"><div className="ui-state"><SearchX size={32} /><h1 className="xyq-page-title">页面不存在</h1><p>这个地址可能已经变更，回到工作室继续创作。</p><Link className="ui-button ui-button-primary" href="/">返回工作室</Link></div></div>;
}
