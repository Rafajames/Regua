const dateOf=value=>{if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d;};
const median=values=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};
const countBy=(records,key)=>records.reduce((out,row)=>{const value=String(row[key]||'Não informado');out[value]=(out[value]||0)+1;return out;},{});
export function buildOperationalSummary(records=[]){
 const opened=records.map(r=>dateOf(r.openedAt)).filter(Boolean),closed=records.map(r=>dateOf(r.closedAt)).filter(Boolean);
 const durations=records.map(r=>{const start=dateOf(r.openedAt),end=dateOf(r.closedAt);return start&&end&&end>=start?(end-start)/60000:null;}).filter(value=>value!==null);
 return {
  totalRecords:records.length,openedCount:opened.length,closedCount:closed.length,
  openBacklog:records.filter(r=>!dateOf(r.closedAt)).length,
  resolutionMinutes:{count:durations.length,average:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):null,median:median(durations)},
  byBuilding:countBy(records,'building'),bySector:countBy(records,'sector'),byRoom:countBy(records,'room'),
  byTechnician:countBy(records,'tech'),byCategory:countBy(records,'category'),byPriority:countBy(records,'priority'),
  coverage:{openedAt:records.length?opened.length/records.length:0,closedAt:records.length?closed.length/records.length:0},
  generatedAt:new Date().toISOString()
 };
}
export function compareSummaries(current,previous){
 const percent=(a,b)=>typeof a==='number'&&typeof b==='number'&&b!==0?Math.round((a-b)/b*10000)/100:null;
 return {
  totalRecords:{current:current.totalRecords,previous:previous.totalRecords,changePercent:percent(current.totalRecords,previous.totalRecords)},
  closedCount:{current:current.closedCount,previous:previous.closedCount,changePercent:percent(current.closedCount,previous.closedCount)},
  openBacklog:{current:current.openBacklog,previous:previous.openBacklog,changePercent:percent(current.openBacklog,previous.openBacklog)}
 };
}
