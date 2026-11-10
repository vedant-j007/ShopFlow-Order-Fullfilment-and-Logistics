import { createContext, useContext, useEffect, useState } from 'react';

const CART_KEY = 'shopflow.cart';
const CartContext = createContext(null);

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) ?? [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // storage unavailable: cart lives for this tab only
    }
  }, [items]);

  // A single order line ships from one warehouse, so quantity is capped at
  // the largest single-warehouse stock (max_orderable), not the total.
  const add = (product) =>
    setItems((current) => {
      const existing = current.find((i) => i.product_id === product.product_id);
      if (existing) {
        return current.map((i) =>
          i.product_id === product.product_id
            ? { ...i, max_orderable: product.max_orderable, quantity: Math.min(i.quantity + 1, product.max_orderable) }
            : i,
        );
      }
      const { product_id, name, price, category, max_orderable } = product;
      return [...current, { product_id, name, price, category, max_orderable, quantity: 1 }];
    });

  const setQuantity = (productId, quantity) =>
    setItems((current) =>
      current.map((i) =>
        i.product_id === productId ? { ...i, quantity: Math.max(1, Math.min(quantity, i.max_orderable)) } : i,
      ),
    );

  const value = {
    items,
    add,
    setQuantity,
    remove: (productId) => setItems((current) => current.filter((i) => i.product_id !== productId)),
    clear: () => setItems([]),
    quantityOf: (productId) => items.find((i) => i.product_id === productId)?.quantity ?? 0,
    count: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: items.reduce((sum, i) => sum + i.quantity * i.price, 0),
  };

  return <CartContext value={value}>{children}</CartContext>;
}

export const useCart = () => useContext(CartContext);
