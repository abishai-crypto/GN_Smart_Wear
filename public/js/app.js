/**
 * GLOWNEST SMART WEAR (GN SMART WEAR) - FRONTEND CORE JS
 * Mfumo wa Mauzo, Manunuzi, Kuwekeza (Layaway), Mikopo na Ripoti za Kibiashara
 */

// Global State
const state = {
  currentUser: null,
  products: [],
  cart: [],
  selectedPaymentMode: 'cash',
  activeCategory: 'all',
  activeGender: 'all',
  activeSalesPeriod: '7days',
  settings: {},
  trendChart: null,
  categoryChart: null,
  currentReceiptSale: null,
  currentReceiptItems: [],
  expenses: [],
  orders: [],
  activeOrderStatus: 'all',
  ordersSearchKeyword: '',
  ordersTargetDate: '',
  currentReceiptOrder: null
};

// Formatting Helper: Currency TZS
function formatTZS(amount) {
  const num = parseFloat(amount) || 0;
  return 'TZS ' + num.toLocaleString('en-US');
}

// Toast Notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';

  let icon = '<i class="fa-solid fa-circle-info" style="color: var(--accent-cyan);"></i>';
  if (type === 'success') icon = '<i class="fa-solid fa-circle-check" style="color: var(--accent-emerald);"></i>';
  if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation" style="color: var(--accent-rose);"></i>';

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ===================================================
// 1. INITIALIZATION & THEME / BRIGHTNESS CONTROLS
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initClock();
  initAuth();
  initNavigation();
  initDailyRevenue();
  initModals();
  initImageUploadZones();
  loadSettings();
  loadSummaryKPIs();
  loadDailyRevenue();
  loadProducts();
  loadPurchases();
  loadOrders();
  loadLayaways();
  loadCredits();
  loadExpenses();
  loadSalesReport();
  initPOS();
  initForms();
});

function initTheme() {
  const savedTheme = localStorage.getItem('gn_theme') || 'light'; // Default to Bright Mode as requested
  applyTheme(savedTheme);

  const btnToggle = document.getElementById('btnThemeToggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const isLight = document.body.classList.contains('light-theme');
      const newTheme = isLight ? 'dark' : 'light';
      applyTheme(newTheme);
      showToast(newTheme === 'light' ? 'Hali ya Mwangaza (Bright Mode) imewashwa! ✨' : 'Hali ya Giza (Dark Mode) imewashwa! 🌙', 'info');
    });
  }
}

function applyTheme(theme) {
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    localStorage.setItem('gn_theme', 'light');
    if (icon) {
      icon.className = 'fa-solid fa-moon';
      icon.style.color = '#475569';
    }
    if (label) label.innerText = 'Giza';
  } else {
    document.body.classList.remove('light-theme');
    localStorage.setItem('gn_theme', 'dark');
    if (icon) {
      icon.className = 'fa-solid fa-sun';
      icon.style.color = '#f59e0b';
    }
    if (label) label.innerText = 'Mwangaza';
  }
}

function initClock() {
  function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    const dateStr = now.toLocaleDateString('sw-TZ', options);

    const clockEl = document.getElementById('liveClock');
    const dateEl = document.getElementById('liveDate');
    if (clockEl) clockEl.innerText = timeStr;
    if (dateEl) dateEl.innerText = dateStr;
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// ===================================================
// 1.5 AUTHENTICATION & ROLE-BASED ACCESS CONTROL
// ===================================================

function initAuth() {
  // Check stored session
  const storedUser = localStorage.getItem('gn_current_user');
  if (storedUser) {
    try {
      state.currentUser = JSON.parse(storedUser);
      applyUserRolePermissions();
    } catch (e) {
      localStorage.removeItem('gn_current_user');
      state.currentUser = null;
    }
  }

  // If no user is logged in, show login modal
  if (!state.currentUser) {
    showLoginModal();
  }

  // Quick profile selector buttons
  const btnPickCashier = document.getElementById('loginPickCashier');
  const btnPickAdmin = document.getElementById('loginPickAdmin');
  const usernameInput = document.getElementById('loginUsernameInput');
  const pinInput = document.getElementById('loginPinInput');

  if (btnPickCashier && btnPickAdmin) {
    btnPickCashier.addEventListener('click', () => {
      btnPickCashier.classList.add('active');
      btnPickAdmin.classList.remove('active');
      if (usernameInput) usernameInput.value = 'muuzaji';
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    });

    btnPickAdmin.addEventListener('click', () => {
      btnPickAdmin.classList.add('active');
      btnPickCashier.classList.remove('active');
      if (usernameInput) usernameInput.value = 'admin';
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    });
  }

  // PIN Keypad buttons
  document.querySelectorAll('.pin-key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-key');
      const action = btn.getAttribute('data-action');
      if (!pinInput) return;

      if (key !== null) {
        if (pinInput.value.length < 10) {
          pinInput.value += key;
        }
      } else if (action === 'clear') {
        pinInput.value = '';
      } else if (action === 'backspace') {
        pinInput.value = pinInput.value.slice(0, -1);
      }
      pinInput.focus();
    });
  });

  // Toggle PIN visibility
  const togglePinBtn = document.getElementById('btnToggleLoginPin');
  if (togglePinBtn && pinInput) {
    togglePinBtn.addEventListener('click', () => {
      const isPwd = pinInput.type === 'password';
      pinInput.type = isPwd ? 'text' : 'password';
      togglePinBtn.innerHTML = isPwd ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });
  }

  // Login Form Submission
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  // Logout button in header
  const btnLogout = document.getElementById('btnLogout') || document.getElementById('btnLogoutUser');
  if (btnLogout) {
    btnLogout.addEventListener('click', handleLogout);
  }
  window.handleLogout = handleLogout;
}

function showLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.add('active');
    const pinInput = document.getElementById('loginPinInput');
    if (pinInput) {
      pinInput.value = '';
      setTimeout(() => pinInput.focus(), 200);
    }
  }
}
window.showLoginModal = showLoginModal;

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsernameInput')?.value.trim();
  const password_pin = document.getElementById('loginPinInput')?.value.trim();

  if (!username || !password_pin) {
    showToast('Tafadhali weka Username na PIN ya siri!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password_pin })
    });

    const json = await res.json();
    if (json.success && json.user) {
      state.currentUser = json.user;
      localStorage.setItem('gn_current_user', JSON.stringify(json.user));

      const modal = document.getElementById('loginModal');
      if (modal) modal.classList.remove('active');

      applyUserRolePermissions();

      showToast(`Karibu sana ${json.user.full_name}!`, 'success');

      // Refresh all modules with current role permissions
      loadProducts();
      loadSummaryKPIs();
      if (json.user.role === 'cashier') {
        loadCashierShift();
        // If current active tab is an admin-restricted one, switch to POS
        const activeNav = document.querySelector('.nav-btn.active');
        if (activeNav && activeNav.classList.contains('admin-only')) {
          const posBtn = document.querySelector('.nav-btn[data-tab="pos-view"]');
          if (posBtn) posBtn.click();
        }
      } else {
        loadPurchases();
        loadSalesReport();
        loadUsersTable();
      }
    } else {
      showToast(json.message || 'Username au PIN sio sahihi!', 'error');
      const pinInput = document.getElementById('loginPinInput');
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    }
  } catch (err) {
    console.error('Login error:', err);
    showToast('Hitilafu ya kuunganisha! Hakikisha seva (Server) imewashwa na unafungua kupitia http://localhost:3000 au link ya Render.', 'error');
  }
}

function handleLogout() {
  localStorage.removeItem('gn_current_user');
  state.currentUser = null;
  document.body.classList.remove('role-admin');
  document.body.classList.remove('role-cashier');

  // Reset badge displays
  const nameEl = document.getElementById('sessionUserName');
  const roleEl = document.getElementById('sessionUserRole');
  if (nameEl) nameEl.innerText = 'Hakuna Mtumiaji';
  if (roleEl) {
    roleEl.innerText = 'Tafadhali Ingia';
    roleEl.className = 'user-role-tag';
  }

  // Switch to POS tab so next user starts fresh
  const posBtn = document.querySelector('.nav-btn[data-tab="pos-view"]');
  if (posBtn) posBtn.click();

  showToast('Umetoka kwenye mfumo salama.', 'info');
  showLoginModal();
}
window.handleLogout = handleLogout;

function applyUserRolePermissions() {
  const user = state.currentUser;
  if (!user) return;

  const nameEl = document.getElementById('sessionUserName');
  const roleEl = document.getElementById('sessionUserRole');
  const body = document.body;

  if (nameEl) nameEl.innerText = user.full_name;

  if (user.role === 'admin') {
    body.classList.add('role-admin');
    body.classList.remove('role-cashier');
    if (roleEl) {
      roleEl.innerText = 'MMILIKI (ADMIN)';
      roleEl.className = 'user-role-tag admin';
    }
  } else {
    body.classList.add('role-cashier');
    body.classList.remove('role-admin');
    if (roleEl) {
      roleEl.innerText = 'CASHIER';
      roleEl.className = 'user-role-tag cashier';
    }
  }
}

// ===================================================
// 2. NAVIGATION & TABS
// ===================================================

function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      // Restrict admin-only tabs from cashier role
      if (btn.classList.contains('admin-only') && state.currentUser?.role === 'cashier') {
        showToast('Sehemu hii inaruhusiwa kwa Mmiliki/Admin tu!', 'error');
        return;
      }

      navBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));

      btn.classList.add('active');
      const targetEl = document.getElementById(targetTab);
      if (targetEl) targetEl.classList.add('active');

      // Refresh data on tab switch
      loadSummaryKPIs();
      if (targetTab === 'inventory-view') {
        loadProducts();
        if (state.currentUser?.role === 'admin') loadPurchases();
      } else if (targetTab === 'orders-view') {
        loadOrders();
      } else if (targetTab === 'layaway-view') {
        loadLayaways();
      } else if (targetTab === 'cashier-shift-view') {
        loadCashierShift();
      } else if (targetTab === 'daily-revenue-view') {
        loadDailyRevenue();
      } else if (targetTab === 'credit-view') {
        loadCredits();
      } else if (targetTab === 'expenses-view') {
        loadExpenses();
      } else if (targetTab === 'reports-view') {
        loadCharts(state.activeSalesPeriod);
        loadSalesReport();
      } else if (targetTab === 'settings-view') {
        loadUsersTable();
      } else if (targetTab === 'pos-view') {
        loadProducts();
      }
    });
  });
}

// ===================================================
// 3. KPI SUMMARY & SETTINGS
// ===================================================

