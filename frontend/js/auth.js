// ─── AUTH MODULE ─────────────────────────────────────────────────
const auth = {
  init() {
    const form = el('login-form');
    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const username = el('login-username').value.trim();
        const password = el('login-password').value;
        if (!username || !password) { toast.error('Error', 'Enter username and password'); return; }

        const btn = el('login-btn');
        loadingBtn(btn, true);
        try {
          const data = await api.login(username, password);
          localStorage.setItem('pos_token', data.token);
          localStorage.setItem('pos_user', JSON.stringify(data.user));
          app.user = data.user;
          toast.success('Welcome!', `Logged in as ${data.user.name}`);
          app.showApp();
        } catch(e) {
          toast.error('Login Failed', e.message);
          el('login-password').value = '';
        } finally {
          loadingBtn(btn, false);
        }
      });
    }
  },

  async logout() {
    if (!confirmDialog('Logout from POS System?')) return;
    try { await api.logout(); } catch(e) {}
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    app.user = null;
    app.showLogin();
    toast.info('Logged out', 'See you next time!');
  },
};
