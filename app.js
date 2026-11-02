// Cart survives reloads on this device only; prices are always recalculated from products.
const CART_KEY = 'sugarlife-cart-v1';
function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.flatMap(x => {
      const p = products.find(p => p.id === x?.id),
        qty = Math.floor(Number(x?.qty));
      // a product without density/volume options is stored with null for that option
      const fits = (options, value) => (options.length ? options.includes(value) : value == null);
      if (!p || p.price == null || !fits(p.densities, x.density) || !fits(p.volumes, x.volume) || !(qty >= 1))
        return [];
      return [
        {
          key: [p.id, x.density, x.volume].join('|'),
          id: p.id,
          name: p.name,
          density: x.density,
          volume: x.volume,
          qty: Math.min(qty, 999),
          price: priceFor(p, x.volume),
        },
      ];
    });
  } catch (e) {
    return [];
  }
}
function saveCart() {
  try {
    localStorage.setItem(
      CART_KEY,
      JSON.stringify(cart.map(({ id, density, volume, qty }) => ({ id, density, volume, qty }))),
    );
  } catch (e) {}
}
let cart = loadCart(),
  currentProduct = products[0],
  density = 'Средняя',
  volume = '700 г',
  quantity = 1,
  activeFilter = 'all',
  activeTab = 'description';
const rub = n =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
// nav: 'push' adds a history entry, 'replace' rewrites the current one, 'none' is used when the URL already matches (Back/Forward).
function page(id, { hash = id, nav = 'push' } = {}) {
  document.querySelectorAll('.page').forEach(x => x.classList.toggle('active', x.id === id));
  document.querySelectorAll('nav a').forEach(x => {
    x.classList.toggle('active', x.dataset.page === id);
    if (x.dataset.page === id) x.setAttribute('aria-current', 'page');
    else x.removeAttribute('aria-current');
  });
  setMenu(false);
  if (id === 'cart') renderCart();
  window.scrollTo({ top: 0, behavior: scrollBehavior() });
  if (nav === 'push' && location.hash !== '#' + hash) history.pushState(null, '', '#' + hash);
  else if (nav === 'replace') history.replaceState(null, '', '#' + hash);
  if (nav !== 'replace') focusPageHeading();
}
const scrollBehavior = () => 'smooth';
// Moves keyboard/screen-reader focus to the new page instead of leaving it on the clicked control.
function focusPageHeading() {
  const h = document.querySelector('.page.active h1');
  if (h) {
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }
}
function route(nav) {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('detail/') && products.some(p => p.id === h.slice(7))) {
    openProduct(h.slice(7), nav);
    return;
  }
  const el = h && document.getElementById(h);
  page(el && el.classList.contains('page') && h !== 'detail' ? h : h === 'detail' ? 'catalog' : 'home', {
    nav,
  });
}
window.addEventListener('popstate', () => route('none'));
document.querySelectorAll('[data-page]').forEach(el =>
  el.addEventListener('click', e => {
    e.preventDefault();
    page(el.dataset.page);
  }),
);
document
  .querySelectorAll('[data-open]')
  .forEach(el => el.addEventListener('click', () => openProduct(el.dataset.open)));
// data-filter-link="care" opens the catalog with that filter applied.
document.querySelectorAll('[data-filter-link]').forEach(el =>
  el.addEventListener('click', () => {
    page('catalog');
    document.querySelector(`.filter[data-filter="${el.dataset.filterLink}"]`).click();
  }),
);
// Clickable banners and cards that are not links/buttons get keyboard access too.
document.querySelectorAll('[data-page],[data-open],[data-filter-link]').forEach(el => {
  if (el.matches('a,button')) return;
  el.tabIndex = 0;
  el.setAttribute('role', 'link');
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.click();
    }
  });
});
document
  .querySelectorAll('[data-scroll]')
  .forEach(el =>
    el.addEventListener('click', () =>
      document.getElementById(el.dataset.scroll).scrollIntoView({ behavior: scrollBehavior() }),
    ),
  );
document.getElementById('skipLink').addEventListener('click', e => {
  e.preventDefault();
  focusPageHeading();
});
// Mobile menu
const menuBtn = document.getElementById('menuBtn'),
  mobileMenu = document.getElementById('mobileMenu');