async function loadSummaryKPIs() {
  try {
    const res = await fetch('/api/reports/summary');
    const json = await res.json();
    if (json.success) {
      const d = json.data;
      // Top Inflow Card (Mauzo + Wanaowekeza + Mikopo)
      if (document.getElementById('kpiTodayInflow')) {
        document.getElementById('kpiTodayInflow').innerText = formatTZS(d.todayTotalInflow ?? d.todaySales);
      }
      if (document.getElementById('kpiSubMauzo')) {
        document.getElementById('kpiSubMauzo').innerText = formatTZS(d.todayDirectSales ?? d.todaySales);
      }
      if (document.getElementById('kpiSubWekeza')) {
        document.getElementById('kpiSubWekeza').innerText = formatTZS(d.todayLayawayCollected || 0);
      }
      if (document.getElementById('kpiSubMikopo')) {
        document.getElementById('kpiSubMikopo').innerText = formatTZS(d.todayCreditCollected || 0);
      }

      if (document.getElementById('kpiTodaySales')) {
        document.getElementById('kpiTodaySales').innerText = formatTZS(d.todaySales);
      }
      if (document.getElementById('kpiTodayTxCount')) {
        document.getElementById('kpiTodayTxCount').innerText = d.todayTransactions;
      }
      if (document.getElementById('kpiTodayExpenses')) {
        document.getElementById('kpiTodayExpenses').innerText = formatTZS(d.todayExpenses || 0);
      }
      document.getElementById('kpiTodayProfit').innerText = formatTZS(d.todayProfit);
      if (document.getElementById('kpiProfitBreakdown')) {
        document.getElementById('kpiProfitBreakdown').innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> Ghafi: ${formatTZS(d.todayGrossProfit || 0)} &bull; Matumizi: ${formatTZS(d.todayExpenses || 0)}`;
      }
      document.getElementById('kpiStockValue').innerText = formatTZS(d.totalStockValue);
      document.getElementById('kpiTotalStockUnits').innerText = d.totalUnits;
      document.getElementById('kpiLayawayDeposited').innerText = formatTZS(d.layawayDeposited);
      document.getElementById('kpiActiveLayaways').innerText = d.activeLayaways;
      document.getElementById('kpiCreditDue').innerText = formatTZS(d.totalCreditDue);
      document.getElementById('kpiActiveDebtors').innerText = d.activeDebtors;

      // Badges
      const lowStockBadge = document.getElementById('lowStockBadge');
      if (d.lowStockCount > 0) {
        lowStockBadge.style.display = 'inline-block';
        lowStockBadge.innerText = d.lowStockCount;
      } else {
        lowStockBadge.style.display = 'none';
      }

      const layawayBadge = document.getElementById('layawayBadge');
      if (d.activeLayaways > 0) {
        layawayBadge.style.display = 'inline-block';
        layawayBadge.innerText = d.activeLayaways;
      } else {
        layawayBadge.style.display = 'none';
      }

      const creditBadge = document.getElementById('creditBadge');
      if (d.activeDebtors > 0) {
        creditBadge.style.display = 'inline-block';
        creditBadge.innerText = d.activeDebtors;
      } else {
        creditBadge.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Error fetching KPIs:', err);
  }
}

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const json = await res.json();
    if (json.success) {
      state.settings = json.data;
      const d = json.data;

      // Populate Settings form
      for (const k in d) {
        const input = document.getElementById('set_' + k);
        if (input) input.value = d[k];
      }

      // Update Header Subtitle Location
      const headerLoc = document.getElementById('headerStoreLocation');
      if (headerLoc && d.store_location) headerLoc.innerText = d.store_location;

      // Update Profile Showcase Card
      const pName = document.getElementById('profileStoreName');
      if (pName && d.store_name) pName.innerText = d.store_name;

      const pTagline = document.getElementById('profileStoreTagline');
      if (pTagline && d.store_tagline) pTagline.innerText = d.store_tagline;

      const pOwner = document.getElementById('profileOwnerName');
      if (pOwner && d.owner_name) pOwner.innerText = d.owner_name;

      const pLoc = document.getElementById('profileLocation');
      if (pLoc && d.store_location) pLoc.innerText = d.store_location;

      const pPhone1 = document.getElementById('profilePhonePrimary');
      if (pPhone1 && d.store_phone_primary) pPhone1.innerText = d.store_phone_primary;

      const pPhone2 = document.getElementById('profilePhoneSecondary');
      if (pPhone2 && d.store_phone_secondary) pPhone2.innerText = d.store_phone_secondary;

      const pTigoNum = document.getElementById('profileTigoNumber');
      if (pTigoNum && d.tigo_lipa_number) pTigoNum.innerText = d.tigo_lipa_number;

      const pTigoName = document.getElementById('profileTigoName');
      if (pTigoName && d.tigo_lipa_name) pTigoName.innerText = d.tigo_lipa_name;

      const pAirtelNum = document.getElementById('profileAirtelNumber');
      if (pAirtelNum && d.airtel_lipa_number) pAirtelNum.innerText = d.airtel_lipa_number;

      const pAirtelName = document.getElementById('profileAirtelName');
      if (pAirtelName && d.airtel_lipa_name) pAirtelName.innerText = d.airtel_lipa_name;

      // Populate receipt header
      if (d.store_name) document.getElementById('recStoreName').innerText = d.store_name;
      if (d.store_tagline) document.getElementById('recStoreTagline').innerText = d.store_tagline;
      if (d.owner_name) {
        const recOwner = document.getElementById('recStoreOwner');
        if (recOwner) recOwner.innerText = 'Mmiliki: ' + d.owner_name;
      }
      if (d.store_phone) document.getElementById('recStorePhone').innerText = 'Simu: ' + d.store_phone;
      if (d.store_location) document.getElementById('recStoreLocation').innerText = d.store_location;
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

// ===================================================
// 4. POS (POINT OF SALE) & PRODUCTS
// ===================================================

async function loadProducts() {
  try {
    const roleParam = state.currentUser?.role || 'cashier';
    const res = await fetch(`/api/products?role=${encodeURIComponent(roleParam)}`, {
      headers: { 'x-user-role': roleParam }
    });
    const json = await res.json();
    if (json.success) {
      state.products = json.data;
      renderPOSProducts();
      renderInventoryTable();
      populateRestockProductOptions();
    }
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

function initPOS() {
  // Category Pills
  const pills = document.querySelectorAll('#posCategoryPills .pill-btn');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeCategory = pill.getAttribute('data-category');
      renderPOSProducts();
    });
  });

  // Gender Filter
  const genderSelect = document.getElementById('posGenderFilter');
  if (genderSelect) {
    genderSelect.addEventListener('change', (e) => {
      state.activeGender = e.target.value;
      renderPOSProducts();
    });
  }

  // Search Input & Barcode Scanner
  const searchInput = document.getElementById('posSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderPOSProducts();
    });

    // Handle Barcode Scanner (USB Scanners send Enter key upon scan)
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim().toLowerCase();
        if (!query) return;

        const matchedProduct = state.products.find(p => 
          p.code.toLowerCase() === query || 
          p.name.toLowerCase() === query
        );

        if (matchedProduct) {
          addToCart(matchedProduct.id);
          searchInput.value = '';
          renderPOSProducts();
          showToast(`⚡ Barcode Imesomwa: "${matchedProduct.name}" imeongezwa kikapuni!`, 'success');
        } else {
          showToast(`Hakuna nguo yenye msimbo wa "${searchInput.value}"`, 'error');
        }
      }
    });
  }

  // Payment Mode Selectors
  const payBtns = document.querySelectorAll('.pay-mode-btn');
  payBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      payBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedPaymentMode = btn.getAttribute('data-mode');
    });
  });

  // Clear Cart
  document.getElementById('btnClearCart').addEventListener('click', () => {
    state.cart = [];
    renderCart();
  });

  // Discount input
  document.getElementById('cartDiscountInput').addEventListener('input', () => {
    renderCart();
  });

  // Open Checkout Modal
  document.getElementById('btnOpenCheckoutModal').addEventListener('click', () => {
    if (state.cart.length === 0) {
      showToast('Kikapu kiko tupu! Weka nguo kwanza.', 'error');
      return;
    }
    openCheckoutModal();
  });

  // Confirm Final Sale
  document.getElementById('btnConfirmFinalSale').addEventListener('click', handleFinalSaleSubmit);
}

function renderPOSProducts() {
  const container = document.getElementById('posProductsGrid');
  if (!container) return;

  const searchKeyword = (document.getElementById('posSearchInput')?.value || '').toLowerCase().trim();

  const filtered = state.products.filter(p => {
    const matchCategory = state.activeCategory === 'all' || p.category === state.activeCategory;
    const matchGender = state.activeGender === 'all' || p.gender_age === state.activeGender;
    const matchSearch = !searchKeyword || 
      p.name.toLowerCase().includes(searchKeyword) || 
      p.code.toLowerCase().includes(searchKeyword) ||
      (p.size && p.size.toLowerCase().includes(searchKeyword)) ||
      (p.color && p.color.toLowerCase().includes(searchKeyword));

    return matchCategory && matchGender && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">
        <i class="fa-solid fa-shirt" style="font-size: 2.5rem; margin-bottom: 10px;"></i>
        <p>Hakuna nguo iliyopatikana kwenye utafutaji huu.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(p => {
    let stockBadgeClass = 'product-stock-badge';
    let stockText = `${p.stock_quantity} pcs`;
    if (p.stock_quantity <= 0) {
      stockBadgeClass += ' out';
      stockText = 'Imeisha';
    } else if (p.stock_quantity <= p.min_stock_alert) {
      stockBadgeClass += ' low';
      stockText = `${p.stock_quantity} pcs (Chache)`;
    }

    const defaultImg = 'https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80';
    const imgSrc = p.image_url || defaultImg;

    return `
      <div class="product-card" onclick="addToCart(${p.id})">
        <div class="product-image-box">
          <img src="${imgSrc}" alt="${p.name}" loading="lazy" onerror="this.src='${defaultImg}'">
          <span class="product-tag">${p.category} &bull; ${p.gender_age}</span>
          <span class="${stockBadgeClass}">${stockText}</span>
        </div>
        <div class="product-info">
          <div>
            <div class="product-name">${p.name}</div>
            <div class="product-meta">
              <span>Saizi: ${p.size || 'Free'}</span>
              <span>${p.color || ''}</span>
            </div>
          </div>
          <div class="product-price-row">
            <div class="product-price">${formatTZS(p.sell_price)}</div>
            <button class="btn-add-cart" title="Weka Kikapuni" onclick="event.stopPropagation(); addToCart(${p.id})">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Cart Management
window.addToCart = function(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  if (product.stock_quantity <= 0) {
    showToast(`Nguo ya "${product.name}" imeisha stoo!`, 'error');
    return;
  }

  const existing = state.cart.find(item => item.product_id === productId);
  if (existing) {
    if (existing.quantity + 1 > product.stock_quantity) {
      showToast(`Umezidisha idadi iliyopo stoo (${product.stock_quantity} pcs)!`, 'error');
      return;
    }
    existing.quantity += 1;
  } else {
    state.cart.push({
      product_id: product.id,
      name: product.name,
      code: product.code,
      unit_price: product.sell_price,
      max_stock: product.stock_quantity,
      quantity: 1
    });
  }

  showToast(`"${product.name}" imeongezwa kikapuni!`, 'success');
  renderCart();
};

window.updateCartQty = function(productId, delta) {
  const item = state.cart.find(i => i.product_id === productId);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    state.cart = state.cart.filter(i => i.product_id !== productId);
  } else if (newQty > item.max_stock) {
    showToast(`Umezidisha idadi iliyopo stoo (${item.max_stock} pcs)!`, 'error');
    return;
  } else {
    item.quantity = newQty;
  }
  renderCart();
};

window.removeFromCart = function(productId) {
  state.cart = state.cart.filter(i => i.product_id !== productId);
  renderCart();
};

function renderCart() {
  const container = document.getElementById('cartItemsContainer');
  if (!container) return;

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <i class="fa-solid fa-bag-shopping" style="font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--text-dim);"></i>
        <p>Kikapu kiko tupu</p>
        <small>Bofya nguo upande wa kushoto kuiongeza</small>
      </div>
    `;
    document.getElementById('cartSubtotalVal').innerText = formatTZS(0);
    document.getElementById('cartDiscountVal').innerText = '- ' + formatTZS(0);
    document.getElementById('cartNetTotalVal').innerText = formatTZS(0);
    return;
  }

  let subtotal = 0;
  container.innerHTML = state.cart.map(item => {
    const itemTotal = item.unit_price * item.quantity;
    subtotal += itemTotal;

    return `
      <div class="cart-item-row">
        <div class="cart-item-details">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-sub">${formatTZS(item.unit_price)} x ${item.quantity}</div>
        </div>
        <div class="cart-qty-controls">
          <button class="qty-btn" onclick="updateCartQty(${item.product_id}, -1)">-</button>
          <span class="qty-val">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartQty(${item.product_id}, 1)">+</button>
        </div>
        <div class="cart-item-price">${formatTZS(itemTotal)}</div>
        <button class="cart-remove-item" onclick="removeFromCart(${item.product_id})" title="Ondoa">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;
  }).join('');

  const discount = parseFloat(document.getElementById('cartDiscountInput')?.value) || 0;
  const netTotal = Math.max(0, subtotal - discount);

  document.getElementById('cartSubtotalVal').innerText = formatTZS(subtotal);
  document.getElementById('cartDiscountVal').innerText = '- ' + formatTZS(discount);
  document.getElementById('cartNetTotalVal').innerText = formatTZS(netTotal);
}

// Checkout Modal Handling
function openCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  const discount = parseFloat(document.getElementById('cartDiscountInput')?.value) || 0;
  let subtotal = 0;
  state.cart.forEach(i => subtotal += (i.unit_price * i.quantity));
  const netTotal = Math.max(0, subtotal - discount);

  document.getElementById('modalNetTotalVal').innerText = formatTZS(netTotal);

  // Hide all dynamic fields first
  document.getElementById('lipaNambaFields').style.display = 'none';
  document.getElementById('layawayFields').style.display = 'none';
  document.getElementById('creditFields').style.display = 'none';

  let modeLabel = 'Pesa Taslimu (Cash)';
  if (state.selectedPaymentMode === 'lipa_namba') {
    modeLabel = 'Lipa Namba (Tigo / Airtel / M-Pesa)';
    document.getElementById('lipaNambaFields').style.display = 'block';
  } else if (state.selectedPaymentMode === 'layaway') {
    modeLabel = 'Kuwekeza / Weka Akiba Kidogo Kidogo';
    document.getElementById('layawayFields').style.display = 'block';
    document.getElementById('modalLayawayInitialPaid').value = Math.round(netTotal * 0.5); // Default 50% suggestion
  } else if (state.selectedPaymentMode === 'credit') {
    modeLabel = 'Mauzo ya Mkopo (Kulipa kwa Awamu)';
    document.getElementById('creditFields').style.display = 'block';
    // Default due date: 14 days from now
    const d = new Date();
    d.setDate(d.getDate() + 14);
    document.getElementById('modalCreditDueDate').value = d.toISOString().split('T')[0];
  }

  document.getElementById('modalPaymentTypeLabel').innerText = modeLabel;
  modal.classList.add('active');
}

async function handleFinalSaleSubmit() {
  const customerName = document.getElementById('cartCustomerName')?.value || 'Mteja wa Kawaida';
  const customerPhone = document.getElementById('cartCustomerPhone')?.value || '';
  const discount = parseFloat(document.getElementById('cartDiscountInput')?.value) || 0;

  let subtotal = 0;
  state.cart.forEach(i => subtotal += (i.unit_price * i.quantity));
  const netTotal = Math.max(0, subtotal - discount);

  let paymentProvider = 'Pesa Taslimu (Cash)';
  let referenceCode = '';
  let amountPaid = netTotal;
  let dueDate = null;
  let notes = '';

  if (state.selectedPaymentMode === 'lipa_namba') {
    paymentProvider = document.getElementById('modalPaymentProvider').value;
    referenceCode = document.getElementById('modalReferenceCode').value;
  } else if (state.selectedPaymentMode === 'layaway') {
    amountPaid = parseFloat(document.getElementById('modalLayawayInitialPaid').value) || 0;
    notes = document.getElementById('modalLayawayNotes').value || 'Akiba ya awali';
    paymentProvider = 'Kuwekeza (Akiba)';
  } else if (state.selectedPaymentMode === 'credit') {
    amountPaid = parseFloat(document.getElementById('modalCreditInitialPaid').value) || 0;
    dueDate = document.getElementById('modalCreditDueDate').value;
    notes = document.getElementById('modalCreditNotes').value || 'Makubaliano ya Mkopo';
    paymentProvider = 'Mauzo ya Mkopo';
  }

  const payload = {
    customer_name: customerName,
    customer_phone: customerPhone,
    items: state.cart.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price
    })),
    discount,
    payment_type: state.selectedPaymentMode,
    payment_provider: paymentProvider,
    reference_code: referenceCode,
    amount_paid: amountPaid,
    due_date: dueDate,
    notes,
    cashier_name: state.currentUser?.full_name || 'Muuzaji',
    user_id: state.currentUser?.id || null
  };

  try {
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (json.success) {
      showToast('Mauzo yamekamilika kikamilifu!', 'success');
      document.getElementById('checkoutModal').classList.remove('active');

      // Clear cart
      state.cart = [];
      document.getElementById('cartCustomerName').value = '';
      document.getElementById('cartCustomerPhone').value = '';
      document.getElementById('cartDiscountInput').value = '0';
      renderCart();

      // Refresh products & KPIs & Shift
      loadProducts();
      loadSummaryKPIs();
      loadLayaways();
      loadCredits();
      loadCashierShift();

      // Show receipt modal
      openReceiptModal(json.sale, json.items);
    } else {
      showToast(json.message || 'Hitilafu wakati wa kukamilisha mauzo', 'error');
    }
  } catch (err) {
    console.error('Error submitting sale:', err);
    showToast('Hitilafu ya mtandao!', 'error');
  }
}

// Receipt Modal & Thermal Print
function openReceiptModal(sale, items) {
  state.currentReceiptSale = sale;
  state.currentReceiptItems = items || [];

  if (state.settings) {
    if (state.settings.store_name) document.getElementById('recStoreName').innerText = state.settings.store_name;
    if (state.settings.store_tagline) document.getElementById('recStoreTagline').innerText = state.settings.store_tagline;
    if (state.settings.owner_name) {
      const recOwner = document.getElementById('recStoreOwner');
      if (recOwner) recOwner.innerText = 'Mmiliki: ' + state.settings.owner_name;
    }
    if (state.settings.store_phone) document.getElementById('recStorePhone').innerText = 'Simu: ' + state.settings.store_phone;
    if (state.settings.store_location) document.getElementById('recStoreLocation').innerText = state.settings.store_location;
  }

  document.getElementById('recReceiptNo').innerText = sale.receipt_no;
  document.getElementById('recDate').innerText = new Date(sale.created_at || Date.now()).toLocaleString('sw-TZ');
  document.getElementById('recCustomer').innerText = `${sale.customer_name} ${sale.customer_phone ? '(' + sale.customer_phone + ')' : ''}`;
  document.getElementById('recPaymentType').innerText = sale.payment_provider || sale.payment_type;

  const cashierDisplay = sale.cashier_name || state.currentUser?.full_name || 'Staff';
  const recCashierEl = document.getElementById('recCashierName');
  if (recCashierEl) recCashierEl.innerText = cashierDisplay;

  if (sale.reference_code) {
    document.getElementById('recRefCodeRow').style.display = 'block';
    document.getElementById('recRefCode').innerText = sale.reference_code;
  } else {
    document.getElementById('recRefCodeRow').style.display = 'none';
  }

  const itemsBody = document.getElementById('recItemsBody');
  itemsBody.innerHTML = (items || []).map(i => `
    <tr>
      <td>${i.product_name}</td>
      <td style="text-align:center;">${i.quantity}</td>
      <td style="text-align:right;">${(i.unit_price).toLocaleString()}</td>
      <td style="text-align:right;">${(i.subtotal).toLocaleString()}</td>
    </tr>
  `).join('');

  document.getElementById('recSubtotal').innerText = formatTZS(sale.total_amount);
  document.getElementById('recDiscount').innerText = formatTZS(sale.discount);
  document.getElementById('recNetTotal').innerText = formatTZS(sale.net_amount);
  document.getElementById('recAmountPaid').innerText = formatTZS(sale.amount_paid);
  document.getElementById('recBalanceDue').innerText = formatTZS(sale.balance_due);

  document.getElementById('receiptModal').classList.add('active');
}

// ===================================================
// WHATSAPP INTEGRATION HELPERS & HANDLERS
// ===================================================

function formatWhatsAppPhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).trim()
    .replace(/^[oO]/, '0') // badilisha herufi 'O'/ 'o' kuwa tarakimu '0'
    .replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '255' + cleaned.substring(1);
  } else if (cleaned.length === 9 && !cleaned.startsWith('255')) {
    cleaned = '255' + cleaned;
  }
  return cleaned;
}

window.openWhatsAppDispatchModal = function({
  title = 'Tuma Ujumbe kwa WhatsApp',
  customerName = '',
  phone = '',
  message = '',
  saleId = null
}) {
  const modal = document.getElementById('whatsappModal');
  if (!modal) return;

  state.currentWaDispatch = { saleId, customerName, phone, message };

  const titleEl = document.getElementById('waModalTitle');
  const nameEl = document.getElementById('waCustomerName');
  const phoneEl = document.getElementById('waCustomerPhone');
  const statusEl = document.getElementById('waPhoneStatus');
  const msgEl = document.getElementById('waMessageText');

  if (titleEl) titleEl.innerText = title;
  if (nameEl) nameEl.value = customerName || 'Mteja wa Kawaida';
  if (phoneEl) phoneEl.value = phone || '';
  if (msgEl) msgEl.value = message || '';

  if (statusEl) {
    if (!phone) {
      statusEl.innerText = '⚠️ Weka namba hapa';
      statusEl.style.color = 'var(--accent-rose)';
    } else {
      statusEl.innerText = '✓ Namba ipo';
      statusEl.style.color = 'var(--accent-emerald)';
    }
  }

  modal.classList.add('active');
  if (!phone && phoneEl) {
    phoneEl.focus();
  }
};

