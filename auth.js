/* ============================================================
   GoiâniaConc — auth.js
   Autenticação e gerenciamento de usuário com Supabase
   ============================================================ */

const SUPABASE_URL = 'https://ighoounlvlbgtbxdsriy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnaG9vdW5sdmxiZ3RieGRzcml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjI1NDQsImV4cCI6MjA4Nzg5ODU0NH0.fM6Fvuznlun75gMlObZG2JhBTiEwcd5sPS8mgE6t37E';

// Inicializa o cliente Supabase
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── AUTENTICAÇÃO ── */

// Cadastro com email e senha
async function signUp(name, email, password) {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } }
  });
  if (error) throw error;

  // Cria perfil na tabela usuarios
  if (data.user) {
    await sb.from('usuarios').insert({
      id: data.user.id,
      full_name: name,
      email: email,
      avatar_url: null,
      created_at: new Date().toISOString()
    });
  }
  return data;
}

// Login com email e senha
async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Logout
async function signOut() {
  const { error } = await sb.auth.signOut();
  if (error) throw error;
  window.location.href = 'landing.html';
}

// Retorna o usuário logado
async function getUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// Retorna o perfil completo do usuário
async function getUserProfile(userId) {
  const { data, error } = await sb.from('usuarios').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

// Atualiza nome do perfil
async function updateProfile(userId, updates) {
  const { error } = await sb.from('usuarios').update(updates).eq('id', userId);
  if (error) throw error;
}

// Upload de foto de perfil
async function uploadAvatar(userId, file) {
  // Detecta extensão real do arquivo
  const ext = file.type.includes('png') ? 'png' : 'jpg';
  const path = `${userId}.${ext}`;
  
  // Remove arquivos antigos
  await sb.storage.from('avatars').remove([
    `${userId}.jpg`,
    `${userId}.jpeg`, 
    `${userId}.png`
  ]);
  
  const { error } = await sb.storage
    .from('avatars')
    .upload(path, file, { 
      upsert: true, 
      contentType: file.type
    });
  
  if (error) throw error;
  
  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  const url = data.publicUrl + '?t=' + Date.now();
  
  await updateProfile(userId, { avatar_url: data.publicUrl });
  return url;
}

/* ── PROGRESSO ── */

// Salva progresso de uma matéria
async function saveProgress(userId, materia, percentual) {
  const { error } = await sb.from('progresso').upsert({
    user_id: userId,
    materia,
    percentual,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,materia' });
  if (error) throw error;
}

// Busca todo o progresso do usuário
async function getProgress(userId) {
  const { data, error } = await sb.from('progresso').select('*').eq('user_id', userId);
  if (error) return [];
  return data;
}

// Salva questão respondida
async function saveAnswer(userId, questaoId, materia, correta) {
  const { error } = await sb.from('questoes_respondidas').insert({
    user_id: userId,
    questao_id: questaoId,
    materia,
    correta,
    respondida_em: new Date().toISOString()
  });
  if (error) throw error;
}

// Busca estatísticas do usuário
async function getStats(userId) {
  const { data, error } = await sb.from('questoes_respondidas').select('*').eq('user_id', userId);
  if (error) return { total: 0, corretas: 0, taxa: 0 };
  const total = data.length;
  const corretas = data.filter(q => q.correta).length;
  const taxa = total > 0 ? Math.round((corretas / total) * 100) : 0;
  return { total, corretas, taxa };
}

// Busca tempo de estudo
async function getStudyTime(userId) {
  const { data, error } = await sb.from('sessoes_estudo').select('duracao_min').eq('user_id', userId);
  if (error) return 0;
  return data.reduce((acc, s) => acc + (s.duracao_min || 0), 0);
}

// Inicia sessão de estudo
async function startStudySession(userId) {
  const { data, error } = await sb.from('sessoes_estudo').insert({
    user_id: userId,
    iniciada_em: new Date().toISOString(),
    duracao_min: 0
  }).select().single();
  if (error) return null;
  return data.id;
}

// Finaliza sessão de estudo
async function endStudySession(sessionId, duracaoMin) {
  await sb.from('sessoes_estudo').update({ duracao_min: duracaoMin }).eq('id', sessionId);
}

// Inicializa tabelas no Supabase (executar uma vez via SQL Editor)
const SQL_INIT = `
-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de progresso por matéria
CREATE TABLE IF NOT EXISTS progresso (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES usuarios(id),
  materia TEXT NOT NULL,
  percentual INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, materia)
);

-- Tabela de questões respondidas
CREATE TABLE IF NOT EXISTS questoes_respondidas (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES usuarios(id),
  questao_id TEXT,
  materia TEXT,
  correta BOOLEAN,
  respondida_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de sessões de estudo
CREATE TABLE IF NOT EXISTS sessoes_estudo (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES usuarios(id),
  iniciada_em TIMESTAMPTZ DEFAULT NOW(),
  duracao_min INTEGER DEFAULT 0
);

-- RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE progresso ENABLE ROW LEVEL SECURITY;
ALTER TABLE questoes_respondidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_estudo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own" ON usuarios FOR ALL USING (auth.uid() = id);
CREATE POLICY "progress_own" ON progresso FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "answers_own" ON questoes_respondidas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "sessions_own" ON sessoes_estudo FOR ALL USING (auth.uid() = user_id);
`;
