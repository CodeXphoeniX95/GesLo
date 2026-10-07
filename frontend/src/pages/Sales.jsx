import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Plus, Minus, Trash2, Eye, XCircle,
  ShoppingCart, Search, CheckCircle, Printer,
} from 'lucide-react';
import { salesApi, productsApi, customersApi, authApi, reportsApi } from '../services/api';
import { exportSalesCSV } from '../utils/export';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'tmoney', label: 'TMoney' },
  { value: 'flooz', label: 'Flooz' },
  { value: 'card', label: 'Carte' },
  { value: 'credit', label: 'Crédit client' },
];

const PAYMENT_LABELS = {
  cash: 'Espèces', tmoney: 'TMoney', flooz: 'Flooz',
  card: 'Carte', credit: 'Crédit', mixed: 'Mixte',
};

// ─── Reçu imprimable ─────────────────────────────────────────────
function Receipt({ sale, settings, onClose }) {
  const printRef = useRef();

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=380,height=600');
    win.document.write(`
      <html>
        <head>
          <title>Reçu ${sale.sale_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; background: #fff; padding: 10px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 6px 0; }
            .double-line { border-top: 3px double #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 2px 0; vertical-align: top; }
            .right { text-align: right; }
            .total-row td { font-weight: bold; font-size: 13px; padding-top: 4px; }
            h1 { font-size: 16px; font-weight: bold; }
            h2 { font-size: 13px; font-weight: bold; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>${content}</body>
        <script>window.onload = function() { window.print(); window.close(); }<\/script>
      </html>
    `);
    win.document.close();
  };

  if (!sale) return null;

  const businessName = settings?.name || 'GesLo';
  const businessPhone = settings?.phone || '';
  const businessAddress = settings?.address || '';
  const footer = settings?.receipt_footer || 'Merci de votre visite !';
  const currency = settings?.currency_symbol || 'FCFA';

  return (
    <div>
      {/* Aperçu du reçu */}
      <div
        ref={printRef}
        style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 12,
          color: '#000',
          background: '#fff',
          padding: 16,
          maxWidth: 320,
          margin: '0 auto',
          border: '1px solid #ddd',
          borderRadius: 4,
        }}
      >
        {/* En-tête */}
        <div className="center" style={{ textAlign: 'center', marginBottom: 8 }}>
          <div className="bold" style={{ fontSize: 15, fontWeight: 700 }}>{businessName}</div>
          {businessAddress && <div>{businessAddress}</div>}
          {businessPhone && <div>Tél : {businessPhone}</div>}
        </div>

        <div className="line" style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        <div style={{ marginBottom: 6 }}>
          <div><span style={{ fontWeight: 700 }}>N° :</span> {sale.sale_number}</div>
          <div><span style={{ fontWeight: 700 }}>Date :</span> {new Date(sale.created_at).toLocaleString('fr-FR')}</div>
          <div><span style={{ fontWeight: 700 }}>Caissier :</span> {sale.cashier_name}</div>
          {sale.customer_name && <div><span style={{ fontWeight: 700 }}>Client :</span> {sale.customer_name}</div>}
        </div>

        <div className="line" style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {/* Articles */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <td style={{ fontWeight: 700, paddingBottom: 4 }}>Article</td>
              <td style={{ fontWeight: 700, textAlign: 'center' }}>Qté</td>
              <td style={{ fontWeight: 700, textAlign: 'right' }}>Total</td>
            </tr>
          </thead>
          <tbody>
            {sale.items?.map((item, i) => (
              <tr key={i}>
                <td style={{ verticalAlign: 'top', paddingBottom: 3 }}>
                  <div>{item.product_name}</div>
                  <div style={{ fontSize: 10 }}>{Number(item.unit_price).toLocaleString('fr-FR')} {currency}</div>
                </td>
                <td style={{ textAlign: 'center', verticalAlign: 'top' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', verticalAlign: 'top', fontWeight: 600 }}>
                  {Number(item.total).toLocaleString('fr-FR')} {currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {/* Totaux */}
        <table style={{ width: '100%' }}>
          <tbody>
            {sale.discount > 0 && (
              <tr>
                <td>Sous-total</td>
                <td style={{ textAlign: 'right' }}>{Number(sale.subtotal).toLocaleString('fr-FR')} {currency}</td>
              </tr>
            )}
            {sale.discount > 0 && (
              <tr>
                <td>Remise</td>
                <td style={{ textAlign: 'right' }}>-{Number(sale.discount).toLocaleString('fr-FR')} {currency}</td>
              </tr>
            )}
            <tr>
              <td style={{ fontWeight: 700, fontSize: 14, paddingTop: 4 }}>TOTAL</td>
              <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                {Number(sale.total).toLocaleString('fr-FR')} {currency}
              </td>
            </tr>
            <tr>
              <td>Paiement</td>
              <td style={{ textAlign: 'right' }}>{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ borderTop: '3px double #000', margin: '8px 0' }} />

        {/* Pied de page */}
        <div style={{ textAlign: 'center', fontSize: 11 }}>{footer}</div>
      </div>

      {/* Boutons */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
        <button className="btn btn-primary" onClick={handlePrint}>
          <Printer size={15} /> Imprimer
        </button>
      </div>
    </div>
  );
}

// ─── Caisse POS ──────────────────────────────────────────────────
function CashRegister({ products, customers, onSale, onClose }) {
  const [cart, setCart] = useState([]);
  const [heldCarts, setHeldCarts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('geslo_held_carts') || '[]'); } catch { return []; }
  });
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [amountReceived, setAmountReceived] = useState('');
  const [saving, setSaving] = useState(false);
  const searchRef = useRef();
  const toast = useToast();

  // ── Raccourcis clavier ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const saveHeld = (carts) => {
    setHeldCarts(carts);
    localStorage.setItem('geslo_held_carts', JSON.stringify(carts));
  };

  const holdCart = () => {
    if (cart.length === 0) return;
    const label = `Panier ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    saveHeld([...heldCarts, { id: Date.now(), label, cart, discount, customerId, paymentMethod }]);
    setCart([]); setDiscount(0); setCustomerId(''); setAmountReceived('');
    toast.info(`Panier mis en attente : "${label}"`);
  };

  const resumeCart = (held) => {
    setCart(held.cart);
    setDiscount(held.discount || 0);
    setCustomerId(held.customerId || '');
    setPaymentMethod(held.paymentMethod || 'cash');
    setAmountReceived('');
    saveHeld(heldCarts.filter((h) => h.id !== held.id));
  };

  const safeProducts = Array.isArray(products) ? products : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];

  const categories = [...new Map(
    safeProducts.filter((p) => p.category_id).map((p) => [p.category_id, { id: p.category_id, name: p.category_name }])
  ).values()];

  const filtered = safeProducts.filter((p) => {
    const matchSearch = (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.reference || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode || '') === search;
    const matchCat = !filterCat || String(p.category_id) === String(filterCat);
    return matchSearch && matchCat;
  });

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      const hasContainer = product.unit_quantity && Number(product.unit_quantity) > 1;
      if (existing) {
        const newQty = existing.quantity + 1;
        const multiplier = (existing.sell_mode === 'container' && hasContainer) ? Number(product.unit_quantity) : 1;
        return prev.map((i) => i.product_id === product.id
          ? { ...i, quantity: newQty, total: newQty * multiplier * i.unit_price } : i);
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        unit_price: product.sale_price,
        quantity: 1,
        sell_mode: 'piece',
        total: product.sale_price,
        stock: product.stock_quantity,
        unit: product.unit || 'pièce',
        unit_quantity: product.unit_quantity,
      }];
    });
  };

  const updateQty = (productId, qty) => {
    if (qty <= 0) { removeFromCart(productId); return; }
    setCart((prev) => prev.map((i) => {
      if (i.product_id !== productId) return i;
      const pcsPerContainer = (i.sell_mode === 'container' && i.unit_quantity > 1) ? Number(i.unit_quantity) : 1;
      return { ...i, quantity: qty, total: qty * pcsPerContainer * i.unit_price };
    }));
  };

  const setSellMode = (productId, mode) => {
    setCart((prev) => prev.map((i) => {
      if (i.product_id !== productId) return i;
      const pcsPerContainer = mode === 'container' && i.unit_quantity > 1 ? Number(i.unit_quantity) : 1;
      return {
        ...i,
        sell_mode: mode,
        quantity: 1,
        total: pcsPerContainer * i.unit_price,
      };
    }));
  };

  const removeFromCart = (productId) => setCart((prev) => prev.filter((i) => i.product_id !== productId));

  const subtotal = cart.reduce((acc, i) => acc + i.total, 0);
  const total = Math.max(subtotal - Number(discount), 0);
  const received = Number(amountReceived) || 0;
  const change = received >= total ? received - total : null;

  const handleSubmit = async () => {
    if (cart.length === 0) { toast.error('Panier vide.'); return; }
    if (paymentMethod === 'cash' && amountReceived && received < total) {
      toast.error(`Montant insuffisant. Il manque ${(total - received).toLocaleString('fr-FR')} FCFA.`);
      return;
    }
    if (paymentMethod === 'credit') {
      if (!customerId) {
        toast.error('Un client doit obligatoirement être sélectionné pour une vente à crédit.');
        return;
      }
      if (received > total) {
        toast.error('L\'acompte ne peut pas être supérieur au total de la vente.');
        return;
      }
    }
    setSaving(true);
    try {
      await onSale({
        items: cart.map((i) => {
          const pcsPerContainer = (i.sell_mode === 'container' && i.unit_quantity > 1) ? Number(i.unit_quantity) : 1;
          const realQty = i.quantity * pcsPerContainer;
          return {
            product_id: i.product_id,
            quantity: realQty,
            unit_price: i.unit_price,
          };
        }),
        payment_method: paymentMethod,
        customer_id: customerId || undefined,
        discount: Number(discount),
        amount_paid: paymentMethod === 'credit' ? received : undefined,
      });
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, height: '70vh' }}>
      {/* Catalogue */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <Search size={15} className="search-icon" />
            <input
              ref={searchRef}
              className="form-control"
              placeholder="Rechercher (F2)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="form-control" style={{ maxWidth: 140 }} value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">Toutes</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Paniers en attente */}
        {heldCarts.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {heldCarts.map((h) => (
              <button key={h.id} className="btn btn-secondary btn-sm" onClick={() => resumeCart(h)}
                title="Reprendre ce panier">
                {h.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {filtered.map((p) => {
              const hasContainer = p.unit_quantity && Number(p.unit_quantity) > 1;
              return (
                <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock_quantity <= 0}
                  style={{
                    padding: '0.7rem 0.6rem', border: '1px solid var(--gray-200)',
                    borderRadius: 8, background: p.stock_quantity <= 0 ? 'var(--gray-50)' : '#fff',
                    cursor: p.stock_quantity <= 0 ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                  }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 3, lineHeight: 1.3 }}>{p.name}</div>
                  <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem' }}>
                    {p.sale_price.toLocaleString('fr-FR')} FCFA
                  </div>
                  <div style={{ fontSize: '0.7rem', color: p.stock_quantity <= 0 ? 'var(--danger)' : 'var(--gray-500)', marginTop: 2 }}>
                    Stock : {p.stock_quantity} {p.unit}
                    {hasContainer && (
                      <span style={{ display: 'block', color: 'var(--primary)', fontWeight: 600 }}>
                        1 {p.unit} = {p.unit_quantity} pcs
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panier */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderLeft: '1px solid var(--gray-200)', paddingLeft: 16 }}>
        <h3 style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShoppingCart size={16} />
          Panier ({cart.length})
          {cart.length > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--warning)' }}
              onClick={holdCart} title="Mettre en attente">
              En attente
            </button>
          )}
        </h3>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cart.length === 0 && (
            <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', textAlign: 'center', marginTop: 24 }}>
              Cliquez sur un produit pour l&apos;ajouter.
            </p>
          )}
          {cart.map((item) => {
            const hasContainer = item.unit_quantity && Number(item.unit_quantity) > 1;
            const containerName = item.unit || 'carton';
            const pcsPerContainer = Number(item.unit_quantity) || 1;

            return (
              <div key={item.product_id} style={{
                display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px',
                background: 'var(--gray-50)', borderRadius: 6, border: '1px solid var(--gray-100)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.product_name}
                    </div>
                    <div style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}>
                      {item.unit_price.toLocaleString('fr-FR')} FCFA / {item.unit || 'unité'}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeFromCart(item.product_id)}>
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Choix du Mode : 1 par 1 vs En unité / Carton */}
                {hasContainer && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${item.sell_mode !== 'container' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.72rem', padding: '2px 8px', flex: 1 }}
                      onClick={() => setSellMode(item.product_id, 'piece')}
                    >
                      1 par 1 (Pièce)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${item.sell_mode === 'container' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.72rem', padding: '2px 8px', flex: 1 }}
                      onClick={() => setSellMode(item.product_id, 'container')}
                    >
                      En {containerName} ({pcsPerContainer} pcs)
                    </button>
                  </div>
                )}

                {/* Saisie directe de quantité */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => updateQty(item.product_id, item.quantity - 1)}><Minus size={12} /></button>
                    <input
                      className="form-control"
                      type="number"
                      min="1"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => updateQty(item.product_id, Math.max(1, Number(e.target.value) || 1))}
                      style={{ width: 64, textAlign: 'center', padding: '2px 4px', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => updateQty(item.product_id, item.quantity + 1)}><Plus size={12} /></button>
                    <span style={{ fontSize: '0.78rem', color: 'var(--gray-600)', fontWeight: 600 }}>
                      {item.sell_mode === 'container' ? `${containerName}(s)` : `${item.unit || 'pièce'}(s)`}
                    </span>
                  </div>

                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--gray-800)' }}>
                    {item.total.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>

                {/* Information de déduction stock si en mode carton */}
                {hasContainer && item.sell_mode === 'container' && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600, marginTop: 2, background: 'var(--primary-50)', padding: '2px 6px', borderRadius: 4 }}>
                    Soit {item.quantity} {containerName}{item.quantity > 1 ? 's' : ''} = <strong>{item.quantity * pcsPerContainer} pièces</strong> déduites du stock.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Résumé & paiement */}
        <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--gray-500)' }}>
            <span>Sous-total</span><span>{subtotal.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--gray-500)', fontSize: '0.82rem', flex: 1 }}>Remise</span>
            <input className="form-control" type="number" min="0" value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              style={{ width: 90, textAlign: 'right', fontSize: '0.82rem' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', padding: '2px 0', borderTop: '1px solid var(--gray-200)' }}>
            <span>TOTAL</span>
            <span style={{ color: 'var(--primary)' }}>{total.toLocaleString('fr-FR')} FCFA</span>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Mode de paiement</label>
            <select className="form-control" value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setAmountReceived(''); }}>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Monnaie à rendre — uniquement pour espèces */}
          {paymentMethod === 'cash' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--gray-500)', fontSize: '0.78rem', flex: 1 }}>Montant reçu</span>
                <input className="form-control" type="number" min="0" value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  placeholder={total}
                  style={{ width: 100, textAlign: 'right', fontSize: '0.85rem' }} />
              </div>
              {change !== null && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'var(--success-bg)', border: '1px solid #86efac',
                  borderRadius: 6, padding: '6px 10px', marginTop: 4,
                }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--success)' }}>Monnaie à rendre</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)' }}>
                    {change.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              )}
              {amountReceived && received < total && (
                <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: 2 }}>
                  Manque : {(total - received).toLocaleString('fr-FR')} FCFA
                </div>
              )}
            </div>
          )}

          {/* Saisie Acompte & Calcul Dette pour vente à crédit */}
          {paymentMethod === 'credit' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--gray-500)', fontSize: '0.78rem', flex: 1 }}>Acompte versé</span>
                <input className="form-control" type="number" min="0" value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  placeholder="0"
                  style={{ width: 100, textAlign: 'right', fontSize: '0.85rem' }} />
              </div>
              <div style={{
                background: '#fef3c7', border: '1px solid #fde047',
                borderRadius: 6, padding: '6px 10px', marginTop: 4,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#92400e' }}>
                  <span>Acompte versé :</span>
                  <strong>{received.toLocaleString('fr-FR')} FCFA</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700, color: '#b45309', marginTop: 2 }}>
                  <span>Reste à payer (Crédit) :</span>
                  <span>{Math.max(0, total - received).toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>
              Client {paymentMethod === 'credit' ? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>* (Requis pour crédit)</span> : '(Optionnel)'}
            </label>
            <select
              className="form-control"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              style={{
                borderColor: paymentMethod === 'credit' && !customerId ? 'var(--danger)' : undefined,
                backgroundColor: paymentMethod === 'credit' && !customerId ? '#fef2f2' : undefined,
              }}
            >
              <option value="">— Sélectionner un client —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {paymentMethod === 'credit' && !customerId && (
              <div style={{ color: 'var(--danger)', fontSize: '0.72rem', marginTop: 2, fontWeight: 600 }}>
                Sélection obligatoire pour enregistrer une vente à crédit.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Fermer (Échap)</button>
            <button className="btn btn-success" style={{ flex: 2 }} onClick={handleSubmit}
              disabled={saving || cart.length === 0}>
              <CheckCircle size={15} />
              {saving ? 'Traitement…' : `Valider — ${total.toLocaleString('fr-FR')} FCFA`}
            </button>
          </div>
          <p style={{ fontSize: '0.65rem', color: 'var(--gray-400)', textAlign: 'center' }}>
            F2 = focus recherche · Échap = fermer
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────
export default function Sales() {
  const getTodayStr = () => new Date().toISOString().slice(0, 10);
  const today = getTodayStr();

  const [sales, setSales] = useState([]);
  const [salesSearch, setSalesSearch] = useState('');
  const [filterStart, setFilterStart] = useState(today);
  const [filterEnd, setFilterEnd] = useState(today);
  const [filterUser, setFilterUser] = useState('');
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [receiptSale, setReceiptSale] = useState(null);
  const [cancelDialog, setCancelDialog] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const toast = useToast();

  // Charger les ventes selon les filtres backend
  const load = useCallback(() => {
    setLoading(true);
    const params = { limit: 200 };
    if (filterStart) params.start_date = filterStart;
    if (filterEnd) params.end_date = filterEnd;
    if (filterUser) params.user_id = filterUser;
    salesApi.getAll(params)
      .then((res) => {
        setSales(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
  }, [filterStart, filterEnd, filterUser]);

  useEffect(() => {
    load();
    productsApi.getAll({ active_only: 'true' })
      .then((r) => setProducts(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProducts([]));
    customersApi.getAll()
      .then((r) => setCustomers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCustomers([]));
    reportsApi.getSettings().then((r) => setSettings(r.data)).catch(() => {});
    // Charger les utilisateurs — endpoint public pour les admins/gérants
    authApi.getUsers()
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setUsers([]));
  }, [load]);

  // Filtre texte local (mémorisé pour éviter les rendus en cascade)
  const filteredSales = useMemo(() => {
    const safeSales = Array.isArray(sales) ? sales : [];
    if (!salesSearch) return safeSales;
    const q = salesSearch.toLowerCase();
    return safeSales.filter((s) =>
      (s.sale_number || '').toLowerCase().includes(q) ||
      (s.cashier_name || '').toLowerCase().includes(q) ||
      (s.customer_name || '').toLowerCase().includes(q)
    );
  }, [salesSearch, sales]);

  const handleSale = async (data) => {
    try {
      const res = await salesApi.create(data);
      toast.success('Vente enregistrée.');
      setModal(null);
      load();
      // Ouvrir le reçu automatiquement après la vente
      const detail = await salesApi.getOne(res.data.id);
      setReceiptSale(detail.data);
      setModal('receipt');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la vente.');
    }
  };

  const handleCancel = async () => {
    try {
      await salesApi.cancel(cancelDialog.id, { reason: cancelReason });
      toast.success('Vente annulée.');
      setCancelDialog(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };

  const viewSale = async (id) => {
    const res = await salesApi.getOne(id);
    setSelected(res.data); setModal('detail');
  };

  const openReceipt = async (id) => {
    const res = await salesApi.getOne(id);
    setReceiptSale(res.data); setModal('receipt');
  };

  const resetFilters = () => {
    setFilterStart(today); setFilterEnd(today);
    setFilterUser(''); setSalesSearch('');
  };

  const isTodayView = filterStart === today && filterEnd === today;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Ventes & Caisse</h1>
          <p className="page-header-subtitle">
            {filteredSales.length} vente{filteredSales.length > 1 ? 's' : ''}
            {isTodayView && <span className="badge badge-success" style={{ marginLeft: 8 }}>Aujourd&apos;hui</span>}
          </p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => setModal('pos')}>
          <ShoppingCart size={16} /> Nouvelle vente
        </button>
        <button className="btn btn-secondary" onClick={() => exportSalesCSV(filteredSales)}
          title="Exporter en CSV" disabled={filteredSales.length === 0}>
          Export CSV
        </button>
      </div>

      {/* Filtres */}
      <div className="filters-bar" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, alignSelf: 'flex-end' }}>
          <button
            type="button"
            className={`btn btn-sm ${isTodayView ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setFilterStart(today); setFilterEnd(today); }}
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            className={`btn btn-sm ${!filterStart && !filterEnd ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setFilterStart(''); setFilterEnd(''); }}
          >
            Tout l&apos;historique
          </button>
        </div>
        <div className="search-input-wrapper" style={{ flex: '1 1 180px', minWidth: 160 }}>
          <Search size={15} className="search-icon" />
          <input className="form-control" placeholder="N° vente, caissier, client…" value={salesSearch}
            onChange={(e) => setSalesSearch(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Du</label>
          <input className="form-control" type="date" value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Au</label>
          <input className="form-control" type="date" value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Employé</label>
          <select className="form-control" style={{ minWidth: 140 }} value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}>
            <option value="">Tous les employés</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>{u.full_name}</option>
            ))}
          </select>
        </div>
        {(filterStart !== today || filterEnd !== today || filterUser || salesSearch) && (
          <button className="btn btn-secondary" style={{ alignSelf: 'flex-end' }} onClick={resetFilters}>
            Réinitialiser
          </button>
        )}
      </div>

      {loading ? <Spinner /> : filteredSales.length === 0 ? (
        <EmptyState icon={ShoppingCart}
          title={salesSearch || filterUser || filterStart ? 'Aucun résultat' : 'Aucune vente'}
          message="Modifiez les filtres ou enregistrez une nouvelle vente." />
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>N° Vente</th><th>Date</th><th>Caissier</th><th>Articles</th>
                  <th>Total</th><th>Paiement</th><th>Statut</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((s) => (
                  <tr key={s.id}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--gray-500)' }}>{s.sale_number}</span></td>
                    <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{new Date(s.created_at).toLocaleString('fr-FR')}</td>
                    <td>{s.cashier_name}</td>
                    <td><span className="badge badge-gray">{s.item_count}</span></td>
                    <td><strong>{s.total?.toLocaleString('fr-FR')} FCFA</strong></td>
                    <td><span className="badge badge-primary">{PAYMENT_LABELS[s.payment_method] || s.payment_method}</span></td>
                    <td>
                      <span className={`badge badge-${s.status === 'completed' ? 'success' : s.status === 'cancelled' ? 'danger' : 'warning'}`}>
                        {s.status === 'completed' ? 'Complétée' : s.status === 'cancelled' ? 'Annulée' : 'En attente'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Voir le détail" onClick={() => viewSale(s.id)}>
                          <Eye size={14} />
                        </button>
                        {s.status === 'completed' && (
                          <button className="btn btn-ghost btn-icon btn-sm" title="Imprimer le reçu"
                            style={{ color: 'var(--primary)' }} onClick={() => openReceipt(s.id)}>
                            <Printer size={14} />
                          </button>
                        )}
                        {s.status === 'completed' && (
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }}
                            title="Annuler la vente"
                            onClick={() => { setCancelDialog(s); setCancelReason(''); }}>
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Caisse */}
      <Modal isOpen={modal === 'pos'} onClose={() => setModal(null)} title="Nouvelle vente" size="lg">
        <CashRegister products={products} customers={customers} onSale={handleSale} onClose={() => setModal(null)} />
      </Modal>

      {/* Détail vente */}
      <Modal isOpen={modal === 'detail'} onClose={() => setModal(null)} title={`Vente — ${selected?.sale_number}`} size="lg">
        {selected && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><strong>Date :</strong> {new Date(selected.created_at).toLocaleString('fr-FR')}</div>
              <div><strong>Caissier :</strong> {selected.cashier_name}</div>
              <div><strong>Client :</strong> {selected.customer_name || 'Anonyme'}</div>
              <div><strong>Paiement :</strong> {PAYMENT_LABELS[selected.payment_method] || selected.payment_method}</div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Produit</th><th>Qté</th><th>Prix unit.</th><th>Total</th></tr></thead>
                <tbody>
                  {selected.items?.map((i) => (
                    <tr key={i.id}>
                      <td>{i.product_name}</td>
                      <td>{i.quantity}</td>
                      <td>{i.unit_price?.toLocaleString('fr-FR')} FCFA</td>
                      <td><strong>{i.total?.toLocaleString('fr-FR')} FCFA</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              {selected.discount > 0 && (
                <div style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                  Remise : -{selected.discount?.toLocaleString('fr-FR')} FCFA
                </div>
              )}
              <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: 4 }}>
                Total : {selected.total?.toLocaleString('fr-FR')} FCFA
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
              <button className="btn btn-primary" onClick={() => { setReceiptSale(selected); setModal('receipt'); }}>
                <Printer size={15} /> Voir le reçu
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reçu */}
      <Modal isOpen={modal === 'receipt'} onClose={() => setModal(null)} title="Reçu" size="sm">
        <Receipt sale={receiptSale} settings={settings} onClose={() => setModal(null)} />
      </Modal>

      {/* Annulation */}
      <Modal isOpen={!!cancelDialog} onClose={() => setCancelDialog(null)} title="Annuler la vente" size="sm">
        <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: 12 }}>
          Vente <strong>{cancelDialog?.sale_number}</strong> — {cancelDialog?.total?.toLocaleString('fr-FR')} FCFA
        </p>
        <div className="form-group">
          <label className="form-label">Motif d&apos;annulation</label>
          <input className="form-control" value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex : Erreur de saisie" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setCancelDialog(null)}>Retour</button>
          <button className="btn btn-danger" onClick={handleCancel}>Confirmer l&apos;annulation</button>
        </div>
      </Modal>
    </>
  );
}