window.saveWaCustomerPhoneIfChanged = async function() {
  const saleId = state.currentWaDispatch?.saleId;
  const newPhone = document.getElementById('waCustomerPhone')?.value.trim();
  if (saleId && newPhone) {
    try {
      await fetch(`/api/sales/${saleId}/customer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_phone: newPhone })
      });
      // Refresh relevant tables if on screen
      if (typeof loadLayaways === 'function') loadLayaways();
      if (typeof loadCredits === 'function') loadCredits();
    } catch (e) {
      console.error('Hitilafu ya kuhifadhi namba ya mteja:', e);
    }
  }
};

function generateWhatsAppReceiptMessage(sale, items) {
  const storeName = state.settings?.store_name || 'GLOWNEST SMART WEAR';
  const tagline = state.settings?.store_tagline || 'Mitindo na Nguo Bora za Kisasa Kutoka Kariakoo';
  const location = state.settings?.store_location || 'GOLANI KIJIWENI - KIMARA SUKA DSM-TZ';
  const phone = state.settings?.store_phone || '0656392400 / 0685073565';
  const tigoLipa = state.settings?.tigo_lipa_number || '44834912';
  const tigoName = state.settings?.tigo_lipa_name || 'ABISHAI';
  const airtelLipa = state.settings?.airtel_lipa_number || '136541343';
  const airtelName = state.settings?.airtel_lipa_name || 'DORCAS';

  let dateStr = new Date(sale.created_at || Date.now()).toLocaleDateString('sw-TZ', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  let msg = `*${storeName.toUpperCase()}* 🛍️✨\n`;
  msg += `_${tagline}_\n`;
  msg += `📍 ${location}\n`;
  msg += `📞 Simu: ${phone}\n\n`;

  msg += `🧾 *RISITI YA MAUZO:* #${sale.receipt_no}\n`;
  msg += `📅 Tarehe: ${dateStr}\n`;
  msg += `👤 Mteja: *${sale.customer_name || 'Mteja'}*\n`;
  const cashierDisplay = sale.cashier_name || state.currentUser?.full_name || '';
  if (cashierDisplay) {
    msg += `🧑‍💼 Aliyehudumia: *${cashierDisplay}*\n`;
  }
  msg += `💳 Njia ya Malipo: ${sale.payment_provider || sale.payment_type}\n`;
  if (sale.reference_code) {
    msg += `🔢 Msimbo wa Muamala: ${sale.reference_code}\n`;
  }
  msg += `\n─────────────────────\n`;
  msg += `🛒 *BIDHAA ZILIZONUNULIWA:*\n`;

  if (items && items.length > 0) {
    items.forEach(it => {
      msg += `• ${it.quantity}x *${it.product_name}* @ TZS ${(it.unit_price || 0).toLocaleString()} = *TZS ${(it.subtotal || 0).toLocaleString()}*\n`;
    });
  } else {
    msg += `• Nguo za Kisasa Kutoka Kariakoo\n`;
  }

  msg += `─────────────────────\n`;
  msg += `💰 Jumla Ndogo: TZS ${(sale.total_amount || 0).toLocaleString()}\n`;
  if (sale.discount && sale.discount > 0) {
    msg += `🏷️ Punguzo (Discount): - TZS ${(sale.discount).toLocaleString()}\n`;
  }
  msg += `💵 *Jumla Kamili: TZS ${(sale.net_amount || 0).toLocaleString()}*\n`;
  msg += `✅ Kiasi Kilicholipwa: TZS ${(sale.amount_paid || 0).toLocaleString()}\n`;
  if (sale.balance_due && sale.balance_due > 0) {
    msg += `⏳ *Salio / Baki Inayodaiwa: TZS ${(sale.balance_due).toLocaleString()}*\n`;
  } else {
    msg += `🎉 *Hali: Imelipwa Yote (PAID)*\n`;
  }

  msg += `\n📱 *LIPA NAMBA ZETU:*\n`;
  msg += `👉 Tigo Pesa: *${tigoLipa}* (Jina: *${tigoName}*)\n`;
  msg += `👉 Airtel Money: *${airtelLipa}* (Jina: *${airtelName}*)\n\n`;

  msg += `_Asante kwa kuchagua ${storeName}! Nguo zetu zimechaguliwa kwa mikono kutoka masoko makuu ya Kariakoo zikiwa na ubora wa juu._\n`;
  msg += `*Karibu Tena!* 🙏❤️`;

  return msg;
}

window.sendWhatsAppReceipt = function() {
  if (!state.currentReceiptSale) {
    showToast('Hakuna risiti inayofanya kazi sasa!', 'error');
    return;
  }
  const sale = state.currentReceiptSale;
  const items = state.currentReceiptItems || [];
  const msg = generateWhatsAppReceiptMessage(sale, items);

  window.openWhatsAppDispatchModal({
    title: `Risiti ya WhatsApp (#${sale.receipt_no})`,
    customerName: sale.customer_name,
    phone: sale.customer_phone,
    message: msg,
    saleId: sale.id
  });
};

window.sendLayawayReminderWhatsApp = async function(saleId) {
  try {
    const res = await fetch(`/api/sales/${saleId}`);
    const json = await res.json();
    if (!json.success || !json.data?.sale) return showToast('Taarifa za mteja hazijapatikana', 'error');

    const s = json.data.sale;
    const items = json.data.items || [];
    const itemNames = items.map(i => `${i.quantity}x ${i.product_name}`).join(', ') || 'Nguo ulizowekeza';

    const storeName = state.settings?.store_name || 'GLOWNEST SMART WEAR';
    const tigoLipa = state.settings?.tigo_lipa_number || '44834912';
    const tigoName = state.settings?.tigo_lipa_name || 'ABISHAI';
    const airtelLipa = state.settings?.airtel_lipa_number || '136541343';
    const airtelName = state.settings?.airtel_lipa_name || 'DORCAS';

    let msg = `Habari ndugu *${s.customer_name}*, tunakusalimu kutoka *${storeName}* (Kimara Suka). 👗👖✨\n\n`;
    msg += `Tunakushukuru sana kwa kuweka akiba ya nguo zako nasi (Risiti: *#${s.receipt_no}*).\n`;
    msg += `📦 *Nguo Zilizohifadhiwa:* ${itemNames}\n`;
    msg += `Nguo zako zimetunzwa salama kabisa stoo zikisubiri umalizie akiba yako!\n\n`;

    msg += `📊 *MAENDELEO YA MALIPO YAKO:*\n`;
    msg += `• Thamani Kamili: TZS ${(s.net_amount || 0).toLocaleString()}\n`;
    msg += `• Kiasi Ulichoweka Mpaka Sasa: TZS ${(s.amount_paid || 0).toLocaleString()}\n`;
    msg += `• *Baki Iliyobaki: TZS ${(s.balance_due || 0).toLocaleString()}*\n\n`;

    msg += `Unaweza kukamilisha malipo yako kidogo kidogo kwa urahisi kupitia:\n`;
    msg += `👉 Tigo Pesa Lipa: *${tigoLipa}* (${tigoName})\n`;
    msg += `👉 Airtel Money Lipa: *${airtelLipa}* (${airtelName})\n\n`;
    msg += `Ukishatuma salio tafadhali tutumie ujumbe hapa ili tusasishe rekodi yako mara moja.\n`;
    msg += `Asante sana na Karibu sana GLOWNEST! 🙏`;

    window.openWhatsAppDispatchModal({
      title: `Kikumbusho cha Kuwekeza / Akiba (#${s.receipt_no})`,
      customerName: s.customer_name,
      phone: s.customer_phone,
      message: msg,
      saleId: s.id
    });
  } catch (err) {
    console.error('Hitilafu ya kikumbusho cha akiba:', err);
    showToast('Hitilafu ya kupata taarifa za mteja', 'error');
  }
};

window.sendLayawayCompletedWhatsApp = async function(saleId) {
  try {
    const res = await fetch(`/api/sales/${saleId}`);
    const json = await res.json();
    if (!json.success || !json.data?.sale) return;
    const s = json.data.sale;
    const items = json.data.items || [];
    const itemNames = items.map(i => `${i.quantity}x ${i.product_name}`).join(', ') || 'Nguo ulizowekeza';
    const storeName = state.settings?.store_name || 'GLOWNEST SMART WEAR';
    const location = state.settings?.store_location || 'GOLANI KIJIWENI - KIMARA SUKA DSM-TZ';
    const storePhone = state.settings?.store_phone_primary || state.settings?.store_phone || '0656392400 / 0685073565';

    let msg = `Hongera na Shukrani za Dhati Ndugu *${s.customer_name}*! 🎉🛍️✨\n\n`;
    msg += `Taarifa njema kutoka *${storeName}*: Tunapenda kukutaarifu kuwa umekamilisha kikamilifu malipo yote ya akiba yako ya kuwekeza kidogo kidogo (Risiti: *#${s.receipt_no}*).\n\n`;
    msg += `📦 *Bidhaa/Nguo Zako Zilizokamilika:* ${itemNames}\n`;
    msg += `💰 *Jumla Iliyolipwa:* ${formatTZS(s.net_amount || s.amount_paid)} (Salio/Deni Lililobaki: TZS 0)\n\n`;
    msg += `Mzigo wako umepakiwa kwa ueledi na unakusubiri dukani kwetu ukiwa tayari kukabidhiwa!\n\n`;
    msg += `📍 *Fika Dukani Kwetu:* ${location}\n`;
    msg += `📞 *Mawasiliano/Simu:* ${storePhone}\n\n`;
    msg += `Tunakushukuru sana sana kwa uaminifu wako kwetu, na tunakukaribisha kwa furaha kubwa kwa bidhaa zetu nyingine nzuri na za kisasa zaidi tena na tena!\n\n`;
    msg += `Mwenyezi Mungu akubariki sana kwa kutuchagua sisi kuwahudumia kwa bidhaa zetu za mavazi bora! 🙏❤️✨`;

    window.openWhatsAppDispatchModal({
      title: `Shukrani & Taarifa ya Mzigo Uliokamilika (#${s.receipt_no})`,
      customerName: s.customer_name,
      phone: s.customer_phone,
      message: msg,
      saleId: s.id
    });
  } catch (err) {
    showToast('Hitilafu ya kupata taarifa za akiba', 'error');
  }
};

window.sendCreditReminderWhatsApp = async function(saleId) {
  try {
    const res = await fetch(`/api/sales/${saleId}`);
    const json = await res.json();
    if (!json.success || !json.data?.sale) return showToast('Taarifa hazijapatikana', 'error');

    const s = json.data.sale;
    const storeName = state.settings?.store_name || 'GLOWNEST SMART WEAR';
    const tigoLipa = state.settings?.tigo_lipa_number || '44834912';
    const tigoName = state.settings?.tigo_lipa_name || 'ABISHAI';
    const airtelLipa = state.settings?.airtel_lipa_number || '136541343';
    const airtelName = state.settings?.airtel_lipa_name || 'DORCAS';

    let dueNotice = s.due_date ? `Tarehe ya Makubaliano: *${new Date(s.due_date).toLocaleDateString('sw-TZ')}*` : 'Tarehe: Iliyokubaliwa';

    let msg = `Habari ndugu *${s.customer_name}*, tunatumai u mzima wa afya.\n`;
    msg += `Tunawasiliana nawe kutoka *${storeName}* (Kimara Suka). 🛍️\n\n`;
    msg += `Huu ni ukumbusho wa kirafiki kuhusu salio la mauzo ya mkopo wa nguo ulizochukua (Risiti: *#${s.receipt_no}*).\n\n`;
    msg += `📋 *MAELEZO YA DENI:*\n`;
    msg += `• Thamani ya Mzigo: TZS ${(s.net_amount || 0).toLocaleString()}\n`;
    msg += `• Kiasi Ulicholipa Awali: TZS ${(s.amount_paid || 0).toLocaleString()}\n`;
    msg += `• *Deni Lililobaki: TZS ${(s.balance_due || 0).toLocaleString()}*\n`;
    msg += `• ${dueNotice}\n\n`;

    msg += `Tafadhali kamilisha rejesho lako kupitia Lipa Namba zetu:\n`;
    msg += `👉 Tigo Pesa Lipa: *${tigoLipa}* (${tigoName})\n`;
    msg += `👉 Airtel Money Lipa: *${airtelLipa}* (${airtelName})\n\n`;
    msg += `Tujulishe ukishafanya muamala ili tukurekebishie risiti yako mara moja. Asante sana kwa ushirikiano wako mzuri! 🙏`;

    window.openWhatsAppDispatchModal({
      title: `Kikumbusho cha Mkopo (#${s.receipt_no})`,
      customerName: s.customer_name,
      phone: s.customer_phone,
      message: msg,
      saleId: s.id
    });
  } catch (err) {
    showToast('Hitilafu ya kupata taarifa ya mkopo', 'error');
  }
};

window.sendPastReceiptWhatsApp = async function(receiptNo) {
  try {
    const res = await fetch(`/api/sales/${receiptNo}`);
    const json = await res.json();
    if (!json.success || !json.data?.sale) return showToast('Risiti haijapatikana', 'error');

    state.currentReceiptSale = json.data.sale;
    state.currentReceiptItems = json.data.items || [];
    window.sendWhatsAppReceipt();
  } catch (err) {
    showToast('Hitilafu ya kupata risiti!', 'error');
  }
};


// ===================================================
// 5. INVENTORY & PURCHASES (STOO & MANUNUZI)
// ===================================================

function renderInventoryTable() {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;

  const searchKeyword = (document.getElementById('inventorySearchInput')?.value || '').toLowerCase().trim();

  const filtered = state.products.filter(p => {
    return !searchKeyword ||
      p.name.toLowerCase().includes(searchKeyword) ||
      p.code.toLowerCase().includes(searchKeyword) ||
      p.category.toLowerCase().includes(searchKeyword);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color: var(--text-dim);">Hakuna nguo zilizopatikana</td></tr>`;
    return;
  }

  const isAdmin = state.currentUser?.role === 'admin';

  tbody.innerHTML = filtered.map(p => {
    let statusBadge = '<span class="badge badge-success">Ipo Stoo</span>';
    if (p.stock_quantity <= 0) {
      statusBadge = '<span class="badge badge-danger">Imeisha</span>';
    } else if (p.stock_quantity <= p.min_stock_alert) {
      statusBadge = '<span class="badge badge-warning">Inakaribia Kuisha</span>';
    }

    const defaultImg = 'https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80';
    const imgSrc = p.image_url || defaultImg;

    return `
      <tr>
        <td><strong>${p.code}</strong></td>
        <td>
          <div style="display:flex; align-items:center; gap: 8px;">
            <img src="${imgSrc}" style="width:36px; height:36px; border-radius:6px; object-fit:cover;" onerror="this.src='${defaultImg}'">
            <span>${p.name}</span>
          </div>
        </td>
        <td><span class="badge badge-info">${p.category}</span> &bull; ${p.gender_age}</td>
        <td>
          <div>${p.size || '-'} / ${p.color || '-'}</div>
          ${(() => {
            if (!p.variants_json) return '';
            try {
              const vars = JSON.parse(p.variants_json);
              if (!vars || !vars.length) return '';
              return `<div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:4px;">
                ${vars.map(v => `<span class="badge badge-info" style="font-size:0.65rem; padding:1px 5px;">${v.size}: ${v.quantity}</span>`).join('')}
              </div>`;
            } catch(e) { return ''; }
          })()}
        </td>
        <td class="admin-only" style="color: var(--text-muted);">${formatTZS(p.buy_price)}</td>
        <td style="color: var(--accent-gold); font-weight:700;">${formatTZS(p.sell_price)}</td>
        <td><strong>${p.stock_quantity}</strong> pcs</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex; gap: 4px; flex-wrap: wrap;">
            ${isAdmin ? `
              <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.75rem; border-color: var(--accent-gold); color: var(--accent-gold);" onclick="openEditProductModal(${p.id})" title="Hariri Jina, Bei na Taarifa">
                <i class="fa-solid fa-pen-to-square"></i> Hariri
              </button>
              <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="openRestockForProduct(${p.id})" title="Ongeza Mzigo Stoo">
                <i class="fa-solid fa-truck-ramp-box"></i> Ongeza
              </button>
              <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.75rem; border-color: var(--accent-purple); color: var(--accent-purple);" onclick="openVariantsModal(${p.id})" title="Mgawanyo wa Saizi na Rangi">
                <i class="fa-solid fa-layer-group"></i> Saizi
              </button>
            ` : ''}
            <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.75rem; border-color: var(--accent-cyan); color: var(--accent-cyan);" onclick="openBarcodeModal(${p.id})" title="Tengeneza Lebo/Barcode">
              <i class="fa-solid fa-barcode"></i> Lebo
            </button>
            ${isAdmin ? `
              <button class="cart-remove-item" onclick="deleteProduct(${p.id})" title="Futa">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.openEditProductModal = function(productId) {
  const p = state.products.find(item => item.id === productId);
  if (!p) return;

  document.getElementById('edit_product_id').value = p.id;
  document.getElementById('edit_code').value = p.code || '';
  document.getElementById('edit_name').value = p.name || '';
  document.getElementById('edit_category').value = p.category || 'Nyinginezo';
  document.getElementById('edit_gender_age').value = p.gender_age || 'Unisex';
  document.getElementById('edit_size').value = p.size || '';
  document.getElementById('edit_color').value = p.color || '';
  document.getElementById('edit_buy_price').value = p.buy_price;
  document.getElementById('edit_sell_price').value = p.sell_price;
  document.getElementById('edit_stock_quantity').value = p.stock_quantity;
  document.getElementById('edit_min_stock_alert').value = p.min_stock_alert !== undefined ? p.min_stock_alert : 3;
  document.getElementById('edit_image_url_manual').value = p.image_url || '';

  // Setup preview for existing image
  const imgInput = document.getElementById('editProductImageInput');
  if (imgInput) imgInput.value = '';
  const previewImg = document.getElementById('editProductPreviewImg');
  const previewContainer = document.getElementById('editProductPreviewContainer');
  const uploadPrompt = document.getElementById('editProductUploadPrompt');
  const fileNameEl = document.getElementById('editProductFileName');

  if (p.image_url) {
    if (previewImg) previewImg.src = p.image_url;
    if (previewContainer) previewContainer.style.display = 'flex';
    if (uploadPrompt) uploadPrompt.style.display = 'none';
    if (fileNameEl) fileNameEl.innerText = p.image_url.split('/').pop() || 'Picha ya nguo';
  } else {
    if (previewContainer) previewContainer.style.display = 'none';
    if (uploadPrompt) uploadPrompt.style.display = 'flex';
  }

  document.getElementById('editProductModal').classList.add('active');
};

window.openBarcodeModal = function(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  if (state.settings && state.settings.store_name) {
    document.getElementById('tagStoreName').innerText = state.settings.store_name;
  }
  if (state.settings && state.settings.store_location) {
    document.getElementById('tagLocation').innerText = state.settings.store_location;
  }
  if (state.settings && state.settings.store_phone_primary) {
    document.getElementById('tagPhone').innerText = state.settings.store_phone_primary;
  }

  document.getElementById('tagProductName').innerText = product.name;
  document.getElementById('tagSize').innerText = 'Saizi: ' + (product.size || 'Free');
  document.getElementById('tagColor').innerText = product.color || 'Rangi Zote';
  document.getElementById('tagPrice').innerText = formatTZS(product.sell_price);

  // Render Barcode via JsBarcode
  try {
    if (window.JsBarcode) {
      JsBarcode("#barcodeSvg", product.code, {
        format: "CODE128",
        width: 1.8,
        height: 45,
        displayValue: true,
        fontSize: 13,
        font: "monospace",
        lineColor: "#000000",
        margin: 4
      });
    }
  } catch (err) {
    console.error('JsBarcode error:', err);
  }

  document.getElementById('barcodeModal').classList.add('active');
};

window.openVariantsModal = function(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  document.getElementById('varProductId').value = product.id;
  document.getElementById('varProdName').innerText = `${product.name} (${product.code})`;
  document.getElementById('varProdMeta').innerText = `Kategoria: ${product.category} | Stoo ya Sasa: ${product.stock_quantity} pcs`;

  const container = document.getElementById('variantRowsContainer');
  container.innerHTML = '';

  let variants = [];
  if (product.variants_json) {
    try {
      variants = JSON.parse(product.variants_json);
    } catch(e) {
      variants = [];
    }
  }

  if (!variants || variants.length === 0) {
    const rawSizes = (product.size || 'Free').split(',').map(s => s.trim()).filter(Boolean);
    const defaultQty = Math.floor(product.stock_quantity / Math.max(1, rawSizes.length));
    let remainder = product.stock_quantity % Math.max(1, rawSizes.length);

    variants = rawSizes.map((sz, idx) => ({
      size: sz,
      color: product.color || 'Rangi Zote',
      quantity: defaultQty + (idx === 0 ? remainder : 0)
    }));
  }

  variants.forEach(v => appendVariantRow(v.size, v.color, v.quantity));
  recalculateVariantTotal();
  document.getElementById('variantsModal').classList.add('active');
};

function appendVariantRow(size = '', color = '', quantity = 1) {
  const container = document.getElementById('variantRowsContainer');
  const row = document.createElement('div');
  row.className = 'variant-row-item';
  row.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 90px 32px; gap: 6px; align-items: center; background: rgba(255,255,255,0.03); padding: 4px 6px; border-radius: 6px;';

  row.innerHTML = `
    <input type="text" class="form-control var-size-input" value="${size}" placeholder="Saizi (mf: 32, M)" style="padding: 5px 8px; font-size: 0.8rem;" required>
    <input type="text" class="form-control var-color-input" value="${color}" placeholder="Rangi (mf: Black)" style="padding: 5px 8px; font-size: 0.8rem;">
    <input type="number" class="form-control var-qty-input" value="${quantity}" min="0" placeholder="Pcs" style="padding: 5px 8px; font-size: 0.8rem;" required>
    <button type="button" class="cart-remove-item" onclick="this.closest('.variant-row-item').remove(); recalculateVariantTotal();" title="Ondoa">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  row.querySelector('.var-qty-input').addEventListener('input', recalculateVariantTotal);
  container.appendChild(row);
}

function recalculateVariantTotal() {
  const qtyInputs = document.querySelectorAll('.var-qty-input');
  let total = 0;
  qtyInputs.forEach(input => {
    total += parseInt(input.value) || 0;
  });
  const totalEl = document.getElementById('varTotalCalculatedStock');
  if (totalEl) totalEl.innerText = `${total} pcs`;
}

function populateRestockProductOptions() {
  const select = document.getElementById('restockProductSelect');
  if (!select) return;
  select.innerHTML = state.products.map(p => `
    <option value="${p.id}">${p.name} (${p.code}) - Ipo: ${p.stock_quantity} pcs</option>
  `).join('');
}

window.openRestockForProduct = function(productId) {
  const select = document.getElementById('restockProductSelect');
  if (select) select.value = productId;
  document.getElementById('restockModal').classList.add('active');
};

window.deleteProduct = async function(productId) {
  if (!confirm('Je, una uhakika unataka kufuta nguo hii kwenye stoo?')) return;
  try {
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Bidhaa imefutwa!', 'success');
      loadProducts();
      loadSummaryKPIs();
    }
  } catch (err) {
    showToast('Hitilafu wakati wa kufuta!', 'error');
  }
};

async function loadPurchases() {
  try {
    const res = await fetch('/api/purchases');
    const json = await res.json();
    if (json.success) {
      const tbody = document.getElementById('purchasesTableBody');
      if (!tbody) return;

      if (json.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--text-dim);">Hakuna kumbukumbu za manunuzi</td></tr>`;
        return;
      }

      tbody.innerHTML = json.data.map(p => `
        <tr>
          <td>${new Date(p.purchase_date).toLocaleDateString('sw-TZ')}</td>
          <td><strong>${p.product_name || 'Nguo'}</strong> <small>(${p.product_code || ''})</small></td>
          <td>${p.supplier_name || 'Kariakoo Wholesaler'}</td>
          <td><strong>${p.quantity}</strong> pcs</td>
          <td>${formatTZS(p.unit_cost)}</td>
          <td style="color: var(--accent-gold); font-weight:700;">${formatTZS(p.total_cost)}</td>
          <td>${p.notes || '-'}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading purchases:', err);
  }
}

// ===================================================
// 6. LAYAWAY (KUWEKEZA / AKIBA KIDOGO KIDOGO)
// ===================================================

async function loadLayaways() {
  try {
    const res = await fetch('/api/sales?payment_type=layaway');
    const json = await res.json();
    if (json.success) {
      const tbody = document.getElementById('layawayTableBody');
      if (!tbody) return;

      const searchKeyword = (document.getElementById('layawaySearchInput')?.value || '').toLowerCase().trim();
      const filtered = json.data.filter(s => {
        return !searchKeyword ||
          s.receipt_no.toLowerCase().includes(searchKeyword) ||
          s.customer_name.toLowerCase().includes(searchKeyword) ||
          (s.customer_phone && s.customer_phone.includes(searchKeyword));
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 25px; color: var(--text-dim);">Hakuna wateja wanaoweka akiba kwa sasa.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map(s => {
        const percent = Math.min(100, Math.round((s.amount_paid / s.net_amount) * 100)) || 0;
        let statusBadge = '<span class="badge badge-purple">Inawekezwa</span>';
        if (s.status === 'completed' || s.balance_due <= 0) {
          statusBadge = '<span class="badge badge-success">Imekamilika / Tayari Kukabidhiwa</span>';
        }

        return `
          <tr>
            <td><strong>${s.receipt_no}</strong></td>
            <td>${new Date(s.created_at).toLocaleDateString('sw-TZ')}</td>
            <td>
              <strong>${s.customer_name}</strong><br>
              <small style="color: var(--text-muted);"><i class="fa-solid fa-phone"></i> ${s.customer_phone || 'Hana namba'}</small>
            </td>
            <td>${formatTZS(s.net_amount)}</td>
            <td style="color: var(--accent-emerald); font-weight:700;">${formatTZS(s.amount_paid)}</td>
            <td style="color: var(--accent-rose); font-weight:700;">${formatTZS(s.balance_due)}</td>
            <td style="min-width: 140px;">
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:2px;">
                <span>${percent}%</span>
              </div>
              <div style="background: rgba(255,255,255,0.1); height: 6px; border-radius: 3px; overflow:hidden;">
                <div style="background: var(--primary); height: 100%; width: ${percent}%;"></div>
              </div>
            </td>
            <td>${statusBadge}</td>
            <td>
              <div style="display:flex; gap: 4px; flex-wrap: wrap;">
                ${s.balance_due > 0 ? `
                  <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="openInstallmentModal(${s.id}, '${s.customer_name}', '${s.receipt_no}', ${s.balance_due})">
                    <i class="fa-solid fa-plus"></i> Pokea Awamu
                  </button>
                  <button class="btn-icon-wa" onclick="sendLayawayReminderWhatsApp(${s.id})" title="Kumbusha Salio kwa WhatsApp">
                    <i class="fa-brands fa-whatsapp"></i> Kumbusha
                  </button>
                ` : `
                  <button class="btn-secondary" style="border-color: var(--accent-emerald); color: var(--accent-emerald); padding: 4px 8px; font-size: 0.75rem;" onclick="deliverLayawayItem(${s.id})">
                    <i class="fa-solid fa-circle-check"></i> Kabidhi
                  </button>
                  <button class="btn-icon-wa" onclick="sendLayawayCompletedWhatsApp(${s.id})" title="Taarifu kwa WhatsApp kuwa Mzigo Upo Tayari">
                    <i class="fa-brands fa-whatsapp"></i> Taarifu Mzigo
                  </button>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error loading layaways:', err);
  }
}

window.deliverLayawayItem = async function(saleId) {
  if (!confirm('Je, umeshampatia mteja nguo zake zote?')) return;
  try {
    const res = await fetch(`/api/sales/${saleId}/deliver-layaway`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast('Nguo zimekabidhiwa kwa mteja kikamilifu!', 'success');
      loadLayaways();
      loadSummaryKPIs();
    }
  } catch (err) {
    showToast('Hitilafu!', 'error');
  }
};

// ===================================================
// 7. CREDIT (MAUZO YA MKOPO NA MADENI)
// ===================================================

async function loadCredits() {
  try {
    const res = await fetch('/api/sales?payment_type=credit');
    const json = await res.json();
    if (json.success) {
      const tbody = document.getElementById('creditTableBody');
      if (!tbody) return;

      const searchKeyword = (document.getElementById('creditSearchInput')?.value || '').toLowerCase().trim();
      const filtered = json.data.filter(s => {
        return !searchKeyword ||
          s.receipt_no.toLowerCase().includes(searchKeyword) ||
          s.customer_name.toLowerCase().includes(searchKeyword) ||
          (s.customer_phone && s.customer_phone.includes(searchKeyword));
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 25px; color: var(--text-dim);">Hakuna wateja wenye madeni ya mikopo kwa sasa.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map(s => {
        let statusBadge = '<span class="badge badge-warning">Deni Linalipwa</span>';
        if (s.status === 'completed' || s.balance_due <= 0) {
          statusBadge = '<span class="badge badge-success">Deni Limelipwa</span>';
        }

        const isOverdue = s.due_date && new Date(s.due_date) < new Date() && s.balance_due > 0;
        if (isOverdue) {
          statusBadge = '<span class="badge badge-danger">LIMECHELEWA (Overdue)</span>';
        }

        return `
          <tr>
            <td><strong>${s.receipt_no}</strong></td>
            <td>${new Date(s.created_at).toLocaleDateString('sw-TZ')}</td>
            <td>${s.due_date ? new Date(s.due_date).toLocaleDateString('sw-TZ') : 'Haijapangwa'}</td>
            <td>
              <strong>${s.customer_name}</strong><br>
              <small style="color: var(--text-muted);"><i class="fa-solid fa-phone"></i> ${s.customer_phone || 'Hana namba'}</small>
            </td>
            <td>${formatTZS(s.net_amount)}</td>
            <td style="color: var(--accent-emerald); font-weight:700;">${formatTZS(s.amount_paid)}</td>
            <td style="color: var(--accent-rose); font-weight:700;">${formatTZS(s.balance_due)}</td>
            <td>${statusBadge}</td>
            <td>
              <div style="display:flex; gap: 4px; flex-wrap: wrap;">
                ${s.balance_due > 0 ? `
                  <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="openInstallmentModal(${s.id}, '${s.customer_name}', '${s.receipt_no}', ${s.balance_due})">
                    <i class="fa-solid fa-hand-holding-dollar"></i> Pokea Rejesho
                  </button>
                  <button class="btn-icon-wa" onclick="sendCreditReminderWhatsApp(${s.id})" title="Kumbusha Deni kwa WhatsApp">
                    <i class="fa-brands fa-whatsapp"></i> Kumbusha
                  </button>
                ` : `
                  <span style="color: var(--accent-emerald); font-size: 0.8rem;"><i class="fa-solid fa-check-circle"></i> Limelipwa</span>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error loading credits:', err);
  }
}

// Open Installment Modal for both Layaway & Credit
window.openInstallmentModal = function(saleId, customerName, receiptNo, balanceDue) {
  document.getElementById('instSaleId').value = saleId;
  document.getElementById('instCustomerName').innerText = customerName;
  document.getElementById('instReceiptNo').innerText = receiptNo;
  document.getElementById('instBalanceDueVal').innerText = formatTZS(balanceDue);
  document.getElementById('instAmount').value = '';
  document.getElementById('instAmount').max = balanceDue;
  document.getElementById('installmentModal').classList.add('active');
};

// ===================================================
// 7.5. EXPENSES (MATUMIZI YA DUKA)
// ===================================================

async function loadExpenses() {
  try {
    const res = await fetch('/api/expenses');
    const json = await res.json();
    if (json.success) {
      state.expenses = json.data;
      renderExpensesTable();
    }
  } catch (err) {
    console.error('Error loading expenses:', err);
  }
}

function renderExpensesTable() {
  const tbody = document.getElementById('expensesTableBody');
  if (!tbody) return;

  const searchKeyword = (document.getElementById('expenseSearchInput')?.value || '').toLowerCase().trim();
  const catFilter = document.getElementById('expenseCategoryFilter')?.value || 'all';

  const filtered = (state.expenses || []).filter(e => {
    const matchCat = catFilter === 'all' || e.category === catFilter;
    const matchSearch = !searchKeyword ||
      e.title.toLowerCase().includes(searchKeyword) ||
      e.category.toLowerCase().includes(searchKeyword) ||
      (e.notes && e.notes.toLowerCase().includes(searchKeyword));
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 25px; color: var(--text-dim);">Hakuna rekodi za matumizi zilizopatikana.</td></tr>`;
    return;
  }

  const isAdmin = state.currentUser?.role === 'admin';

  tbody.innerHTML = filtered.map(e => `
    <tr>
      <td>${new Date(e.expense_date).toLocaleString('sw-TZ')}</td>
      <td><strong>${e.title}</strong></td>
      <td><span class="badge badge-warning">${e.category}</span></td>
      <td><span class="badge badge-info">${e.payment_type}</span></td>
      <td style="color: var(--accent-rose); font-weight:700;">- ${formatTZS(e.amount)}</td>
      <td>${e.notes || '-'}</td>
      <td>
        ${isAdmin ? `
          <button class="cart-remove-item" onclick="deleteExpense(${e.id})" title="Futa Matumizi">
            <i class="fa-solid fa-trash"></i>
          </button>
        ` : `<span style="color: var(--text-dim); font-size: 0.75rem;" title="Mamlaka ya Mmiliki tu"><i class="fa-solid fa-lock"></i></span>`}
      </td>
    </tr>
  `).join('');
}

window.deleteExpense = async function(expenseId) {
  if (state.currentUser?.role !== 'admin') {
    showToast('Huna mamlaka ya kufuta matumizi! Ni Mmiliki/Admin tu anayeruhusiwa.', 'error');
    return;
  }
  if (!confirm('Je, una uhakika unataka kufuta rekodi hii ya matumizi?')) return;
  try {
    const res = await fetch(`/api/expenses/${expenseId}`, { 
      method: 'DELETE',
      headers: { 'x-user-role': state.currentUser?.role || '' }
    });
    const json = await res.json();
    if (json.success) {
      showToast('Matumizi yamefutwa!', 'success');
      loadExpenses();
      loadSummaryKPIs();
    }
  } catch (err) {
    showToast('Hitilafu wakati wa kufuta!', 'error');
  }
};

// ===================================================
// 8. REPORTS & CHARTS (GRAFU NA TAKWIMU ZA BIASHARA)
// ===================================================

async function loadCharts(period = '7days') {
  try {
    state.activeSalesPeriod = period;

    // Trend Data
    const resTrends = await fetch(`/api/reports/trends?period=${period}`);
    const jsonTrends = await resTrends.json();

    // Category Distribution Data
    const resCats = await fetch('/api/reports/categories');
    const jsonCats = await resCats.json();

    if (jsonTrends.success) {
      renderTrendChart(jsonTrends.data);
    }
    if (jsonCats.success) {
      renderCategoryChart(jsonCats.data);
    }
  } catch (err) {
    console.error('Error loading charts:', err);
  }
}

function renderTrendChart(data) {
  const ctx = document.getElementById('salesTrendChart')?.getContext('2d');
  if (!ctx) return;

  const labels = data.map(d => d.label);
  const revenues = data.map(d => d.revenue);
  const profits = data.map(d => d.profit);

  if (state.trendChart) {
    state.trendChart.destroy();
  }

  state.trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['Hakuna Data'],
      datasets: [
        {
          label: 'Mapato ya Mauzo (Revenue TZS)',
          data: revenues.length ? revenues : [0],
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#f59e0b'
        },
        {
          label: 'Faida Halisi (Net Profit TZS)',
          data: profits.length ? profits : [0],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#10b981'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 12 } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: {
            color: '#64748b',
            callback: (val) => (val >= 1000 ? (val / 1000) + 'k' : val)
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

function renderCategoryChart(data) {
  const ctx = document.getElementById('categoryDistributionChart')?.getContext('2d');
  if (!ctx) return;

  const labels = data.map(d => d.category);
  const revenues = data.map(d => d.total_revenue);

  if (state.categoryChart) {
    state.categoryChart.destroy();
  }

  state.categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['Bado Mauzo'],
      datasets: [{
        data: revenues.length ? revenues : [1],
        backgroundColor: [
          '#f59e0b', '#06b6d4', '#10b981', '#8b5cf6', '#f43f5e', '#eab308', '#38bdf8'
        ],
        borderWidth: 2,
        borderColor: '#0f1624'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { size: 11 } }
        }
      }
    }
  });
}

async function loadSalesReport() {
  try {
    const res = await fetch('/api/sales');
    const json = await res.json();
    if (json.success) {
      const tbody = document.getElementById('salesReportTableBody');
      if (!tbody) return;

      const dateFilter = document.getElementById('reportDateFilter')?.value;
      const filtered = json.data.filter(s => {
        if (!dateFilter) return true;
        return s.created_at.startsWith(dateFilter);
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 25px; color: var(--text-dim);">Hakuna mauzo yaliyopatikana.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map(s => {
        let badge = '<span class="badge badge-success">Imekamilika</span>';
        if (s.status === 'pending_layaway') badge = '<span class="badge badge-purple">Akiba Inaendelea</span>';
        if (s.status === 'credit_active') badge = '<span class="badge badge-warning">Mkopo Unalipwa</span>';

        return `
          <tr>
            <td><strong>${s.receipt_no}</strong></td>
            <td>${new Date(s.created_at).toLocaleString('sw-TZ')}</td>
            <td>${s.customer_name} ${s.customer_phone ? '(' + s.customer_phone + ')' : ''}</td>
            <td><span class="badge badge-info">${s.payment_provider || s.payment_type}</span></td>
            <td><strong>${formatTZS(s.net_amount)}</strong></td>
            <td style="color: var(--accent-emerald);">${formatTZS(s.amount_paid)}</td>
            <td style="color: var(--accent-rose);">${formatTZS(s.balance_due)}</td>
            <td>${badge}</td>
            <td>
              <div style="display:flex; gap: 4px;">
                <button class="btn-secondary" style="padding: 3px 8px; font-size: 0.72rem;" onclick="viewSingleReceipt('${s.receipt_no}')">
                  <i class="fa-solid fa-receipt"></i> Risiti
                </button>
                <button class="btn-icon-wa" style="padding: 3px 6px; font-size: 0.72rem;" onclick="sendPastReceiptWhatsApp('${s.receipt_no}')" title="Tuma Risiti kwa WhatsApp">
                  <i class="fa-brands fa-whatsapp"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error loading sales report:', err);
  }
}

window.viewSingleReceipt = async function(receiptNo) {
  try {
    const res = await fetch(`/api/sales/${receiptNo}`);
    const json = await res.json();
    if (json.success) {
      openReceiptModal(json.data.sale, json.data.items);
    }
  } catch (err) {
    showToast('Hitilafu ya kupata risiti!', 'error');
  }
};

// Export to CSV
function exportSalesToCSV() {
  fetch('/api/sales')
    .then(res => res.json())
    .then(json => {
      if (!json.success || json.data.length === 0) {
        showToast('Hakuna taarifa za kupakua', 'error');
        return;
      }
      const rows = [
        ['Namba ya Risiti', 'Tarehe', 'Mteja', 'Simu', 'Njia ya Malipo', 'Jumla Kuu', 'Punguzo', 'Kiasi Kilicholipwa', 'Baki', 'Hali']
      ];
      json.data.forEach(s => {
        rows.push([
          s.receipt_no,
          s.created_at,
          `"${s.customer_name}"`,
          s.customer_phone || '',
          s.payment_provider || s.payment_type,
          s.net_amount,
          s.discount,
          s.amount_paid,
          s.balance_due,
          s.status
        ]);
      });
      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `GLOWNEST_Ripoti_Mauzo_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Ripoti ya CSV imepakuliwa vizuri!', 'success');
    });
}

// ===================================================
// 9. FORMS & MODALS INITIALIZATION
// ===================================================

function initModals() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    });
  });

  document.getElementById('btnOpenAddProductModal').addEventListener('click', () => {
    document.getElementById('addProductModal').classList.add('active');
  });

  document.getElementById('btnOpenRestockModal').addEventListener('click', () => {
    populateRestockProductOptions();
    document.getElementById('restockModal').classList.add('active');
  });

  // Report Period buttons
  document.querySelectorAll('#reports-view .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#reports-view .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const period = btn.getAttribute('data-period');
      loadCharts(period);
    });
  });

  // Report Date Filter
  document.getElementById('reportDateFilter')?.addEventListener('change', loadSalesReport);
  document.getElementById('inventorySearchInput')?.addEventListener('input', renderInventoryTable);
  document.getElementById('layawaySearchInput')?.addEventListener('input', loadLayaways);
  document.getElementById('creditSearchInput')?.addEventListener('input', loadCredits);
  document.getElementById('btnExportCSV')?.addEventListener('click', exportSalesToCSV);

  // Open Add Order Modal
  document.getElementById('btnOpenAddOrderModal')?.addEventListener('click', () => {
    const today = new Date();
    const defaultTarget = new Date(today.getTime() + 3 * 86400000).toISOString().split('T')[0];
    const targetInput = document.getElementById('order_target_date');
    if (targetInput) targetInput.value = defaultTarget;
    clearAddOrderImage();
    document.getElementById('addOrderModal').classList.add('active');
  });

  // Refresh Orders Button
  document.getElementById('btnRefreshOrders')?.addEventListener('click', () => {
    loadOrders();
    showToast('Oda za wateja zimeburudishwa!', 'success');
  });

  // Orders Search Input
  document.getElementById('ordersSearchInput')?.addEventListener('input', (e) => {
    state.ordersSearchKeyword = e.target.value;
    renderOrdersTable();
  });

  // Orders Status Pills
  document.querySelectorAll('#ordersStatusPills .order-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ordersStatusPills .order-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeOrderStatus = btn.getAttribute('data-status');
      renderOrdersTable();
    });
  });

  // Orders Target Date Filter
  document.getElementById('ordersTargetDateFilter')?.addEventListener('change', (e) => {
    state.ordersTargetDate = e.target.value;
    renderOrdersTable();
  });

  document.getElementById('btnClearOrdersDate')?.addEventListener('click', () => {
    const filterInput = document.getElementById('ordersTargetDateFilter');
    if (filterInput) filterInput.value = '';
    state.ordersTargetDate = '';
    renderOrdersTable();
  });

  // Print Order Receipt Button
  document.getElementById('btnPrintOrderSlipBtn')?.addEventListener('click', () => {
    window.print();
  });

  // Send WhatsApp Order Slip Button
  document.getElementById('btnSendWhatsAppOrderSlip')?.addEventListener('click', () => {
    if (!state.currentReceiptOrder) return;
    const o = state.currentReceiptOrder;
    const cleanPhone = formatWhatsAppPhone(o.customer_phone);
    if (!cleanPhone) {
      showToast('Namba ya simu ya mteja haijajazwa vizuri!', 'warning');
      return;
    }
    const waMsg = encodeURIComponent(
      `Habari ${o.customer_name},\n` +
      `Hii ni stakabadhi ya oda yako kutoka *${state.settings.store_name || 'GLOWNEST Smart Wear'}*:\n\n` +
      `🧾 Namba ya Oda: *#${o.order_no}*\n` +
      `👗 Nguo Iliyoagizwa: *${o.clothing_item}*\n` +
      `📅 Tarehe ya Ahadi: *${o.target_date}*\n` +
      `💰 Bei Kamili: *${formatTZS(o.estimated_price)}*\n` +
      `💵 Advance Uliyolipa: *${formatTZS(o.advance_paid)}*\n` +
      `⚠️ Baki Inayodaiwa: *${formatTZS(o.balance_due)}*\n\n` +
      `Tafadhali tunza ujumbe huu wakati wa kuchukua nguo yako. Asante sana!\n` +
      `Tupo: ${state.settings.store_location || 'Kimara Suka'}`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${waMsg}`, '_blank');
  });

  // Print Receipt
  document.getElementById('btnPrintReceiptBtn')?.addEventListener('click', () => {
    window.print();
  });

  // WhatsApp Receipt
  document.getElementById('btnSendWhatsAppReceipt')?.addEventListener('click', () => {
    if (window.sendWhatsAppReceipt) window.sendWhatsAppReceipt();
  });

  // WhatsApp Dispatch Modal Action Listeners
  document.getElementById('waOpenWebBtn')?.addEventListener('click', async () => {
    const rawPhone = document.getElementById('waCustomerPhone')?.value || '';
    const phone = formatWhatsAppPhone(rawPhone);
    const msg = document.getElementById('waMessageText')?.value || '';
    if (!phone) {
      showToast('Tafadhali weka namba ya simu ya mteja kwanza!', 'warning');
      document.getElementById('waCustomerPhone')?.focus();
      return;
    }
    await window.saveWaCustomerPhoneIfChanged();
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    showToast('WhatsApp Web inafunguliwa...', 'success');
  });

  document.getElementById('waOpenAppBtn')?.addEventListener('click', async () => {
    const rawPhone = document.getElementById('waCustomerPhone')?.value || '';
    const phone = formatWhatsAppPhone(rawPhone);
    const msg = document.getElementById('waMessageText')?.value || '';
    if (!phone) {
      showToast('Tafadhali weka namba ya simu ya mteja kwanza!', 'warning');
      document.getElementById('waCustomerPhone')?.focus();
      return;
    }
    await window.saveWaCustomerPhoneIfChanged();
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    showToast('WhatsApp inafunguliwa...', 'success');
  });

  document.getElementById('waCopyMsgBtn')?.addEventListener('click', async () => {
    const msg = document.getElementById('waMessageText')?.value || '';
    try {
      await navigator.clipboard.writeText(msg);
      showToast('Ujumbe umenakiliwa! Bandika (Paste) kwenye WhatsApp.', 'success');
    } catch (e) {
      const ta = document.getElementById('waMessageText');
      if (ta) {
        ta.select();
        document.execCommand('copy');
        showToast('Ujumbe umenakiliwa vizuri!', 'success');
      }
    }
  });

  document.getElementById('waSavePhoneBtn')?.addEventListener('click', async () => {
    const rawPhone = document.getElementById('waCustomerPhone')?.value || '';
    const phone = formatWhatsAppPhone(rawPhone);
    if (!phone) {
      showToast('Weka namba sahihi ya simu ya mteja kwanza!', 'warning');
      return;
    }
    await window.saveWaCustomerPhoneIfChanged();
    showToast('Namba ya mteja imehifadhiwa kikamilifu!', 'success');
    const statusEl = document.getElementById('waPhoneStatus');
    if (statusEl) {
      statusEl.innerText = '✓ Imehifadhiwa';
      statusEl.style.color = 'var(--accent-emerald)';
    }
  });

  // Expenses Modal & Filters
  document.getElementById('btnOpenAddExpenseModal')?.addEventListener('click', () => {
    document.getElementById('addExpenseModal').classList.add('active');
  });
  document.getElementById('expenseSearchInput')?.addEventListener('input', renderExpensesTable);
  document.getElementById('expenseCategoryFilter')?.addEventListener('change', renderExpensesTable);

  // Print Barcode Hangtag
  document.getElementById('btnPrintBarcodeBtn')?.addEventListener('click', () => {
    window.print();
  });

  // Cashier Shift Listeners
  document.getElementById('btnRefreshShift')?.addEventListener('click', () => {
    loadCashierShift();
    showToast('Shift ya mauzo imesasishwa!', 'info');
  });
  document.getElementById('shiftSearchInput')?.addEventListener('input', () => {
    if (window._currentShiftSales) {
      renderShiftSalesTable(window._currentShiftSales);
    }
  });

  // Staff Management Listeners
  document.getElementById('btnOpenAddUserModal')?.addEventListener('click', () => {
    window.openAddUserModal();
  });
}

function initForms() {
  // Add Expense Form
  const addExpenseForm = document.getElementById('addExpenseForm');
  addExpenseForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(addExpenseForm);
    const body = {};
    formData.forEach((value, key) => body[key] = value);

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Matumizi yamerekodiwa kikamilifu!', 'success');
        addExpenseForm.reset();
        document.getElementById('addExpenseModal').classList.remove('active');
        loadExpenses();
        loadSummaryKPIs();
      } else {
        showToast(json.message || 'Hitilafu!', 'error');
      }
    } catch (err) {
      showToast('Hitilafu ya mtandao!', 'error');
    }
  });

  // Add Product Form (Inasaidia kupakia picha kutoka PC moja kwa moja)
  const addProductForm = document.getElementById('addProductForm');
  addProductForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(addProductForm);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success) {
        showToast('Nguo mpya imesajiliwa kikamilifu!', 'success');
        addProductForm.reset();
        clearAddProductImage();
        document.getElementById('addProductModal').classList.remove('active');
        loadProducts();
        loadSummaryKPIs();
      } else {
        showToast(json.message || 'Hitilafu!', 'error');
      }
    } catch (err) {
      showToast('Hitilafu ya mtandao!', 'error');
    }
  });

  // Edit Product Form (Kurekebisha Jina, Bei, Kategoria na Picha ya Nguo)
  const editProductForm = document.getElementById('editProductForm');
  editProductForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('edit_product_id').value;
    const formData = new FormData(editProductForm);

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        body: formData
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Taarifa na bei za nguo zimesasishwa!', 'success');
        clearEditProductImage();
        document.getElementById('editProductModal').classList.remove('active');
        loadProducts();
        loadSummaryKPIs();
      } else {
        showToast(json.message || 'Hitilafu ya kusasisha!', 'error');
      }
    } catch (err) {
      showToast('Hitilafu ya mtandao!', 'error');
    }
  });

  // Add Customer Order Form (Kurekodi Oda ya Mteja na Picha kutoka PC)
  const addOrderForm = document.getElementById('addOrderForm');
  addOrderForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(addOrderForm);
    formData.append('created_by', state.currentUser?.full_name || 'Muuzaji');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Oda mpya imerekodiwa kikamilifu!', 'success');
        addOrderForm.reset();
        clearAddOrderImage();
        document.getElementById('addOrderModal').classList.remove('active');
        loadOrders();
      } else {
        showToast(json.message || 'Hitilafu ya kurekodi oda!', 'error');
      }
    } catch (err) {
      showToast('Hitilafu ya mtandao!', 'error');
    }
  });

  // Edit Customer Order Form
  const editOrderForm = document.getElementById('editOrderForm');
  editOrderForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const orderId = document.getElementById('edit_order_id').value;
    const formData = new FormData(editOrderForm);

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        body: formData
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Oda imesasishwa kikamilifu!', 'success');
        clearEditOrderImage();
        document.getElementById('editOrderModal').classList.remove('active');
        loadOrders();
      } else {
        showToast(json.message || 'Hitilafu ya kusasisha oda!', 'error');
      }
    } catch (err) {
      showToast('Hitilafu ya mtandao!', 'error');
    }
  });

  // Order Payment Form (Kupokea Malipo ya Baki ya Oda)
  const orderPaymentForm = document.getElementById('orderPaymentForm');
  orderPaymentForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const orderId = document.getElementById('pay_order_id').value;
    const amount = document.getElementById('pay_order_amount').value;
    const payment_type = document.getElementById('pay_order_method').value;
    const reference_code = document.getElementById('pay_order_ref').value;
    const notes = document.getElementById('pay_order_notes').value;

    try {
      const res = await fetch(`/api/orders/${orderId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          payment_type,
          reference_code,
          notes,
          cashier_name: state.currentUser?.full_name || 'Muuzaji'
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Malipo ya baki yamepokelewa kikamilifu!', 'success');
        orderPaymentForm.reset();
        document.getElementById('orderPaymentModal').classList.remove('active');
        loadOrders();
      } else {
        showToast(json.message || 'Hitilafu ya kupokea malipo!', 'error');
      }
    } catch (err) {
      showToast('Hitilafu ya mtandao!', 'error');
    }
  });

  // Restock Form
  const restockForm = document.getElementById('restockForm');
  restockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(restockForm);
    const body = {};
    formData.forEach((value, key) => body[key] = value);

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Mzigo mpya umerekodiwa stoo!', 'success');
        restockForm.reset();
        document.getElementById('restockModal').classList.remove('active');
        loadProducts();
        loadPurchases();
        loadSummaryKPIs();
      } else {
        showToast(json.message || 'Hitilafu!', 'error');
      }
    } catch (err) {
      showToast('Hitilafu ya mtandao!', 'error');
    }
  });

  // Installment Form (Layaway & Credit)
  const installmentForm = document.getElementById('installmentForm');
  installmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saleId = document.getElementById('instSaleId').value;
    const amount = document.getElementById('instAmount').value;
    const payment_type = document.getElementById('instPaymentType').value;
    const reference_code = document.getElementById('instRefCode').value;

    try {
      const res = await fetch(`/api/sales/${saleId}/installments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, payment_type, reference_code })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Malipo ya awamu yamerekodiwa kikamilifu!', 'success');
        document.getElementById('installmentModal').classList.remove('active');
        loadLayaways();
        loadCredits();
        loadSummaryKPIs();
        loadDailyRevenue();

        // Ikiwa mteja amemaliza malipo (Salio = 0), fanya prompt ya kutuma ujumbe wa WhatsApp wa kumshukuru
        if (json.newBalanceDue <= 0) {
          setTimeout(() => {
            if (window.sendLayawayCompletedWhatsApp) {
              window.sendLayawayCompletedWhatsApp(saleId);
            }
          }, 600);
        }
      } else {
        showToast(json.message || 'Hitilafu!', 'error');
      }
    } catch (err) {
      showToast('Hitilafu ya mtandao!', 'error');
    }
  });

  // Settings Form
  const settingsForm = document.getElementById('settingsForm');
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(settingsForm);
    const body = {};
    formData.forEach((value, key) => body[key] = value);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Mipangilio ya duka imehifadhiwa!', 'success');
        loadSettings();
      }
    } catch (err) {
      showToast('Hitilafu ya kuhifadhi!', 'error');
    }
  });

  // Z-Report Listeners
  document.getElementById('btnOpenZReportModal')?.addEventListener('click', () => openZReportModal());
  document.getElementById('btnOpenZReportModal2')?.addEventListener('click', () => openZReportModal());
  document.getElementById('zReportDateInput')?.addEventListener('change', (e) => openZReportModal(e.target.value));
  document.getElementById('btnSendZReportWhatsApp')?.addEventListener('click', window.sendZReportWhatsApp);
  document.getElementById('btnPrintZReportBtn')?.addEventListener('click', () => window.print());

  // Database Backup & Restore Listeners
  document.getElementById('btnTriggerRestore')?.addEventListener('click', () => {
    document.getElementById('restoreDbFileInput')?.click();
  });

  document.getElementById('restoreDbFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm(`Je, una uhakika unataka kurudisha database kutoka kwenye faili la "${file.name}"? Data zilizopo sasa zitabadilishwa na faili hili.`)) {
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('db_file', file);

    try {
      showToast('Database inarudishwa, tafadhali subiri...', 'info');
      const res = await fetch('/api/restore', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message, 'success');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast(json.message || 'Hitilafu wakati wa kurudisha database!', 'error');
      }
    } catch (err) {
      showToast('Hitilafu ya mtandao wakati wa kupakia faili!', 'error');
    }
  });

  // Variants Breakdown Form Listeners
  document.getElementById('btnAddVariantRow')?.addEventListener('click', () => {
    appendVariantRow('', '', 1);
    recalculateVariantTotal();
  });

  const variantsForm = document.getElementById('variantsForm');
  variantsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('varProductId').value;
    const rows = document.querySelectorAll('.variant-row-item');
    const variants = [];

    rows.forEach(r => {
      const size = r.querySelector('.var-size-input')?.value.trim();
      const color = r.querySelector('.var-color-input')?.value.trim();
      const quantity = parseInt(r.querySelector('.var-qty-input')?.value) || 0;
      if (size) {
        variants.push({ size, color, quantity });
      }
    });

    try {
      const res = await fetch(`/api/products/${productId}/variants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Mgawanyo wa saizi na stoo umehifadhiwa vizuri!', 'success');
        document.getElementById('variantsModal').classList.remove('active');
        loadProducts();
        loadSummaryKPIs();
      } else {
        showToast(json.message || 'Hitilafu ya kuhifadhi!', 'error');
      }
    } catch (err) {
      showToast('Hitilafu ya mtandao!', 'error');
    }
  });

  // Add / Edit Staff Form
  const addUserForm = document.getElementById('addUserForm');
  addUserForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('modalUserId').value;
    const full_name = document.getElementById('modalUserFullName').value.trim();
    const username = document.getElementById('modalUserUsername').value.trim();
    const password_pin = document.getElementById('modalUserPin').value.trim();
    const role = document.getElementById('modalUserRole').value;
    const phone = document.getElementById('modalUserPhone').value.trim();

    const isEdit = !!userId;
    const url = isEdit ? `/api/auth/users/${userId}` : '/api/auth/users';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name, username, password_pin, role, phone })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Mfanyakazi amehifadhiwa vizuri!', 'success');
        document.getElementById('addUserModal').classList.remove('active');
        loadUsersTable();
      } else {
        showToast(json.message || 'Hitilafu!', 'error');
      }
    } catch (err) {
      showToast('Hitilafu ya mtandao!', 'error');
    }
  });
}

