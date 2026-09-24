'use client';
import { CircleAlert } from 'lucide-react';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="xyq-page"><div className="ui-state" role="alert"><CircleAlert size={32} /><h1 className="xyq-page-title">页面暂时无法显示</h1><p>请重新加载此页面。如果问题持续，可稍后再试。</p><button type="button" className="ui-button ui-button-primary" onClick={reset}>重新加载</button></div></div>;
}
