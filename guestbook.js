(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('gb-form'), submit = $('gb-submit'), status = $('gb-status');
  const list = $('gb-list'), refresh = $('gb-refresh'), more = $('gb-more');
  const name = $('gb-name'), message = $('gb-message'), count = $('gb-count');
  let client, busy = false, loading = false, offset = 0;
  const pageSize = 20;
  const seen = new Set();
  const say = (text, error = false) => { status.textContent = text; status.dataset.error = String(error); };
  message.addEventListener('input', () => { count.textContent = `${message.value.length} / 200`; });
  function item(row) {
    const li = document.createElement('li'), head = document.createElement('div');
    const author = document.createElement('strong'), time = document.createElement('time'), body = document.createElement('p');
    author.textContent = row.name; body.textContent = row.message;
    time.dateTime = row.created_at;
    time.textContent = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(row.created_at));
    head.append(author, time); li.append(head, body); return li;
  }
  async function load(reset) {
    if (loading) return false;
    loading = true; refresh.disabled = more.disabled = true;
    try {
      const start = reset ? 0 : offset;
      const { data, error } = await client.from('mt_guestbook').select('id,name,message,created_at')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(start, start + pageSize - 1);
      if (error) throw error;
      if (reset) { list.replaceChildren(); seen.clear(); }
      for (const row of data) if (!seen.has(row.id)) { list.append(item(row)); seen.add(row.id); }
      offset = start + data.length; more.hidden = data.length < pageSize;
      $('gb-empty').hidden = seen.size !== 0;
      return true;
    } catch (_) {
      say('글을 불러오지 못했어요. 잠시 후 새로고침을 눌러 주세요.', true);
      return false;
    } finally { loading = false; refresh.disabled = more.disabled = false; }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !client) return;
    const n = name.value.trim(), m = message.value.trim();
    if (!n || !m || n.length > 20 || m.length > 200) {
      say('이름(20자 이내)과 한마디(200자 이내)를 입력해 주세요.', true); return;
    }
    busy = true; submit.disabled = true; submit.textContent = '등록 중…'; say('한마디를 등록하고 있어요.');
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        const signed = await client.auth.signInAnonymously(); if (signed.error) throw signed.error;
      }
      const posted = await client.rpc('mt_guestbook_post', { p_name: n, p_message: m });
      if (posted.error) throw posted.error;
      message.value = ''; count.textContent = '0 / 200';
      const updated = await load(true);
      say(updated ? '한마디를 남겼어요. 반가운 마음이 전해졌습니다!' : '글은 등록되었어요. 목록은 새로고침해서 확인해 주세요.');
    } catch (error) {
      say(String(error.message).includes('RATE_LIMIT')
        ? '잠깐만요! 이전 글을 남긴 뒤 30초 후에 다시 등록해 주세요.'
        : '등록을 완료하지 못했어요. 입력 내용은 유지됩니다. 연결을 확인하고, 새로고침으로 등록 여부를 확인해 주세요.', true);
    } finally { busy = false; submit.disabled = false; submit.textContent = '한마디 남기기'; }
  });
  refresh.addEventListener('click', async () => { say('글을 불러오고 있어요.'); if (await load(true)) say('최신 글을 불러왔어요.'); });
  more.addEventListener('click', async () => { if (await load(false)) say('이전 글을 불러왔어요.'); });
  const cfg = window.MT_GUESTBOOK_CONFIG || {};
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.supabaseUrl || '') || !cfg.supabaseKey || cfg.supabaseKey.startsWith('YOUR_')) {
    say('방명록을 준비하고 있어요. 연결이 완료되면 한마디를 남길 수 있습니다.'); return;
  }
  if (cfg.supabaseKey.startsWith('sb_secret_')) { say('방명록 설정을 확인해 주세요.', true); return; }
  if (!window.supabase) { say('방명록을 불러오지 못했어요. 인터넷 연결을 확인하고 페이지를 새로고침해 주세요.', true); return; }
  try {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { storageKey: 'kbs51-mt-guestbook-auth' } });
    submit.disabled = false; refresh.disabled = false;
    say('글을 불러오고 있어요.'); load(true).then(ok => { if (ok) say('반가운 인사, 기대되는 순간을 자유롭게 남겨 주세요.'); });
  } catch (_) { say('방명록 연결 설정을 확인해 주세요.', true); }
})();