// ===================================================
// 10. Z-REPORT (CASH DRAWER CLOSING & BALANCING)
// ===================================================

let currentZReport = null;

async function openZReportModal(selectedDate) {
  const dateStr = selectedDate || new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('zReportDateInput');
  if (dateInput) dateInput.value = dateStr;

  try {
    const res = await fetch(`/api/reports/z-report?date=${dateStr}`);
    const json = await res.json();
    if (json.success) {
      currentZReport = json.data;
      const d = json.data;

      if (state.settings && state.settings.store_name) {
        document.getElementById('zrepStoreName').innerText = state.settings.store_name;
      }

      document.getElementById('zrepDate').innerText = new Date(d.date).toLocaleDateString('sw-TZ', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      });
      document.getElementById('zrepExpectedCash').innerText = formatTZS(d.expectedDrawerCash);
      document.getElementById('zrepCashIn').innerText = formatTZS(d.cashIn);
      document.getElementById('zrepCashOut').innerText = '- ' + formatTZS(d.cashOut);

      document.getElementById('zrepTigoIn').innerText = formatTZS(d.tigoIn);
      document.getElementById('zrepAirtelIn').innerText = formatTZS(d.airtelIn);
      document.getElementById('zrepOtherIn').innerText = formatTZS(d.otherIn);

      document.getElementById('zrepTotalCollected').innerText = formatTZS(d.totalCollected);
      document.getElementById('zrepTotalExpenses').innerText = '- ' + formatTZS(d.totalExpenses);
      document.getElementById('zrepNetProfit').innerText = formatTZS(d.netProfit);
      document.getElementById('zrepSalesCount').innerText = d.salesCount + ' miamala';
      document.getElementById('zrepUnitsSold').innerText = d.unitsSold + ' pcs';
      document.getElementById('zrepCreditIssued').innerText = formatTZS(d.creditIssuedToday);

      document.getElementById('zReportModal').classList.add('active');
    } else {
      showToast('Hitilafu ya kupata taarifa za Z-Report', 'error');
    }
  } catch (err) {
    showToast('Hitilafu ya mtandao!', 'error');
  }
}

