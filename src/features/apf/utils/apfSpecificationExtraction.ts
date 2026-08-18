export interface ExtractedApfCriterion{stableId:string;sortOrder:number;originalText:string;expectedBehavior:string;}
const heading=/^(?:#{1,6}\s*)?(?:crit[eé]rios?\s+de\s+aceite|acceptance\s+criteria)\s*:?(.*)$/i;
const numbered=/^(?:[-*•]\s*)?(?:(CA[-\s]?\d+)|(?:\d+)[.)])\s*[:.-]?\s*(.+)$/i;
export function extractApfCriteriaFromText(content:string):ExtractedApfCriterion[]{
 const lines=content.replace(/\r/g,"").split("\n").map(line=>line.trim()).filter(Boolean);const found:string[]=[];let inSection=false;
 for(const line of lines){const h=line.match(heading);if(h){inSection=true;if(h[1]?.trim())found.push(h[1].trim());continue;}if(inSection&&/^#{1,6}\s+/.test(line))inSection=false;const match=line.match(numbered);if(match&&(inSection||Boolean(match[1])))found.push(match[2].trim());else if(inSection&&/^[-*•]\s+/.test(line))found.push(line.replace(/^[-*•]\s+/,"").trim());}
 return[...new Set(found.map(value=>value.replace(/\s+/g," ")).filter(value=>value.length>=5))].slice(0,200).map((originalText,index)=>({stableId:`CA-${String(index+1).padStart(2,"0")}`,sortOrder:index,originalText,expectedBehavior:originalText}));
}
