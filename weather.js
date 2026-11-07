/* Public weather data: no AI endpoint, secret, or model is needed. */
(() => {
 'use strict';
 const T=globalThis.PortfolioTools;
 const cities=[
  {keys:['thu duc','thuduc'],name:'Thủ Đức, TP. Hồ Chí Minh',latitude:10.8494,longitude:106.7537},
  {keys:['ho chi minh','tphcm','tp hcm','tp.hcm','sai gon','saigon'],name:'TP. Hồ Chí Minh',latitude:10.7769,longitude:106.7009},
  {keys:['ha noi','hanoi'],name:'Hà Nội',latitude:21.0285,longitude:105.8542},
  {keys:['da nang'],name:'Đà Nẵng',latitude:16.0544,longitude:108.2022},
  {keys:['can tho'],name:'Cần Thơ',latitude:10.0452,longitude:105.7469},
  {keys:['hue'],name:'Huế',latitude:16.4637,longitude:107.5909},
  {keys:['nha trang'],name:'Nha Trang',latitude:12.2388,longitude:109.1967},
  {keys:['da lat'],name:'Đà Lạt',latitude:11.9404,longitude:108.4583}
 ];
 const cache=new Map();
 function condition(code){return code===0?'Trời quang':code<=3?'Có mây':[45,48].includes(code)?'Sương mù':code>=51&&code<=67?'Mưa hoặc mưa phùn':code>=71&&code<=77?'Tuyết':code>=80&&code<=82?'Mưa rào':code>=85&&code<=86?'Tuyết rào':code>=95?'Dông':'Điều kiện khác';}
 function placeFromText(text){const q=T.normalize(text);const city=cities.find(c=>c.keys.some(k=>q.includes(k)));if(city)return city.name;
  const match=/(?:\btai\b|\bo\b)\s+(.+)/.exec(q);return match?match[1].replace(/\b(hom nay|ngay mai|chieu nay|bay gio|co mua khong|thoi tiet)\b/g,'').replace(/[?!.,]+$/,'').trim().slice(0,120):'';
 }
 async function fetchJSON(url,signal){const response=await fetch(url,{signal,credentials:'omit',headers:{Accept:'application/json'}});if(!response.ok)throw new Error(response.status===429?'weather_rate_limit':'weather_network');return response.json();}
 async function lookup({place='',coordinates=null,timezone=T.DEFAULT_ZONE,date=null,signal}={}){
  T.validZone(timezone);const now=new Date(),today=T.localDate(now,timezone);date=date||today;
  if(!T.dateValid(date)||date<today||date>T.addDays(today,6))throw new Error('weather_date_range');
  if(!coordinates&&!place.trim())throw new Error('weather_place_required');
  const key=JSON.stringify([T.normalize(place.trim()),coordinates,date,timezone]);const cached=cache.get(key);
  if(cached&&Date.now()-Date.parse(cached.fetchedAt)<300000&&Math.abs(Date.now()-Date.parse(cached.current.updatedAt))<7200000)return cached;
  const controller=new AbortController();const abort=()=>controller.abort();
  if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,12000);
  try{
   let latitude,longitude,label,areaNote='';
   if(coordinates){latitude=coordinates.latitude;longitude=coordinates.longitude;label='Vị trí bạn đã chọn';}
   else{
    const q=T.normalize(place.trim());const known=cities.find(c=>c.keys.some(k=>q===k||q.includes(k)));
    if(known){({latitude,longitude}=known);label=known.name;areaNote='Dữ liệu cho khu vực trung tâm; thời tiết tại điểm cụ thể có thể khác.';}
    else{
     const url=new URL('https://geocoding-api.open-meteo.com/v1/search');url.search=new URLSearchParams({name:place.trim(),count:'1',language:'vi',format:'json'});
     const found=(await fetchJSON(url,controller.signal)).results?.[0];if(!found)throw new Error('weather_place_not_found');
     latitude=found.latitude;longitude=found.longitude;label=[found.name,found.admin1,found.country].filter(Boolean).join(', ');
    }
   }
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new Error('weather_bad_coordinates');
   const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),timezone:'UTC',current:'temperature_2m,precipitation,weather_code',hourly:'precipitation_probability,precipitation,temperature_2m',forecast_days:'7'});
   const raw=await fetchJSON(url,controller.signal),current=raw.current;
   const updated=new Date((current?.time||'')+(/Z$/.test(current?.time||'')?'':'Z'));
   if(!current||!Number.isFinite(+updated)||Math.abs(Date.now()-+updated)>7200000||![current.temperature_2m,current.precipitation,current.weather_code].every(Number.isFinite))throw new Error('weather_stale');
   if(!Array.isArray(raw.hourly?.time))throw new Error('weather_bad_forecast');
   const hourly=raw.hourly.time.flatMap((time,i)=>{const d=new Date(time+(/Z$/.test(time)?'':'Z'));if(!Number.isFinite(+d)||T.localDate(d,timezone)!==date)return[];const probability=raw.hourly.precipitation_probability?.[i],rain=raw.hourly.precipitation?.[i],temperature=raw.hourly.temperature_2m?.[i];return[{time:d.toISOString(),localTime:T.timeData(timezone,d).time.slice(0,5),precipitationProbability:Number.isFinite(probability)&&probability>=0&&probability<=100?probability:null,precipitationMM:Number.isFinite(rain)?rain:null,temperatureC:Number.isFinite(temperature)?temperature:null}];}).slice(0,25);
   if(!hourly.length)throw new Error('weather_bad_forecast');
   const data={kind:'weather',place:label,timezone,date,fetchedAt:new Date().toISOString(),current:{updatedAt:updated.toISOString(),temperatureC:current.temperature_2m,precipitationMM:current.precipitation,condition:condition(current.weather_code)},hourly,source:{title:'Open-Meteo',url:'https://open-meteo.com/'},note:[areaNote,'Xác suất mưa là dự báo, không khẳng định hiện đang mưa. Điều kiện hiện tại là dữ liệu mô hình, không phải cảm biến tại chỗ.'].filter(Boolean).join(' ')};
   if(cache.size>=12)cache.delete(cache.keys().next().value);cache.set(key,data);return data;
  }catch(error){if(controller.signal.aborted)throw new Error(signal?.aborted?'weather_cancelled':'weather_timeout');throw error;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 const errorText=error=>({weather_place_required:'Bạn muốn xem ở đâu? Hãy nhập thành phố hoặc khu vực.',weather_place_not_found:'Chưa tìm thấy địa điểm. Hãy nhập thêm thành phố hoặc tỉnh.',weather_stale:'Nguồn chưa có dữ liệu hiện tại đủ mới. Mình chưa thể xác nhận thời tiết lúc này.',weather_bad_forecast:'Dữ liệu dự báo chưa đầy đủ. Vui lòng thử lại sau.',weather_timeout:'Kết nối thời tiết quá lâu. Bạn có thể thử lại.',weather_cancelled:'Đã dừng lấy thời tiết.',weather_date_range:'Hiện chỉ hỗ trợ dự báo từ hôm nay đến 6 ngày tới.',weather_rate_limit:'Nguồn thời tiết đang giới hạn lượt xem. Hãy đợi một chút.'}[error?.message]||'Chưa kết nối được nguồn thời tiết. Hãy kiểm tra mạng hoặc thử lại; mình chưa có dữ liệu để xác nhận.');
 const localStamp=(value,zone)=>new Date(value).toLocaleString('vi-VN',{timeZone:zone,hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});
 function describe(data,question=''){
  const lines=[`${data.place} — ${data.current.condition}, ${data.current.temperatureC}°C.`,`Lượng mưa hiện tại: ${data.current.precipitationMM} mm. Cập nhật ${localStamp(data.current.updatedAt,data.timezone)} (${data.timezone}).`];
  const afternoon=/chieu/.test(T.normalize(question));const hours=data.hourly.filter(h=>!afternoon||+h.localTime.slice(0,2)>=12&&+h.localTime.slice(0,2)<19);const probabilities=hours.map(h=>h.precipitationProbability).filter(Number.isFinite);
  if(probabilities.length)lines.push(`Dự báo ${afternoon?'12–18 giờ':'trong ngày'} ${data.date}: xác suất mưa cao nhất ${Math.max(...probabilities)}%. Xác suất này không có nghĩa chắc chắn đang mưa.`);
  lines.push('Nguồn: Open-Meteo. '+data.note);return lines.join('\n');
 }
 function initUI(){
  const $=id=>document.getElementById(id),view=$('weather-view');if(!view)return;let pending=false,lastQuery=null;
  function open(place=''){$('chat-view').hidden=true;$('calendar-view').hidden=true;view.hidden=false;$('show-chat').setAttribute('aria-pressed','false');$('show-calendar').setAttribute('aria-pressed','false');$('show-weather').setAttribute('aria-pressed','true');if(place)$('weather-place').value=place;}
  function display(data){const root=$('weather-report');root.replaceChildren();const card=document.createElement('section');card.className='weather-current';const title=document.createElement('h4');title.textContent=data.place;const temp=document.createElement('div');temp.className='weather-temperature';temp.textContent=`${data.current.temperatureC}°C`;const text=document.createElement('p');text.textContent=`${data.current.condition} · Lượng mưa hiện tại ${data.current.precipitationMM} mm`;const updated=document.createElement('p');updated.textContent=`Cập nhật ${localStamp(data.current.updatedAt,data.timezone)} · ${data.timezone}`;card.append(title,temp,text,updated);root.append(card);
   const heading=document.createElement('h4');heading.textContent=`Dự báo ${data.date}`;root.append(heading);const table=document.createElement('table');table.className='weather-table';const tr=document.createElement('tr');for(const label of ['Giờ','Nhiệt độ','Khả năng mưa']){const th=document.createElement('th');th.textContent=label;tr.append(th);}const thead=document.createElement('thead');thead.append(tr);table.append(thead);const body=document.createElement('tbody');
   const currentHour=+T.timeData(data.timezone).time.slice(0,2);let rows=data.hourly.filter(h=>data.date!==T.localDate(new Date(),data.timezone)||+h.localTime.slice(0,2)>=currentHour).slice(0,8);if(!rows.length)rows=data.hourly.slice(-4);
   rows.forEach(hour=>{const row=document.createElement('tr');for(const value of [hour.localTime,hour.temperatureC===null?'—':`${hour.temperatureC}°C`,hour.precipitationProbability===null?'Chưa có':`${hour.precipitationProbability}%`]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);});table.append(body);root.append(table);const note=document.createElement('p');note.className='weather-note';note.textContent=data.note;const source=document.createElement('a');source.className='weather-source';source.href=data.source.url;source.target='_blank';source.rel='noopener noreferrer';source.textContent=`Nguồn Open-Meteo · Lấy lúc ${localStamp(data.fetchedAt,data.timezone)}`;root.append(note,source);
  }
  async function load(query){if(pending)return;pending=true;$('weather-submit').disabled=true;$('weather-location').disabled=true;$('weather-status').textContent='Đang lấy dữ liệu từ Open-Meteo…';$('weather-report').replaceChildren();try{const result=await lookup({...query,timezone:$('chat-timezone').value});lastQuery=query;display(result);$('weather-status').textContent='Đã lấy dữ liệu thời tiết. Xem giờ cập nhật và nguồn bên dưới.';}catch(error){$('weather-status').textContent=errorText(error);}finally{pending=false;$('weather-submit').disabled=false;$('weather-location').disabled=false;}}
  $('show-weather').addEventListener('click',()=>open());$('weather-form').addEventListener('submit',e=>{e.preventDefault();load({place:$('weather-place').value});});
  $('weather-location').addEventListener('click',()=>{if(!navigator.geolocation){$('weather-status').textContent='Trình duyệt chưa hỗ trợ vị trí. Hãy nhập địa danh.';return;}$('weather-status').textContent='Đang chờ quyền vị trí theo lựa chọn của bạn…';navigator.geolocation.getCurrentPosition(p=>load({coordinates:{latitude:Number(p.coords.latitude.toFixed(3)),longitude:Number(p.coords.longitude.toFixed(3))}}),()=>{$('weather-status').textContent='Chưa lấy được vị trí. Bạn vẫn có thể nhập địa điểm ở phía trên.';},{timeout:10000,maximumAge:300000,enableHighAccuracy:false});});
  $('chat-timezone').addEventListener('change',()=>{if(!view.hidden&&lastQuery)load(lastQuery);});
  return{open,display};
 }
 const ui=typeof document!=='undefined'?initUI():null;
 globalThis.PortfolioWeather=Object.freeze({lookup,placeFromText,describe,errorText,...ui});
})();