window.sendZReportWhatsApp = function() {
  if (!currentZReport) return;
  const d = currentZReport;
  const storeName = state.settings.store_name || 'GLOWNEST SMART WEAR';
  const ownerName = state.settings.owner_name || 'ABISHAI EVARISTO NGENZI';
  const location = state.settings.store_location || 'GOLANI KIJIWENI - KIMARA SUKA DSM-TZ';
  const ownerPhone = state.settings?.store_phone_primary || '0656392400';

  let msg = `📊 *${storeName.toUpperCase()} - Z-REPORT* 🏪\n`;
  msg += `_Taarifa ya Kufunga Hesabu za Siku_\n`;
  msg += `📅 Tarehe: *${new Date(d.date).toLocaleDateString('sw-TZ')}*\n`;
  msg += `📍 ${location}\n`;
  msg += `👤 Mmiliki: *${ownerName}*\n\n`;

  msg += `─────────────────────────\n`;
  msg += `💵 *PESA TASLIMU (CASH DROONI):*\n`;
  msg += `• Pesa ya Mauzo/Marejesho Iliyoingia: TZS ${(d.cashIn).toLocaleString()}\n`;
  msg += `• Matumizi Yaliyotolewa Drooni: - TZS ${(d.cashOut).toLocaleString()}\n`;
  msg += `👉 *PESA INAYOPASWA KUWEPO DROONI: TZS ${(d.expectedDrawerCash).toLocaleString()}*\n\n`;

  msg += `📱 *LIPA NAMBA ZA SIMU:*\n`;
  msg += `• Tigo Pesa (${state.settings?.tigo_lipa_number || '44834912'}): TZS ${(d.tigoIn).toLocaleString()}\n`;
  msg += `• Airtel Money (${state.settings?.airtel_lipa_number || '136541343'}): TZS ${(d.airtelIn).toLocaleString()}\n`;
  if (d.otherIn > 0) {
    msg += `• Njia Nyingine: TZS ${(d.otherIn).toLocaleString()}\n`;
  }

  msg += `\n─────────────────────────\n`;
  msg += `📈 *MUHTASARI WA BIASHARA:* \n`;
  msg += `• Jumla Yote Yaliyokusanywa: *TZS ${(d.totalCollected).toLocaleString()}*\n`;
  msg += `• Jumla ya Matumizi Yote ya Siku: - TZS ${(d.totalExpenses).toLocaleString()}\n`;
  msg += `💰 *FAIDA HALISI YA SIKU (NET): TZS ${(d.netProfit).toLocaleString()}*\n`;
  msg += `• Idadi ya Nguo Zilizouzwa: *${d.unitsSold} pcs*\n`;
  msg += `• Jumla ya Miamala: *${d.salesCount}*\n`;
  if (d.creditIssuedToday > 0) {
    msg += `• Mikopo Iliyotolewa Leo: TZS ${(d.creditIssuedToday).toLocaleString()}\n`;
  }

  msg += `\n_Hesabu zimefungwa na mfumo wa GLOWNEST Smart Wear._ 🙏✨`;

  window.openWhatsAppDispatchModal({
    title: 'Tuma Z-Report kwa WhatsApp ya Mmiliki',
    customerName: ownerName,
    phone: ownerPhone,
    message: msg
  });
};

