import { useEffect, useMemo, useState } from 'react';
import { Flame, Plus, Search, SearchX, Warehouse } from 'lucide-react';
import { useApi } from '../../lib/useApi';
import { money } from '../../lib/format';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import CategoryArt from '../../components/CategoryArt';
import { EmptyState, ErrorBlock, LoadingBlock, Modal, Spinner } from '../../components/ui';

const SORT_OPTIONS = [
  ['popular', 'Most popular'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['name', 'Name'],
];

function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function useAddToCart() {
  const { add, quantityOf } = useCart();
  const toast = useToast();
  return (product) => {
    if (quantityOf(product.product_id) >= product.max_orderable) {
      toast.info(`Only ${product.max_orderable} × ${product.name} can ship from a single warehouse`);
      return;
    }
    add(product);
    toast.success(`Added ${product.name} to your cart`);
  };
}

function StockNote({ product }) {
  if (product.max_orderable === 0) return <span className="text-xs font-medium text-rose-600">Out of stock</span>;
  if (product.max_orderable <= 10) return <span className="text-xs font-medium text-amber-600">Only {product.max_orderable} left</span>;
  return <span className="text-xs text-slate-500">In stock</span>;
}

function ProductCard({ product, bestseller, onOpen, onAdd }) {
  const soldOut = product.max_orderable === 0;
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <button type="button" onClick={onOpen} className="relative text-left" aria-label={`View ${product.name}`}>
        <CategoryArt
          category={product.category}
          className="aspect-[4/3] w-full transition group-hover:brightness-[1.03]"
          iconClassName="size-14"
        />
        {bestseller && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700 shadow-sm">
            <Flame className="size-3.5 text-orange-500" /> Bestseller
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-indigo-600">{product.category}</p>
        <button type="button" onClick={onOpen} className="mt-1 text-left">
          <h3 className="line-clamp-2 font-medium text-slate-900 hover:text-indigo-600">{product.name}</h3>
        </button>
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{product.description}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">{money(product.price)}</p>
            <StockNote product={product} />
          </div>
          <button className="btn btn-primary" onClick={onAdd} disabled={soldOut}>
            <Plus className="size-4" /> Add
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductModal({ productId, onClose, onAdd }) {
  const { data: product, error } = useApi(`/products/${productId}`);
  const maxStock = product ? Math.max(1, ...product.stock_by_warehouse.map((w) => w.stock_qty)) : 1;

  return (
    <Modal title="Product details" onClose={onClose} className="max-w-2xl">
      {error && <p className="text-sm text-rose-600">{error.message}</p>}
      {!product && !error && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {product && (
        <div className="grid gap-6 sm:grid-cols-2">
          <CategoryArt category={product.category} className="aspect-square w-full rounded-xl" iconClassName="size-20" />
          <div className="flex flex-col">
            <p className="text-xs font-medium text-indigo-600">{product.category}</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">{product.name}</h3>
            <p className="mt-1 text-xs text-slate-500">Supplied by {product.supplier}</p>
            <p className="mt-3 text-sm text-slate-600">{product.description}</p>
            <p className="mt-4 text-2xl font-semibold">{money(product.price)}</p>

            <div className="mt-5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Warehouse className="size-3.5" /> Stock by warehouse
              </p>
              <ul className="mt-2 space-y-2.5">
                {product.stock_by_warehouse.map((w) => (
                  <li key={w.warehouse}>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">{w.warehouse}</span>
                      <span className="font-medium text-slate-900 tabular-nums">{w.stock_qty} units</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-chart-track">
                      <div className="h-full rounded-full bg-chart-1" style={{ width: `${(w.stock_qty / maxStock) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <button
              className="btn btn-primary mt-6"
              onClick={onAdd}
              disabled={!product.stock_by_warehouse.some((w) => w.stock_qty > 0)}
            >
              <Plus className="size-4" /> Add to cart
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState('popular');
  const [inStock, setInStock] = useState(false);
  const [openProduct, setOpenProduct] = useState(null);
  const debouncedSearch = useDebounced(search);
  const addToCart = useAddToCart();

  const params = new URLSearchParams({ sort, ...(debouncedSearch && { search: debouncedSearch }), ...(categoryId && { category_id: categoryId }), ...(inStock && { in_stock: 'true' }) });
  const products = useApi(`/products?${params}`);
  const categories = useApi('/categories');

  const bestsellers = useMemo(
    () =>
      new Set(
        [...(products.data ?? [])]
          .filter((p) => p.units_sold > 0)
          .sort((a, b) => b.units_sold - a.units_sold)
          .slice(0, 3)
          .map((p) => p.product_id),
      ),
    [products.data],
  );

  const chip = (active) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition ${
      active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
    }`;

  return (
    <div>
      <div className="mb-8 overflow-hidden rounded-3xl bg-linear-to-br from-indigo-600 to-violet-600 px-6 py-10 text-white sm:px-10">
        <p className="text-sm font-medium text-indigo-100">Fulfilled from Mumbai, Delhi NCR &amp; Bengaluru</p>
        <h1 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Everything you need, shipped from the nearest warehouse.</h1>
        <div className="relative mt-6 max-w-lg">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products or categories…"
            className="w-full rounded-xl border-0 bg-white py-3 pr-4 pl-10 text-sm text-slate-900 shadow-lg shadow-indigo-900/20 placeholder:text-slate-400 focus:ring-4 focus:ring-white/40 focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:min-w-0 sm:flex-1 sm:px-0">
          <button className={chip(!categoryId)} onClick={() => setCategoryId('')}>
            All
          </button>
          {categories.data?.map((c) => (
            <button key={c.category_id} className={chip(String(c.category_id) === categoryId)} onClick={() => setCategoryId(String(c.category_id))}>
              {c.name}
              <span className="ml-1.5 opacity-60">{c.product_count}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="size-4 rounded accent-indigo-600" />
          In stock only
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input w-auto" aria-label="Sort products">
          {SORT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {products.error && <ErrorBlock error={products.error} onRetry={products.reload} />}
      {!products.data && !products.error && <LoadingBlock label="Loading products…" />}
      {products.data?.length === 0 && (
        <div className="card">
          <EmptyState icon={SearchX} title="No products match your filters">
            Try a different search term or category.
          </EmptyState>
        </div>
      )}
      {products.data?.length > 0 && (
        <>
          <p className="mb-3 text-sm text-slate-500">{products.data.length} products</p>
          <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${products.loading ? 'opacity-60' : ''}`}>
            {products.data.map((product) => (
              <ProductCard
                key={product.product_id}
                product={product}
                bestseller={bestsellers.has(product.product_id)}
                onOpen={() => setOpenProduct(product)}
                onAdd={() => addToCart(product)}
              />
            ))}
          </div>
        </>
      )}

      {openProduct && (
        <ProductModal
          productId={openProduct.product_id}
          onClose={() => setOpenProduct(null)}
          onAdd={() => addToCart(openProduct)}
        />
      )}
    </div>
  );
}
