export interface SupabaseVoiceSettings { url: string; bucket: string; serviceRoleKey: string; budgetBytes: number; }
export function supabaseVoiceSettings(input: Record<string, unknown>, production: boolean): SupabaseVoiceSettings | undefined {
  const values = ['SUPABASE_URL','SUPABASE_VOICE_BUCKET','SUPABASE_SERVICE_ROLE_KEY'].map(name => {
    const value=input[name]; if(value!==undefined && typeof value!=='string')throw Error(`${name} must be a string.`);return typeof value==='string'?value.trim():'';
  });
  if(!values.some(Boolean))return undefined;
  if(values.some(value=>!value))throw Error('Configure all SUPABASE voice-storage settings, or leave all three empty.');
  const [rawUrl,bucket,serviceRoleKey]=values as [string,string,string];let url:URL;
  try{url=new URL(rawUrl);}catch{throw Error('SUPABASE_URL must be the project HTTPS URL.');}
  const local=!production && url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if((url.protocol!=='https:'&&!local)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||(!local&&!/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)))throw Error('SUPABASE_URL must be the hosted project HTTPS URL, or local HTTP for isolated tests.');
  if(!/^[a-z0-9][a-z0-9_-]{2,62}$/.test(bucket))throw Error('SUPABASE_VOICE_BUCKET must be a private bucket name of 3-63 lowercase letters, numbers, underscores or hyphens.');
  try {
    if(serviceRoleKey.length>12000 || serviceRoleKey.split('.').length!==3)throw Error();
    const claims=JSON.parse(Buffer.from(serviceRoleKey.split('.')[1]!,'base64url').toString('utf8')) as {role?:unknown};
    if(claims.role!=='service_role')throw Error();
  }catch{throw Error('SUPABASE_SERVICE_ROLE_KEY must be the legacy service_role key from project API settings, not an anon/publishable key.');}
  const budgetBytes=Number(input.VOICE_STORAGE_BUDGET_BYTES??268435456);
  if(!Number.isSafeInteger(budgetBytes)||budgetBytes<16777216||budgetBytes>536870912)throw Error('VOICE_STORAGE_BUDGET_BYTES must be between 16777216 and 536870912.');
  return {url:url.origin,bucket,serviceRoleKey,budgetBytes};
}