// ===================================================
// 11. CASHIER SHIFT VIEW & DAILY SUMMARY
// ===================================================

window._currentShiftSales = [];

async function loadCashierShift() {
  const dateEl = document.getElementById('shiftCurrentDate');
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  if (dateEl) {
    dateEl.innerText = now.toLocaleDateString('sw-TZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  const cashierParam = state.currentUser?.role === 'cashier' ? (state.currentUser?.full_name || '') : '';
  const url = `/api/sales/my-shift?date=${dateStr}${cashierParam ? '&cashier_name=' + encodeURIComponent(cashierParam) : ''}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) {
      const d = json.data;
      window._currentShiftSales = d.sales || [];

      // Update KPI totals
      const totalCol = document.getElementById('shiftTotalCollected');
      const txCount = document.getElementById('shiftTxCount');
      const cashCol = document.getElementById('shiftCashCollected');
      const lipaCol = document.getElementById('shiftLipaCollected');
      const lwayCol = document.getElementById('shiftLayawayCollected');

      if (totalCol) totalCol.innerText = formatTZS(d.totalCollected || 0);
      if (txCount) txCount.innerText = d.salesCount || 0;
      if (cashCol) cashCol.innerText = formatTZS(d.cashCollected || 0);
      if (lipaCol) lipaCol.innerText = formatTZS(d.lipaNambaCollected || 0);
      if (lwayCol) lwayCol.innerText = formatTZS(d.layawayCollected || 0);

      // Render Shift Sales Table
      renderShiftSalesTable(window._currentShiftSales);
    }
  } catch (err) {
    console.error('Error loading cashier shift:', err);
  }
}

function renderShiftSalesTable(salesList) {
  const tbody = document.getElementById('shiftSalesTableBody');
  if (!tbody) return;

  const searchKeyword = (document.getElementById('shiftSearchInput')?.value || '').toLowerCase().trim();

  const filtered = (salesList || []).filter(s => {
    return !searchKeyword ||
      s.receipt_no.toLowerCase().includes(searchKeyword) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(searchKeyword)) ||
      (s.customer_phone && s.customer_phone.includes(searchKeyword));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 25px; color: var(--text-dim);">Hakuna mauzo yaliyorekodiwa kwenye shift ya leo bado.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    let badge = '<span class="badge badge-success">Imelipwa Yote</span>';
    if (s.status === 'pending_layaway') badge = '<span class="badge badge-purple">Akiba Inaendelea</span>';
    if (s.status === 'credit_active') badge = '<span class="badge badge-warning">Mkopo</span>';

    const timeStr = new Date(s.created_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' });

    return `
      <tr>
        <td><strong>${s.receipt_no}</strong></td>
        <td>${timeStr}</td>
        <td>${s.customer_name || 'Mteja'} ${s.customer_phone ? '(' + s.customer_phone + ')' : ''}</td>
        <td><strong>${formatTZS(s.net_amount)}</strong></td>
        <td style="color: var(--accent-emerald); font-weight:700;">${formatTZS(s.amount_paid)}</td>
        <td><span class="badge badge-info">${s.payment_provider || s.payment_type}</span></td>
        <td style="color: var(--accent-rose);">${formatTZS(s.balance_due)}</td>
        <td>${badge}</td>
        <td>
          <div style="display:flex; gap: 4px;">
            <button class="btn-secondary" style="padding: 3px 8px; font-size: 0.72rem;" onclick="viewSingleReceipt('${s.receipt_no}')">
              <i class="fa-solid fa-receipt"></i> Risiti
            </button>
            <button class="btn-icon-wa" style="padding: 3px 6px; font-size: 0.72rem;" onclick="sendPastReceiptWhatsApp('${s.receipt_no}')" title="Tuma Risiti kwa WhatsApp">
              <i class="fa-brands fa-whatsapp"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ===================================================
// 12. STAFF & USER MANAGEMENT (ADMIN ONLY)
// ===================================================

let currentUsersList = [];

async function loadUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/auth/users');
    const json = await res.json();
    if (json.success) {
      currentUsersList = json.data || [];
      renderUsersTable(currentUsersList);
    }
  } catch (err) {
    console.error('Error loading users table:', err);
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--text-dim);">Hakuna wafanyakazi waliosajiliwa.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isCashier = u.role === 'cashier';
    const roleBadge = isCashier
      ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);"><i class="fa-solid fa-user-tag"></i> Muuzaji (Cashier)</span>`
      : `<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);"><i class="fa-solid fa-user-shield"></i> Mmiliki (Admin)</span>`;

    const statusBadge = u.is_active
      ? `<span class="badge badge-success">Hai (Active)</span>`
      : `<span class="badge badge-danger">Imezimwa</span>`;

    return `
      <tr>
        <td><strong>${u.full_name}</strong></td>
        <td><code>${u.username}</code></td>
        <td>${roleBadge}</td>
        <td>${u.phone || '-'}</td>
        <td><strong style="letter-spacing: 2px; color: var(--accent-gold);">${u.password_pin}</strong></td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex; gap: 4px;">
            <button class="btn-secondary" style="padding: 3px 8px; font-size: 0.72rem; border-color: var(--accent-gold); color: var(--accent-gold);" onclick="openEditUserModal(${u.id})" title="Badilisha PIN / Jina">
              <i class="fa-solid fa-pen"></i> Rekebisha PIN
            </button>
            ${u.username !== 'admin' ? `
              <button class="cart-remove-item" onclick="deleteUserAccount(${u.id}, '${u.full_name}')" title="Futa Mfanyakazi">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.openAddUserModal = function() {
  document.getElementById('modalUserId').value = '';
  document.getElementById('userModalTitle').innerText = 'Sajili Mfanyakazi Mpya';
  document.getElementById('modalUserFullName').value = '';
  document.getElementById('modalUserUsername').value = '';
  document.getElementById('modalUserPin').value = '';
  document.getElementById('modalUserRole').value = 'cashier';
  document.getElementById('modalUserPhone').value = '';
  document.getElementById('addUserModal').classList.add('active');
};

window.openEditUserModal = function(userId) {
  const u = currentUsersList.find(x => x.id === userId);
  if (!u) return;

  document.getElementById('modalUserId').value = u.id;
  document.getElementById('userModalTitle').innerText = `Rekebisha Taarifa & PIN: ${u.full_name}`;
  document.getElementById('modalUserFullName').value = u.full_name;
  document.getElementById('modalUserUsername').value = u.username;
  document.getElementById('modalUserPin').value = u.password_pin;
  document.getElementById('modalUserRole').value = u.role;
  document.getElementById('modalUserPhone').value = u.phone || '';
  document.getElementById('addUserModal').classList.add('active');
};

window.deleteUserAccount = async function(userId, name) {
  if (!confirm(`Je, una uhakika unataka kumfuta mfanyakazi "${name}"?`)) return;

  try {
    const res = await fetch(`/api/auth/users/${userId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Mfanyakazi amefutwa kikamilifu!', 'success');
      loadUsersTable();
    } else {
      showToast(json.message || 'Hitilafu ya kufuta!', 'error');
    }
  } catch (err) {
    showToast('Hitilafu ya mtandao!', 'error');
  }
};

// ===================================================
// 8. IMAGE UPLOAD & DROPZONE HELPERS (PC FILES & PREVIEWS)
// ===================================================

function initImageUploadZones() {
  // 1. Add Product Image Zone
  setupImageDropzone(
    'addProductImageZone',
    'addProductImageInput',
    'addProductUploadPrompt',
    'addProductPreviewContainer',
    'addProductPreviewImg',
    'addProductFileName'
  );

  // 2. Edit Product Image Zone
  setupImageDropzone(
    'editProductImageZone',
    'editProductImageInput',
    'editProductUploadPrompt',
    'editProductPreviewContainer',
    'editProductPreviewImg',
    'editProductFileName'
  );

  // 3. Add Customer Order Image Zone
  setupImageDropzone(
    'addOrderImageZone',
    'addOrderImageInput',
    'addOrderUploadPrompt',
    'addOrderPreviewContainer',
    'addOrderPreviewImg',
    'addOrderFileName'
  );

  // 4. Edit Customer Order Image Zone
  setupImageDropzone(
    'editOrderImageZone',
    'editOrderImageInput',
    'editOrderUploadPrompt',
    'editOrderPreviewContainer',
    'editOrderPreviewImg',
    'editOrderFileName'
  );
}

function setupImageDropzone(zoneId, inputId, promptId, containerId, imgId, nameId) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const prompt = document.getElementById(promptId);
  const container = document.getElementById(containerId);
  const img = document.getElementById(imgId);
  const nameEl = document.getElementById(nameId);

  if (!zone || !input) return;

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Tafadhali chagua faili la picha halali (JPG, PNG, WEBP)!', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (img) img.src = e.target.result;
      if (container) container.style.display = 'flex';
      if (prompt) prompt.style.display = 'none';
      if (nameEl) nameEl.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    };
    reader.readAsDataURL(file);
  }

  input.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      input.files = e.dataTransfer.files;
      handleFile(file);
    }
  });
}

window.clearAddProductImage = function() {
  const input = document.getElementById('addProductImageInput');
  if (input) input.value = '';
  const container = document.getElementById('addProductPreviewContainer');
  const prompt = document.getElementById('addProductUploadPrompt');
  const manual = document.getElementById('addProductImageUrlManual');
  if (container) container.style.display = 'none';
  if (prompt) prompt.style.display = 'flex';
  if (manual) manual.value = '';
};

window.clearEditProductImage = function() {
  const input = document.getElementById('editProductImageInput');
  if (input) input.value = '';
  const container = document.getElementById('editProductPreviewContainer');
  const prompt = document.getElementById('editProductUploadPrompt');
  const manual = document.getElementById('edit_image_url_manual');
  if (container) container.style.display = 'none';
  if (prompt) prompt.style.display = 'flex';
  if (manual) manual.value = '';
};

window.clearAddOrderImage = function() {
  const input = document.getElementById('addOrderImageInput');
  if (input) input.value = '';
  const container = document.getElementById('addOrderPreviewContainer');
  const prompt = document.getElementById('addOrderUploadPrompt');
  const manual = document.getElementById('addOrderImageUrlManual');
  if (container) container.style.display = 'none';
  if (prompt) prompt.style.display = 'flex';
  if (manual) manual.value = '';
};

window.clearEditOrderImage = function() {
  const input = document.getElementById('editOrderImageInput');
  if (input) input.value = '';
  const container = document.getElementById('editOrderPreviewContainer');
  const prompt = document.getElementById('editOrderUploadPrompt');
  const manual = document.getElementById('edit_order_image_url_manual');
  if (container) container.style.display = 'none';
  if (prompt) prompt.style.display = 'flex';
  if (manual) manual.value = '';
};

// Lightbox for viewing clothing photo in large view
window.openImageLightbox = function(imgSrc, title) {
  const modal = document.getElementById('imageLightboxModal');
  const img = document.getElementById('lightboxImg');
  const titleEl = document.getElementById('lightboxTitle');
  if (modal && img) {
    img.src = imgSrc;
    if (titleEl) titleEl.innerText = title || 'Picha ya Nguo';
    modal.classList.add('active');
  }
};

// ===================================================
// 9. ODA ZA NGUO ZA WATEJA (CUSTOMER ORDERS LOGIC)
// ===================================================

async function loadOrders() {
  try {
    const res = await fetch('/api/orders');
    const json = await res.json();
    if (json.success) {
      state.orders = json.data || [];
      renderOrdersTable();
      updateOrdersBadge();
      loadOrderKPIs();
    }
  } catch (err) {
    console.error('Hitilafu ya kupakia oda:', err);
  }
}

async function loadOrderKPIs() {
  try {
    const res = await fetch('/api/orders/stats/summary');
    const json = await res.json();
    if (json.success) {
      const d = json.data;
      const elPending = document.getElementById('kpiOrdersPending');
      const elOrdered = document.getElementById('kpiOrdersOrdered');
      const elArrived = document.getElementById('kpiOrdersArrived');
      const elBal = document.getElementById('kpiOrdersBalanceDue');

      if (elPending) elPending.innerText = d.pending_count || 0;
      if (elOrdered) elOrdered.innerText = d.ordered_count || 0;
      if (elArrived) elArrived.innerText = d.arrived_count || 0;
      if (elBal) elBal.innerText = formatTZS(d.total_balance_due || 0);
    }
  } catch (err) {
    console.error('Hitilafu ya kupakia KPI za oda:', err);
  }
}

function updateOrdersBadge() {
  const badge = document.getElementById('ordersBadge');
  if (!badge) return;
  const activeCount = state.orders.filter(o => o.status === 'pending' || o.status === 'ordered' || o.status === 'arrived').length;
  if (activeCount > 0) {
    badge.innerText = activeCount;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  const keyword = (state.ordersSearchKeyword || '').toLowerCase().trim();
  const targetDate = state.ordersTargetDate;
  const statusFilter = state.activeOrderStatus;

  const filtered = state.orders.filter(o => {
    const matchStatus = (statusFilter === 'all') || (o.status === statusFilter);
    const matchSearch = !keyword || 
      (o.order_no && o.order_no.toLowerCase().includes(keyword)) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(keyword)) ||
      (o.customer_phone && o.customer_phone.toLowerCase().includes(keyword)) ||
      (o.clothing_item && o.clothing_item.toLowerCase().includes(keyword)) ||
      (o.color && o.color.toLowerCase().includes(keyword)) ||
      (o.size && o.size.toLowerCase().includes(keyword));
    const matchDate = !targetDate || (o.target_date === targetDate);

    return matchStatus && matchSearch && matchDate;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-dim);">
          <i class="fa-solid fa-clipboard-list" style="font-size: 2.5rem; margin-bottom: 8px; color: var(--accent-gold);"></i>
          <p>Hakuna oda iliyopatikana kwa vigezo hivi.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    // Delivery date calculation & countdown
    const todayStr = new Date().toISOString().split('T')[0];
    let countdownHtml = '';
    if (o.status === 'delivered') {
      countdownHtml = `<span class="countdown-chip" style="background: rgba(16, 185, 129, 0.2); color: #34d399;"><i class="fa-solid fa-check-double"></i> Imekabidhiwa</span>`;
    } else if (o.status === 'cancelled') {
      countdownHtml = `<span class="countdown-chip" style="background: rgba(239, 68, 68, 0.2); color: #f87171;"><i class="fa-solid fa-ban"></i> Imeghairiwa</span>`;
    } else {
      const targetTime = new Date(o.target_date).getTime();
      const todayTime = new Date(todayStr).getTime();
      const diffDays = Math.round((targetTime - todayTime) / 86400000);

      if (diffDays === 0) {
        countdownHtml = `<span class="countdown-chip today"><i class="fa-solid fa-bell"></i> LEO (${o.target_date})</span>`;
      } else if (diffDays < 0) {
        countdownHtml = `<span class="countdown-chip overdue"><i class="fa-solid fa-triangle-exclamation"></i> Imechelewa siku ${Math.abs(diffDays)}</span>`;
      } else if (diffDays === 1) {
        countdownHtml = `<span class="countdown-chip upcoming"><i class="fa-solid fa-hourglass-half"></i> Kesho (${o.target_date})</span>`;
      } else {
        countdownHtml = `<span class="countdown-chip upcoming"><i class="fa-solid fa-calendar-day"></i> Bado siku ${diffDays} (${o.target_date})</span>`;
      }
    }

    // WhatsApp URL generation
    const cleanPhone = formatWhatsAppPhone(o.customer_phone);
    const waMsg = encodeURIComponent(
      `Habari ${o.customer_name},\n` +
      `Tunawasiliana nawe kutoka *${state.settings.store_name || 'GLOWNEST Smart Wear'}* kuhusu oda yako ya *"${o.clothing_item}"* (Oda #${o.order_no}).\n\n` +
      `📌 Hali ya Oda: *${getOrderStatusName(o.status)}*\n` +
      `💰 Bei Kamili: *${formatTZS(o.estimated_price)}*\n` +
      `💵 Kiasi Kilicholipwa: *${formatTZS(o.advance_paid)}*\n` +
      `⚠️ Baki Inayodaiwa: *${formatTZS(o.balance_due)}*\n\n` +
      `Asante kwa kuchagua GLOWNEST Smart Wear! Tupo ${state.settings.store_location || 'Kimara Suka'}.`
    );

    const defaultImg = 'https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80';
    const imgSrc = o.image_url || defaultImg;

    return `
      <tr>
        <td>
          <strong style="color: var(--accent-gold); font-size: 0.85rem;">#${o.order_no}</strong>
          <div style="font-size: 0.72rem; color: var(--text-muted);">
            <i class="fa-regular fa-clock"></i> ${new Date(o.created_at).toLocaleDateString('sw-TZ')}
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="order-thumb-box" onclick="openImageLightbox('${imgSrc}', '${escapeHtml(o.clothing_item)}')" title="Bofya kutazama picha">
              <img src="${imgSrc}" alt="${escapeHtml(o.clothing_item)}" onerror="this.src='${defaultImg}'">
            </div>
            <div>
              <strong style="font-size: 0.88rem; color: #f8fafc;">${escapeHtml(o.clothing_item)}</strong>
              <div style="font-size: 0.74rem; color: var(--text-dim);">
                <span class="category-badge">${o.category || 'Nguo'}</span>
                ${o.color ? `<span>&bull; ${escapeHtml(o.color)}</span>` : ''}
              </div>
              ${o.notes ? `<div style="font-size: 0.7rem; color: #cbd5e1; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(o.notes)}"><i class="fa-solid fa-note-sticky"></i> ${escapeHtml(o.notes)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>
          <strong style="font-size: 0.88rem;">${escapeHtml(o.customer_name)}</strong>
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
            <a href="tel:${o.customer_phone}" class="btn-call-sm" title="Piga Simu"><i class="fa-solid fa-phone"></i> ${o.customer_phone}</a>
            <a href="https://wa.me/${cleanPhone}?text=${waMsg}" target="_blank" class="btn-wa-sm" title="Tuma ujumbe WhatsApp"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
          </div>
        </td>
        <td>
          ${countdownHtml}
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
            Ahadi: ${o.target_date}
          </div>
        </td>
        <td>
          <strong>${o.quantity} pcs</strong>
          <div style="font-size: 0.74rem; color: var(--text-dim);">${o.size || 'Free Size'}</div>
        </td>
        <td>
          <div style="font-size: 0.85rem; font-weight: 700;">${formatTZS(o.estimated_price)}</div>
          <div style="font-size: 0.72rem; color: var(--accent-emerald);">Advance: ${formatTZS(o.advance_paid)}</div>
          <div style="font-size: 0.75rem; font-weight: 700; color: ${o.balance_due > 0 ? 'var(--accent-rose)' : 'var(--text-muted)'};">
            Baki: ${formatTZS(o.balance_due)}
          </div>
        </td>
        <td>
          <div style="margin-bottom: 4px;">
            <span class="status-badge order-${o.status}">${getOrderStatusBadgeText(o.status)}</span>
          </div>
          <!-- Quick Status Changer -->
          <select onchange="changeOrderStatus(${o.id}, this.value)" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 0.72rem; border-radius: 4px; padding: 2px 4px; cursor: pointer;">
            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Inasubiriwa</option>
            <option value="ordered" ${o.status === 'ordered' ? 'selected' : ''}>Imeagizwa Kariakoo</option>
            <option value="arrived" ${o.status === 'arrived' ? 'selected' : ''}>Imefika Dukani</option>
            <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Imekabidhiwa</option>
            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Imeghairiwa</option>
          </select>
        </td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${o.balance_due > 0 ? `
              <button class="btn-secondary" style="padding: 3px 6px; font-size: 0.72rem; border-color: var(--accent-emerald); color: var(--accent-emerald);" onclick="openOrderPaymentModal(${o.id})" title="Pokea Baki">
                <i class="fa-solid fa-hand-holding-dollar"></i> Lipa
              </button>
            ` : ''}
            <button class="btn-secondary" style="padding: 3px 6px; font-size: 0.72rem; border-color: var(--accent-gold); color: var(--accent-gold);" onclick="openOrderReceipt(${o.id})" title="Stakabadhi ya Oda">
              <i class="fa-solid fa-receipt"></i> Risiti
            </button>
            <button class="btn-secondary" style="padding: 3px 6px; font-size: 0.72rem;" onclick="openEditOrderModal(${o.id})" title="Hariri Oda">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-secondary" style="padding: 3px 6px; font-size: 0.72rem; border-color: var(--accent-rose); color: var(--accent-rose);" onclick="deleteCustomerOrder(${o.id})" title="Futa Oda">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.openEditOrderModal = function(orderId) {
  const o = state.orders.find(item => item.id === orderId);
  if (!o) return;

  document.getElementById('edit_order_id').value = o.id;
  document.getElementById('edit_order_customer_name').value = o.customer_name || '';
  document.getElementById('edit_order_customer_phone').value = o.customer_phone || '';
  document.getElementById('edit_order_clothing_item').value = o.clothing_item || '';
  document.getElementById('edit_order_category').value = o.category || 'Nyinginezo';
  document.getElementById('edit_order_size').value = o.size || '';
  document.getElementById('edit_order_color').value = o.color || '';
  document.getElementById('edit_order_quantity').value = o.quantity || 1;
  document.getElementById('edit_order_target_date').value = o.target_date || '';
  document.getElementById('edit_order_estimated_price').value = o.estimated_price || 0;
  document.getElementById('edit_order_status').value = o.status || 'pending';
  document.getElementById('edit_order_notes').value = o.notes || '';
  document.getElementById('edit_order_image_url_manual').value = o.image_url || '';

  // Show image preview
  const imgInput = document.getElementById('editOrderImageInput');
  if (imgInput) imgInput.value = '';
  if (o.image_url) {
    document.getElementById('editOrderPreviewImg').src = o.image_url;
    document.getElementById('editOrderPreviewContainer').style.display = 'flex';
    document.getElementById('editOrderUploadPrompt').style.display = 'none';
    document.getElementById('editOrderFileName').innerText = o.image_url.split('/').pop() || 'Picha ya oda';
  } else {
    document.getElementById('editOrderPreviewContainer').style.display = 'none';
    document.getElementById('editOrderUploadPrompt').style.display = 'flex';
  }

  document.getElementById('editOrderModal').classList.add('active');
};

window.openOrderPaymentModal = function(orderId) {
  const o = state.orders.find(item => item.id === orderId);
  if (!o) return;

  document.getElementById('pay_order_id').value = o.id;
  document.getElementById('payOrderNo').innerText = '#' + o.order_no;
  document.getElementById('payOrderCustomer').innerText = o.customer_name + ' (' + o.customer_phone + ')';
  document.getElementById('payOrderItem').innerText = o.clothing_item;
  document.getElementById('payOrderTotal').innerText = formatTZS(o.estimated_price);
  document.getElementById('payOrderAdvance').innerText = formatTZS(o.advance_paid);
  document.getElementById('payOrderBalance').innerText = formatTZS(o.balance_due);

  document.getElementById('pay_order_amount').value = o.balance_due;
  document.getElementById('pay_order_amount').max = o.balance_due;
  document.getElementById('pay_order_ref').value = '';
  document.getElementById('pay_order_notes').value = '';

  document.getElementById('orderPaymentModal').classList.add('active');
};

window.openOrderReceipt = function(orderId) {
  const o = state.orders.find(item => item.id === orderId);
  if (!o) return;

  state.currentReceiptOrder = o;

  document.getElementById('ordRecStoreName').innerText = state.settings.store_name || 'GLOWNEST SMART WEAR';
  document.getElementById('ordRecStoreLocation').innerText = state.settings.store_location || 'GOLANI KIJIWENI - KIMARA SUKA DSM-TZ';
  document.getElementById('ordRecStorePhone').innerText = 'Simu: ' + (state.settings.store_phone || '0656392400 / 0685073565');

  document.getElementById('ordRecNumber').innerText = '#' + o.order_no;
  document.getElementById('ordRecCreatedDate').innerText = new Date(o.created_at).toLocaleDateString('sw-TZ');
  document.getElementById('ordRecTargetDate').innerText = o.target_date;
  document.getElementById('ordRecCustomer').innerText = o.customer_name;
  document.getElementById('ordRecPhone').innerText = o.customer_phone;
  document.getElementById('ordRecCashier').innerText = o.created_by || state.currentUser?.full_name || 'Muuzaji';

  document.getElementById('ordRecItemName').innerText = 'Nguo: ' + o.clothing_item;
  document.getElementById('ordRecItemDetails').innerText = `Kategoria: ${o.category || '-'} | Saizi: ${o.size || 'Free'} | Rangi: ${o.color || '-'} | Idadi: ${o.quantity} pcs`;
  document.getElementById('ordRecNotes').innerText = o.notes ? `Maelezo: ${o.notes}` : '';

  document.getElementById('ordRecTotal').innerText = formatTZS(o.estimated_price);
  document.getElementById('ordRecPaid').innerText = formatTZS(o.advance_paid);
  document.getElementById('ordRecBalance').innerText = formatTZS(o.balance_due);

  document.getElementById('orderReceiptModal').classList.add('active');
};

window.changeOrderStatus = async function(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message || `Hali ya oda imesasishwa!`, 'success');
      loadOrders();
    } else {
      showToast(json.message || 'Hitilafu ya kubadili hali!', 'error');
    }
  } catch (err) {
    showToast('Hitilafu ya mtandao!', 'error');
  }
};

window.deleteCustomerOrder = async function(orderId) {
  const o = state.orders.find(item => item.id === orderId);
  const name = o ? o.customer_name : 'hii';
  if (!confirm(`Una uhakika unataka kufuta kabisa oda ya "${name}"?`)) return;

  try {
    const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Oda imefutwa!', 'success');
      loadOrders();
    } else {
      showToast(json.message || 'Hitilafu ya kufuta!', 'error');
    }
  } catch (err) {
    showToast('Hitilafu ya mtandao!', 'error');
  }
};

