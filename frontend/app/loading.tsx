export default function Loading() {
  return <div className="xyq-page" role="status" aria-label="正在加载页面"><div className="ui-skeleton h-8 w-40 mb-3" /><div className="ui-skeleton h-5 w-64 max-w-full mb-8" /><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">{[0,1,2].map(index => <div key={index} className="ui-skeleton h-60" />)}</div></div>;
}
