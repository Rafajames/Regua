const dateOf=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d;};
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
export function buildOperationalSummary(records=[]){
 const opened=records.map(r=>dateOf(r.openedAt)).filter(Boolean),closed=records.map(r=>dateOf(r.closedAt)).filter(Boolean);
 const durations=records.map(r=>{const a=dateOf(r.openedAt),b=dateOf(r.closedAt);return a&&b&&b>=a?(b-a)/60000:null;}).filter(v=>v!==null);
 const countBy=key=>records.reduce((o,r)=>{const v=r[key]||'Não informado';o[v]=(o[v]||0)+1;return o;},{});
 return {totalRecords:records.length,openedCount:opened.length,closedCount:closed.length,openBacklog:records.filter(r=>!dateOf(r.closedAt)).length,resolutionMinutes:{count:durations.length,average:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):null,median:median(durations)},byBuilding:countBy('building'),byCategory:countBy('category'),byPriority:countBy('priority'),coverage:{openedAt:records.length?opened.length/records.length:0,closedAt:records.length?closed.length/records.length:0},generatedAt:new Date().toISOString()};
}
export function compareSummaries(current,previous){
 const pct=(a,b)=>typeof a==='number'&&typeof b==='number'&&b!==0?Math.round((a-b)/b*10000)/100:null;
 return {totalRecords:{current:current.totalRecords,previous:previous.totalRecords,changePercent:pct(current.totalRecords,previous.totalRecords)},closedCount:{current:current.closedCount,previous:previous.closedCount,changePercent:pct(current.closedCount,previous.closedCount)},openBacklog:{current:current.openBacklog,previous:previous.openBacklog,changePercent:pct(current.openBacklog,previous.openBacklog)}};
}