function setMenu(open) {
  menuBtn.setAttribute('aria-expanded', open);
  menuBtn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  mobileMenu.hidden = !open;
}
menuBtn.addEventListener('click', () => {
  const open = menuBtn.getAttribute('aria-expanded') !== 'true';
  setMenu(open);
  if (open) mobileMenu.querySelector('a').focus();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !mobileMenu.hidden) {
    setMenu(false);
    menuBtn.focus();
  }
});
document.addEventListener('click', e => {
  if (!mobileMenu.hidden && !e.target.closest('header')) setMenu(false);
});
matchMedia('(min-width: 801px)').addEventListener('change', e => {
  if (e.matches) setMenu(false);
});
// Arrow keys / Home / End move between tabs inside a role="tablist".
function arrowTabs(list) {
  list.addEventListener('keydown', e => {
    const tabs = [...list.querySelectorAll('[role="tab"]')],
      i = tabs.indexOf(document.activeElement),
      next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (i < 0 || next === undefined) return;
    e.preventDefault();
    const t = tabs[(next + tabs.length) % tabs.length];
    t.focus();
    t.click();
  });
}
document.querySelectorAll('[role="tablist"]').forEach(arrowTabs);
const esc = s =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const productById = id => products.find(p => p.id === id) || products[0];
function jarMarkup(id = 'paste') {
  const p = productById(id);
  return `<img class="source-product" src="${p.image}" alt="${esc(p.name)} — оригинальная упаковка" loading="lazy">`;
}
const priceLabel = p =>
  p.price == null ? 'Цена уточняется' : (p.prices && Object.keys(p.prices).length > 1 ? 'от ' : '') + rub(p.price);
