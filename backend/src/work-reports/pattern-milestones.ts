/** Existing assignment logs preserve both the handoff time and the pattern owner at that time. */
export function patternHandoff(detail:string):{master:string;maker:string}|null {
 const initial=/^纸样分配：纸样师 (.*?)；样衣工 (.*?)$/.exec(detail);
 const changed=/^修改纸样分配：纸样师 (.*?)→(.*?)；样衣工 (.*?)→(.*?)$/.exec(detail);
 const master=initial?.[1]??changed?.[2];
 const maker=initial?.[2]??changed?.[4];
 if(!master||master==='-'||!maker||maker==='-')return null;
 if(changed&&changed[3]!== '-'&&changed[3].trim()!=='')return null;
 return {master,maker};
}
