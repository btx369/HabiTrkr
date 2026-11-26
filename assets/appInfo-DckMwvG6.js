const n="1.0.0",o="";function s(a,r){const t=`${r}

---
HabiTrkr ${n}
${navigator.userAgent}`,e=new URLSearchParams({subject:`[HabiTrkr] ${a}`,body:t});return`mailto:${o}?${e.toString().replace(/\+/g,"%20")}`}export{n as A,s as f};