// Product texts come with line breaks: ALL-CAPS lines become small headings, "- " lines become a list.
function richText(text) {
  let html = '',
    list = [];
  const flush = () => {
    if (list.length) html += `<ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    list = [];
  };
  for (const line of text.split('\n')) {
    const letters = line.replace(/[^A-Za-zА-Яа-яЁё]/g, '');
    if (line.startsWith('- ')) {
      list.push(line.slice(2));
      continue;
    }
    flush();
    if (letters.length > 3 && letters === letters.toUpperCase()) html += `<p class="tab-heading">${esc(line)}</p>`;
    else html += `<p>${esc(line)}</p>`;
  }
  flush();
  return html;
}
function renderProducts() {
  let list = products.filter(
    p => activeFilter === 'all' || p.type === activeFilter || (p.areas || []).includes(activeFilter),
  );
  document.getElementById('productGrid').innerHTML = list
    .map(
      p =>
        `<article class="product-card" data-id="${p.id}" tabindex="0" role="button" aria-label="Открыть ${esc(p.name)}"><div class="product-visual ${p.color}">${jarMarkup(p.id)}<span class="visual-caption">Sugar Life · Professional</span></div><div class="product-info"><div><h3>${esc(p.name)}</h3><p>${esc(p.category)}${p.type === 'paste' ? ' · профессиональная серия' : ''}</p><span class="card-link">Подробнее о продукте ↗︎</span></div><span class="price">${priceLabel(p)}</span></div></article>`,
    )
    .join('');
  document.querySelectorAll('.product-card').forEach(el => {
    el.addEventListener('click', () => openProduct(el.dataset.id));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openProduct(el.dataset.id);
      }
    });
  });
}
document.querySelectorAll('.filter').forEach(b =>
  b.addEventListener('click', () => {
    activeFilter = b.dataset.filter;
    document.querySelectorAll('.filter').forEach(x => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-pressed', x === b);
    });
    renderProducts();
  }),
);
function openProduct(id, nav = 'push') {
  currentProduct = productById(id);
  density = currentProduct.densities.includes('Средняя') ? 'Средняя' : (currentProduct.densities[0] ?? null);
  volume = ['700 г', '750 г'].find(v => currentProduct.volumes.includes(v)) || (currentProduct.volumes[0] ?? null);
  quantity = 1;
  // care products have no density choice; volume shows only when the source lists it
  for (const [label, group, values] of [
    ['densityLabel', 'densityChoices', currentProduct.densities],
    ['volumeLabel', 'volumeChoices', currentProduct.volumes],
  ]) {
    document.getElementById(label).hidden = document.getElementById(group).hidden = !values.length;
  }
  document.getElementById('detailName').textContent = currentProduct.name;
  document.getElementById('detailName').classList.toggle('long-name', currentProduct.name.length > 40);
  document.getElementById('detailCategory').textContent = currentProduct.category;
  document.getElementById('detailLead').textContent = currentProduct.lead;
  document.getElementById('detailVisual').className = 'detail-visual ' + currentProduct.color;
  document.getElementById('detailVisual').innerHTML = jarMarkup(currentProduct.id);
  renderChoices();
  updateDetailPrice();
  setTab('description');
  page('detail', { hash: 'detail/' + currentProduct.id, nav });
}
function renderChoices() {
  document.getElementById('densityChoices').innerHTML = currentProduct.densities
    .map(
      d =>
        `<button class="choice ${density === d ? 'active' : ''}" aria-pressed="${density === d}" data-density="${d}">${d}</button>`,
    )
    .join('');
  document.getElementById('volumeChoices').innerHTML = currentProduct.volumes
    .map(
      v =>
        `<button class="choice ${volume === v ? 'active' : ''}" aria-pressed="${volume === v}" data-volume="${v}">${v}</button>`,
    )
    .join('');
  document.querySelectorAll('[data-density]').forEach(
    b =>
      (b.onclick = () => {
        density = b.dataset.density;
        renderChoices();
        document.querySelector(`[data-density="${density}"]`).focus();
      }),
  );
  document.querySelectorAll('[data-volume]').forEach(
    b =>
      (b.onclick = () => {
        volume = b.dataset.volume;
        renderChoices();
        updateDetailPrice();
        document.querySelector(`[data-volume="${volume}"]`).focus();
      }),
  );
}
// Per-volume price from products.js; products with a single price use p.price.
function priceFor(p, v) {
  return (p.prices && p.prices[v]) ?? p.price;
}
function updateDetailPrice() {
  const priced = currentProduct.price != null,
    add = document.getElementById('addToCart');
  document.getElementById('detailPrice').textContent = priced
    ? rub(priceFor(currentProduct, volume))
    : 'Цена уточняется';
  document.getElementById('detailQty').textContent = quantity;
  document.getElementById('detailNote').hidden = priced;
  document.querySelector('.buy-row').hidden = !priced;
  add.disabled = !priced;
}
document.getElementById('qtyMinus').onclick = () => {
  quantity = Math.max(1, quantity - 1);
  updateDetailPrice();
};
document.getElementById('qtyPlus').onclick = () => {
  quantity++;
  updateDetailPrice();
};
function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll('[data-tab]').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
    b.tabIndex = on ? 0 : -1;
  });
  document.getElementById('tabContent').setAttribute('aria-labelledby', 'tab-' + tab);
  let html = '';
  const p = currentProduct;
  if (tab === 'description') html = richText(p.description);
  if (tab === 'use')
    html =
      (p.use ? richText(p.use) : '') +
      (p.caution
        ? `<p><strong>Меры предосторожности:</strong> ${esc(p.caution)}</p>`
        : '<p><strong>Важно:</strong> рекомендации в прототипе носят общий информационный характер. Перед использованием ориентируйтесь на официальную инструкцию конкретного продукта.</p>');
  if (tab === 'features')
    html =
      `<ul>${p.features.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` +
      (p.composition
        ? `<p class="tab-heading">Состав</p>${p.composition
            .split('\n')
            .map(x => `<p class="composition">${esc(x)}</p>`)
            .join('')}`
        : '') +
      `<div class="specs"><div class="spec"><small>Линейка</small><b>${esc(p.name)}</b></div><div class="spec"><small>Категория</small><b>${esc(p.category)}</b></div></div>`;
  document.getElementById('tabContent').innerHTML = html;
}
document
  .querySelectorAll('[data-tab]')
  .forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
document.getElementById('addToCart').onclick = () => {
  if (currentProduct.price == null) return;
  let key = [currentProduct.id, density, volume].join('|'),
    item = cart.find(x => x.key === key);
  if (item) item.qty += quantity;
  else
    cart.push({
      key,
      id: currentProduct.id,
      name: currentProduct.name,
      density,
      volume,
      qty: quantity,
      price: priceFor(currentProduct, volume),
    });
  if (!document.getElementById('checkoutDone').hidden) resetCheckout();
  updateCount();
  toast('Товар добавлен в корзину');
  page('cart');
};
function updateCount() {
  document.getElementById('cartCount').textContent = cart.reduce((s, x) => s + x.qty, 0);
  saveCart();
}
function renderCart() {
  let items = document.getElementById('cartItems'),
    bottom = document.getElementById('cartBottom');
  if (!cart.length) {
    items.innerHTML =
      '<div class="empty"><p>В корзине пока ничего нет.</p><button class="btn" data-page="catalog">Перейти в каталог ↗︎</button></div>';
    bottom.innerHTML = '';
    items.querySelector('[data-page]').onclick = () => page('catalog');
    return;
  }
  // "Средняя · 700 г" for pastes, just the volume (or nothing) for care products
  const variant = x => [x.density, x.volume].filter(Boolean).join(' · ') || productById(x.id).category;
  const label = x => esc([x.name, x.volume].filter(Boolean).join(', '));
  items.innerHTML = cart
    .map(
      (x, i) =>
        `<div class="cart-row"><div class="mini-jar">${jarMarkup(x.id)}</div><div><h3>${esc(x.name)}</h3><p>${esc(variant(x))}</p><p>${rub(x.price)} / шт.</p></div><div class="qty"><button data-dec="${i}" aria-label="Уменьшить количество: ${label(x)}">−</button><span aria-live="polite">${x.qty}</span><button data-inc="${i}" aria-label="Увеличить количество: ${label(x)}">+</button></div><div><strong>${rub(x.price * x.qty)}</strong><br><button class="remove" data-remove="${i}" aria-label="Удалить ${label(x)} из корзины">Удалить</button></div></div>`,
    )
    .join('');
  let total = cart.reduce((s, x) => s + x.price * x.qty, 0);
  bottom.innerHTML = `<div class="cart-summary"><div class="summary-line"><span>Товары</span><span>${rub(total)}</span></div><div class="summary-line"><span>Доставка</span><span>Рассчитывается отдельно</span></div><div class="summary-line total"><span>Итого</span><span>${rub(total)}</span></div><button class="btn" id="checkoutBtn" aria-controls="checkout" aria-expanded="${document.getElementById('checkout').classList.contains('show')}">Перейти к оформлению ↗︎</button></div>`;
  // Re-rendering replaces the buttons, so focus is put back where the user was.
  const refocus = sel => (document.querySelector(sel) || document.querySelector('#cart h1')).focus();
  document.querySelectorAll('[data-dec]').forEach(
    b =>
      (b.onclick = () => {
        let i = +b.dataset.dec;
        cart[i].qty = Math.max(1, cart[i].qty - 1);
        updateCount();
        renderCart();
        refocus(`[data-dec="${i}"]`);
      }),
  );
  document.querySelectorAll('[data-inc]').forEach(
    b =>
      (b.onclick = () => {
        let i = +b.dataset.inc;
        cart[i].qty++;
        updateCount();
        renderCart();
        refocus(`[data-inc="${i}"]`);
      }),
  );
  document.querySelectorAll('[data-remove]').forEach(
    b =>
      (b.onclick = () => {
        let i = +b.dataset.remove;
        cart.splice(i, 1);
        updateCount();
        renderCart();
        refocus(`[data-remove="${Math.min(i, cart.length - 1)}"]`);
      }),
  );
  document.getElementById('checkoutBtn').onclick = e => {
    const open = document.getElementById('checkout').classList.toggle('show');
    e.currentTarget.setAttribute('aria-expanded', open);
    if (open) document.getElementById('customerName').focus();
  };
}
// Inline validation: the message is shown under the field (#<id>-error) and linked via aria-describedby.
function fieldError(input) {
  const v = input.value.trim();
  if (input.required && !v) return input.dataset.required || 'Заполните это поле';
  if (input.type === 'tel' && v && !normalizePhone(v)) return 'Введите номер в формате +7 XXX XXX-XX-XX';
  if (input.minLength > 0 && v && input.value.length < input.minLength)
    return `Не менее ${input.minLength} символов`;
  if (input.type === 'email' && v && input.validity.typeMismatch) return 'Проверьте адрес e-mail';
  return '';
}
function setFieldError(input, msg) {
  const err = document.getElementById(input.id + '-error');
  if (err) err.textContent = msg;
  if (msg) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}
function validateFields(inputs) {
  const bad = inputs.filter(input => {
    const msg = fieldError(input);
    setFieldError(input, msg);
    return msg;
  });
  if (bad.length) bad[0].focus();
  return !bad.length;
}
function clearErrors(root) {
  root.querySelectorAll('input').forEach(input => setFieldError(input, ''));
}
document.querySelectorAll('input[aria-describedby$="-error"]').forEach(input =>
  input.addEventListener('input', () => {
    if (input.hasAttribute('aria-invalid')) setFieldError(input, fieldError(input));
  }),
);
document.getElementById('placeOrder').onclick = () => {
  const nameEl = document.getElementById('customerName');
  if (
    !validateFields(['customerName', 'customerPhone', 'customerEmail'].map(id => document.getElementById(id)))
  )
    return;
  const name = nameEl.value.trim();
  document.getElementById('orderName').textContent = name;
  document.getElementById('orderNumber').textContent = 'SL-' + Math.floor(10000 + Math.random() * 89999);
  document.getElementById('checkoutForm').hidden = true;
  document.getElementById('checkoutDone').hidden = false;
  cart = [];
  updateCount();
  renderCart();
  document.getElementById('checkout').classList.add('show');
};
function resetCheckout() {
  ['customerName', 'customerPhone', 'customerCity', 'customerEmail', 'customerComment'].forEach(
    id => (document.getElementById(id).value = ''),
  );
  clearErrors(document.getElementById('checkoutForm'));
  document.getElementById('checkoutForm').hidden = false;
  document.getElementById('checkoutDone').hidden = true;
  document.getElementById('checkout').classList.remove('show');
}
document.getElementById('orderHomeBtn').onclick = () => {
  resetCheckout();
  page('home');
};
document.querySelectorAll('[data-account-tab]').forEach(tab =>
  tab.addEventListener('click', () => {
    const mode = tab.dataset.accountTab;
    document.querySelectorAll('[data-account-tab]').forEach(x => {
      x.classList.toggle('active', x === tab);
      x.setAttribute('aria-selected', x === tab);
      x.tabIndex = x === tab ? 0 : -1;
    });
    document.getElementById('loginForm').hidden = mode !== 'login';
    document.getElementById('registerForm').hidden = mode !== 'register';
  }),
);
function showDemoProfile(name, phone) {
  document.getElementById('dashboardName').textContent = name || 'Гость';
  document.getElementById('profileName').textContent = name || 'Не указано';
  document.getElementById('profilePhone').textContent = phone || 'Не подтверждён';
  document.querySelector('.account-panel').style.display = 'none';
  document.querySelector('.account-aside').style.display = 'none';
  document.getElementById('accountDashboard').classList.add('active');
  window.scrollTo({ top: 0, behavior: scrollBehavior() });
  const title = document.querySelector('#accountDashboard h2');
  title.tabIndex = -1;
  title.focus({ preventScroll: true });
}
function hideDemoProfile() {
  document.querySelector('.account-panel').style.display = '';
  document.querySelector('.account-aside').style.display = '';
  document.getElementById('accountDashboard').classList.remove('active');
}
document.getElementById('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  if (!validateFields([...e.currentTarget.querySelectorAll('input')])) return;
  toast('Это демонстрация профиля: настоящая проверка пароля пока не подключена');
  showDemoProfile('Покупатель', fd.get('phone'));
});
document.getElementById('registerForm').addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  if (!validateFields([...e.currentTarget.querySelectorAll('input')])) return;
  toast('Это предварительный просмотр: аккаунт ещё не создан');
  showDemoProfile(fd.get('name'), fd.get('phone'));
});
document.getElementById('logoutBtn').addEventListener('click', () => {
  hideDemoProfile();
  document.getElementById('loginForm').reset();
  clearErrors(document.getElementById('loginForm'));
  toast('Вы вышли из демонстрационного профиля');
});
document.getElementById('backToAuthBtn').addEventListener('click', hideDemoProfile);
document.getElementById('goCatalogBtn').addEventListener('click', () => page('catalog'));
document
  .getElementById('editProfileBtn')
  .addEventListener('click', () => toast('Редактирование подключим вместе с настоящей базой клиентов'));
document
  .getElementById('forgotPassword')
  .addEventListener('click', () => toast('Восстановление пароля подключим вместе с авторизацией'));
// Accepts +7 / 8 / 7 with 10 national digits, or 10 digits alone; returns E.164 (+7XXXXXXXXXX) or null.
function normalizePhone(value) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) return '+7' + digits.slice(1);
  if (digits.length === 10) return '+7' + digits;
  return null;
}
function formatPhone(e164) {
  const d = e164.slice(2);
  return '+7 ' + d.slice(0, 3) + ' ' + d.slice(3, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8);
}
document.querySelectorAll('input[name="phone"]').forEach(input => {
  input.addEventListener('input', () => {
    const start = input.selectionStart,
      before = input.value;
    let value = before.replace(/[^+0-9()\s-]/g, '');
    if (value !== before) {
      input.value = value;
      try {
        input.setSelectionRange(Math.max(0, start - 1), Math.max(0, start - 1));
      } catch (e) {}
    }
  });
  input.addEventListener('blur', () => {
    const e164 = normalizePhone(input.value);
    if (e164) input.value = formatPhone(e164);
  });
});
function toast(msg) {
  let t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
// Gentle pointer-driven motion on desktop.
window.addEventListener('pointermove', e => {
  document.documentElement.style.setProperty('--mx', e.clientX + 'px');
  document.documentElement.style.setProperty('--my', e.clientY + 'px');
});
renderProducts();
updateCount();
if (location.hash) route('replace');
