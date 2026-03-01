const SUPABASE_URL = 'https://ighoounlvlbgtbxdsriy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnaG9vdW5sdmxiZ3RieGRzcml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjI1NDQsImV4cCI6MjA4Nzg5ODU0NH0.fM6Fvuznlun75gMlObZG2JhBTiEwcd5sPS8mgE6t37E';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function signUp(name, email, password) {
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name } } });
  if (error) throw error;
  if (data.user) {
    await sb.from('usuarios').upsert({ id: data.user.id, full_name: name, email, created_at: new Date().toISOString() });
  }
  return data;
}

async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = 'landing.html';
}

async function getUser() {
  try {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  } catch(e) { return null; }
}

async function getUserProfile(userId) {
  try {
    const { data } = await sb.from('usuarios').select('*').eq('id', userId).single();
    return data;
  } catch(e) { return null; }
}

async function updateProfile(userId, updates) {
  await sb.from('usuarios').update(updates).eq('id', userId);
}

async function uploadAvatar(userId, file) {
  const ext = file.type.includes('png') ? 'png' : 'jpg';
  const path = `${userId}.${ext}`;
  await sb.storage.from('avatars').remove([`${userId}.jpg`, `${userId}.jpeg`, `${userId}.png`]);
  const { error } = await sb.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  await updateProfile(userId, { avatar_url: data.publicUrl });
  return data.publicUrl + '?t=' + Date.now();
}

async function requireAuth() {
  try {
    const user = await getUser();
    if (!user) { window.location.href = 'login.html'; return null; }
    return user;
  } catch(e) { window.location.href = 'login.html'; return null; }
}

async function redirectIfLoggedIn() {
  try {
    const user = await getUser();
    if (user) window.location.href = 'dashboard.html';
  } catch(e) {}
}

async function saveAnswer(userId, questaoId, materia, correta) {
  try {
    await sb.from('questoes_respondidas').insert({ user_id: userId, questao_id: questaoId, materia, correta, respondida_em: new Date().toISOString() });
  } catch(e) {}
}

async function getStats(userId) {
  try {
    const { data } = await sb.from('questoes_respondidas').select('*').eq('user_id', userId);
    if (!data || data.length === 0) return { total: 0, corretas: 0, taxa: 0 };
    const total = data.length;
    const corretas = data.filter(q => q.correta).length;
    return { total, corretas, taxa: Math.round((corretas / total) * 100) };
  } catch(e) { return { total: 0, corretas: 0, taxa: 0 }; }
}

async function getProgress(userId) {
  try {
    const { data } = await sb.from('progresso').select('*').eq('user_id', userId);
    return data || [];
  } catch(e) { return []; }
}

async function saveProgress(userId, materia, percentual) {
  try {
    await sb.from('progresso').upsert({ user_id: userId, materia, percentual, updated_at: new Date().toISOString() }, { onConflict: 'user_id,materia' });
  } catch(e) {}
}

async function getStudyTime(userId) {
  try {
    const { data } = await sb.from('sessoes_estudo').select('duracao_min').eq('user_id', userId);
    return (data || []).reduce((acc, s) => acc + (s.duracao_min || 0), 0);
  } catch(e) { return 0; }
}