function getOrderStatusName(status) {
  switch (status) {
    case 'pending': return 'Inasubiriwa (Pending)';
    case 'ordered': return 'Imeagizwa Kariakoo / Kiwandani';
    case 'arrived': return 'Imefika Dukani - Tayari Kuchukuliwa';
    case 'delivered': return 'Imekabidhiwa kwa Mteja (Completed)';
    case 'cancelled': return 'Imeghairiwa';
    default: return status;
  }
}

function getOrderStatusBadgeText(status) {
  switch (status) {
    case 'pending': return '<i class="fa-solid fa-clock"></i> Inasubiriwa';
    case 'ordered': return '<i class="fa-solid fa-truck-fast"></i> Imeagizwa';
    case 'arrived': return '<i class="fa-solid fa-store"></i> Imefika Dukani';
    case 'delivered': return '<i class="fa-solid fa-check-double"></i> Imekabidhiwa';
    case 'cancelled': return '<i class="fa-solid fa-ban"></i> Imeghairiwa';
    default: return status;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===================================================
// MAPATO YA SIKU (DAILY COLLECTIONS & REVENUE LOGIC)
// ===================================================

let currentDailyRevenueData = null;

function initDailyRevenue() {
  const datePicker = document.getElementById('dailyRevenueDatePicker');
  if (datePicker) {
    const todayStr = new Date().toISOString().split('T')[0];
    datePicker.value = todayStr;

    datePicker.addEventListener('change', () => {
      if (datePicker.value) {
        loadDailyRevenue(datePicker.value);
      }
    });
  }

  const btnToday = document.getElementById('btnDailyRevToday');
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      const todayStr = new Date().toISOString().split('T')[0];
      if (datePicker) datePicker.value = todayStr;
      loadDailyRevenue(todayStr);
    });
  }

  const btnYesterday = document.getElementById('btnDailyRevYesterday');
  if (btnYesterday) {
    btnYesterday.addEventListener('click', () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yestStr = d.toISOString().split('T')[0];
      if (datePicker) datePicker.value = yestStr;
      loadDailyRevenue(yestStr);
    });
  }

  const btnPrint = document.getElementById('btnPrintDailyRevenue');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  const searchInput = document.getElementById('searchDailyRevInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderDailyRevenueTable(e.target.value.toLowerCase().trim());
    });
  }

  const kpiCardDaily = document.getElementById('kpiCardDailyRevenue');
  if (kpiCardDaily) {
    kpiCardDaily.addEventListener('click', () => {
      const btn = document.getElementById('navDailyRevenue');
      if (btn) btn.click();
    });
  }
}

