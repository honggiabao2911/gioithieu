import '../tools.js';
const T = globalThis.PortfolioTools;
const str = (v, max = 120) => typeof v === 'string' && v.trim() && v.length <= max;
const schema = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string' }, nullableString = { type: ['string', 'null'] };
export const toolDefinitions = [
  { type: 'function', name: 'get_time', description: 'Get actual current time, local date, weekday and timezone offset. Use for every date/time question.', strict: true, parameters: schema({ timezone: string }) },
  { type: 'function', name: 'get_weather', description: 'Real Open-Meteo current conditions and forecast. Ask for location if absent. Coordinates only from user-consented location context.', strict: true, parameters: schema({ location: nullableString, latitude: { type: ['number', 'null'] }, longitude: { type: ['number', 'null'] }, timezone: string, date: nullableString }) },
  { type: 'function', name: 'prepare_calendar', description: 'Prepare a local calendar proposal for user review, never save. Ask missing essential date, time or duration before calling. Interpret relative dates using current time and requested timezone.', strict: true, parameters: schema({ events: { type: 'array', items: schema({ title: string, date: string, time: string, duration: { type: 'integer' }, timezone: string, notes: string }) } }) },
  { type: 'function', name: 'query_calendar', description: 'Request a local-device calendar lookup, executed by the browser. Server cannot access the actual calendar. Never claim results before local lookup.', strict: true, parameters: schema({ date: nullableString, query: string }) },
  { type: 'function', name: 'show_portfolio_section', description: 'Offer a button to a known portfolio section. User chooses whether to navigate.', strict: true, parameters: schema({ section: { type: 'string', enum: ['about', 'school', 'projects', 'contact'] } }) }
];
const weatherNames = code => code === 0 ? 'Trời quang' : code <= 3 ? 'Có mây' : [45,48].includes(code) ? 'Sương mù' : code >= 51 && code <= 67 ? 'Mưa hoặc mưa phùn' : code >= 71 && code <= 77 ? 'Tuyết' : code >= 80 && code <= 82 ? 'Mưa rào' : code >= 95 ? 'Dông' : 'Điều kiện khác';
async function json(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('weather_unavailable');
  return response.json();
}
export async function executeTool(name, args, context) {
  const { timezone, now, signal, location: consent } = context;
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('invalid_tool_arguments');
  if (name === 'get_time') return { kind: 'time', ...T.timeData(T.validZone(args.timezone || timezone), now) };
  if (name === 'show_portfolio_section') {
    if (!['about', 'school', 'projects', 'contact'].includes(args.section)) throw new Error('invalid_section');
    return { kind: 'section', section: args.section, requiresUserClick: true };
  }
  if (name === 'prepare_calendar') {
    if (!Array.isArray(args.events) || !args.events.length || args.events.length > 12) throw new Error('invalid_events');
    return { kind: 'calendar_proposal', events: args.events.map(T.validateEvent), saved: false, storage: 'local-device-only', requiresConfirmation: true };
  }
  if (name === 'query_calendar') {
    if (args.date !== null && !T.dateValid(args.date) || typeof args.query !== 'string' || args.query.length > 120) throw new Error('invalid_calendar_query');
    return { kind: 'calendar_query', date: args.date, query: args.query, requiresClientLookup: true, synchronized: false };
  }
  if (name !== 'get_weather') throw new Error('unknown_tool');
  const zone = T.validZone(args.timezone || timezone);
  if (args.date !== null && !T.dateValid(args.date)) throw new Error('invalid_weather_date');
  const requestedDate = args.date || T.localDate(now, zone);
  const today = T.localDate(now, zone);
  if (requestedDate < today || requestedDate > T.addDays(today, 6)) throw new Error('weather_date_out_of_range');
  let latitude, longitude, place;
  if (args.latitude !== null || args.longitude !== null) {
    if (!consent || !Number.isFinite(args.latitude) || !Number.isFinite(args.longitude) || Math.abs(args.latitude - consent.latitude) > .001 || Math.abs(args.longitude - consent.longitude) > .001) throw new Error('coordinates_not_authorized');
    latitude = consent.latitude; longitude = consent.longitude; place = 'Vị trí bạn đã chọn';
  } else {
    if (!str(args.location)) return { kind: 'needs_location', message: 'Bạn muốn xem thời tiết ở địa điểm nào? Có thể nhập địa danh hoặc chọn Dùng vị trí của tôi.' };
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({ name: args.location.trim(), count: '1', language: 'vi', format: 'json' });
    const geo = (await json(url, signal)).results?.[0];
    if (!geo || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude)) return { kind: 'needs_location', message: 'Chưa tìm được địa điểm. Hãy thêm tên thành phố hoặc tỉnh.' };
    latitude = geo.latitude; longitude = geo.longitude; place = [geo.name, geo.admin1, geo.country].filter(Boolean).join(', ');
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('invalid_coordinates');
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), timezone: 'UTC', current: 'temperature_2m,precipitation,weather_code', hourly: 'precipitation_probability,precipitation,temperature_2m,weather_code', forecast_days: '7' });
  const data = await json(url, signal), current = data.current;
  const updated = new Date((current?.time || '') + (/Z$/.test(current?.time || '') ? '' : 'Z'));
  if (!current || !Number.isFinite(+updated) || Math.abs(+now - +updated) > 2 * 3600000 || !Number.isFinite(current.temperature_2m) || !Number.isFinite(current.weather_code) || !Number.isFinite(current.precipitation)) throw new Error('weather_stale_or_invalid');
  const times = data.hourly?.time;
  if (!Array.isArray(times)) throw new Error('weather_invalid_forecast');
  const hourly = times.flatMap((time, i) => {
    const instant = new Date(time + (/Z$/.test(time) ? '' : 'Z'));
    if (!Number.isFinite(+instant) || T.localDate(instant, zone) !== requestedDate) return [];
    const probability = data.hourly.precipitation_probability?.[i], rain = data.hourly.precipitation?.[i];
    return [{ time: instant.toISOString(), localTime: T.timeData(zone, instant).time.slice(0, 5), precipitationProbability: Number.isFinite(probability) && probability >= 0 && probability <= 100 ? probability : null, precipitationMM: Number.isFinite(rain) ? rain : null }];
  }).slice(0, 25);
  if (!hourly.length) throw new Error('forecast_missing');
  return { kind: 'weather', place, timezone: zone, date: requestedDate, fetchedAt: now.toISOString(), current: { updatedAt: updated.toISOString(), temperatureC: current.temperature_2m, precipitationMM: current.precipitation, condition: weatherNames(current.weather_code) }, hourly, source: { title: 'Open-Meteo · Điều kiện hiện tại và dự báo', url: 'https://open-meteo.com/' }, note: 'Xác suất mưa là dự báo theo giờ, không khẳng định hiện đang mưa. Điều kiện hiện tại từ dữ liệu mô hình thời tiết, không phải quan sát tại chỗ.' };
}