window.loadDailyRevenue = async function(dateStr) {
  const datePicker = document.getElementById('dailyRevenueDatePicker');
  const targetDate = dateStr || (datePicker && datePicker.value) || new Date().toISOString().split('T')[0];

  try {
    const res = await fetch(`/api/reports/daily-revenue?date=${targetDate}`);
    const json = await res.json();
    if (json.success && json.data) {
      currentDailyRevenueData = json.data;
      const d = json.data;

      // 4 Pillars
      const elTotal = document.getElementById('drTotalInflow');
      if (elTotal) elTotal.innerText = formatTZS(d.totalInflow || 0);

      const elCount = document.getElementById('drTotalCount');
      if (elCount) elCount.innerText = d.totalTransactionsCount || 0;

      const elDirectTot = document.getElementById('drDirectSalesTotal');
      if (elDirectTot) elDirectTot.innerText = formatTZS(d.directSalesTotal || 0);

      const elDirectCnt = document.getElementById('drDirectSalesCount');
      if (elDirectCnt) elDirectCnt.innerText = d.directSalesCount || 0;

      const elLayTot = document.getElementById('drLayawayTotal');
      if (elLayTot) elLayTot.innerText = formatTZS(d.layawayTotal || 0);

      const elLayCnt = document.getElementById('drLayawayCount');
      if (elLayCnt) elLayCnt.innerText = d.layawayCount || 0;

      const elCredTot = document.getElementById('drCreditTotal');
      if (elCredTot) elCredTot.innerText = formatTZS(d.creditTotal || 0);

      const elCredCnt = document.getElementById('drCreditCount');
      if (elCredCnt) elCredCnt.innerText = d.creditCount || 0;

      // Payment Methods
      const elCash = document.getElementById('drPayCash');
      if (elCash) elCash.innerText = formatTZS(d.paymentMethods?.cash || 0);

      const elTigo = document.getElementById('drPayTigo');
      if (elTigo) elTigo.innerText = formatTZS(d.paymentMethods?.tigo_pesa || 0);

      const elAirtel = document.getElementById('drPayAirtel');
      if (elAirtel) elAirtel.innerText = formatTZS(d.paymentMethods?.airtel_money || 0);

      const elOther = document.getElementById('drPayOther');
      if (elOther) elOther.innerText = formatTZS(d.paymentMethods?.other || 0);

      // Summary Cashflow
      const elSumIn = document.getElementById('drSummaryInflow');
      if (elSumIn) elSumIn.innerText = formatTZS(d.totalInflow || 0);

      const elSumExp = document.getElementById('drSummaryExpenses');
      if (elSumExp) elSumExp.innerText = '- ' + formatTZS(d.expensesTotal || 0);

      const elSumNet = document.getElementById('drSummaryNet');
      if (elSumNet) elSumNet.innerText = formatTZS(d.netCashBalance || 0);

      const elTblCnt = document.getElementById('dailyRevTableCount');
      if (elTblCnt) elTblCnt.innerText = d.totalTransactionsCount || 0;

      renderDailyRevenueTable();
    }
  } catch (err) {
    console.error('Hitilafu ya kupakia mapato ya siku:', err);
  }
};

function renderDailyRevenueTable(searchTerm = '') {
  const tbody = document.getElementById('dailyRevenueTableBody');
  if (!tbody) return;

  if (!currentDailyRevenueData || !currentDailyRevenueData.transactions || currentDailyRevenueData.transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 2.5rem;"><i class="fa-solid fa-receipt" style="font-size: 2rem; opacity: 0.4; margin-bottom: 0.5rem; display: block;"></i>Hakuna muamala wowote wa mapato uliorekodiwa kwa tarehe hii.</td></tr>`;
    return;
  }

  let txs = currentDailyRevenueData.transactions;
  if (searchTerm) {
    txs = txs.filter(t => 
      (t.customer_name && t.customer_name.toLowerCase().includes(searchTerm)) ||
      (t.receipt_no && t.receipt_no.toLowerCase().includes(searchTerm)) ||
      (t.type && t.type.toLowerCase().includes(searchTerm)) ||
      (t.payment_method && t.payment_method.toLowerCase().includes(searchTerm)) ||
      (t.cashier_name && t.cashier_name.toLowerCase().includes(searchTerm)) ||
      String(t.amount).includes(searchTerm)
    );
  }

  if (txs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 2rem;">Hakuna muamala unaolingana na neno ulilotafuta ("${escapeHtml(searchTerm)}").</td></tr>`;
    return;
  }

  tbody.innerHTML = txs.map(t => {
    let timeStr = '-';
    if (t.paid_at) {
      const parts = String(t.paid_at).split(' ');
      timeStr = parts[1] ? parts[1].slice(0, 5) : String(t.paid_at).slice(11, 16);
      if (!timeStr || timeStr === '-') {
        try {
          timeStr = new Date(t.paid_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {}
      }
    }
    return `
      <tr>
        <td><strong style="color: var(--text-muted); font-size: 0.82rem;"><i class="fa-regular fa-clock"></i> ${escapeHtml(timeStr)}</strong></td>
        <td><strong style="color: var(--accent-gold); font-size: 0.85rem;">${escapeHtml(t.receipt_no || '-')}</strong></td>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(t.customer_name || 'Mteja')}</div>
          ${t.customer_phone && t.customer_phone !== '-' ? `<small style="color: var(--text-muted); font-size: 0.72rem;"><i class="fa-solid fa-phone" style="font-size: 0.65rem;"></i> ${escapeHtml(t.customer_phone)}</small>` : ''}
        </td>
        <td><span class="badge ${t.badge_class || 'badge-gold'}" style="font-size: 0.72rem; padding: 3px 8px; border-radius: 6px;">${escapeHtml(t.type)}</span></td>
        <td><span style="font-size: 0.8rem; font-weight: 600;">${escapeHtml(t.payment_method)}</span></td>
        <td><span style="font-size: 0.78rem; color: var(--text-muted);"><i class="fa-solid fa-user-tag" style="font-size: 0.65rem;"></i> ${escapeHtml(t.cashier_name || 'Muuzaji')}</span></td>
        <td style="text-align: right; font-weight: 800; font-size: 0.95rem; color: var(--accent-emerald);">${formatTZS(t.amount)}</td>
      </tr>
    `;
  }).join('');
}



