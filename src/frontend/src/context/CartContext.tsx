import React, { createContext, useContext, useState, useEffect } from "react";

export interface CartItem {
  productId?: string;
  packId?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  increaseQuantity: (index: number) => void;
  decreaseQuantity: (index: number) => void;
  clearCart: () => void;
  subtotal: number;
  total: number;
}

const STORAGE_KEY = "dxn_cart";

const roundMoney = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  increaseQuantity: () => {},
  decreaseQuantity: () => {},
  clearCart: () => {},
  subtotal: 0,
  total: 0,
});

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item: CartItem) => {
    setItems((current) => {
      const existing = current.findIndex(
        (i) => i.productId === item.productId && i.packId === item.packId
      );
      if (existing >= 0) {
        const next = [...current];
        next[existing] = {
          ...next[existing],
          quantity: next[existing].quantity + item.quantity,
          totalPrice: roundMoney(
            (next[existing].quantity + item.quantity) * next[existing].unitPrice
          ),
        };
        return next;
      }
      return [...current, item];
    });
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const increaseQuantity = (index: number) => {
    setItems((current) =>
      current.map((i, idx) =>
        idx === index
          ? { ...i, quantity: i.quantity + 1, totalPrice: roundMoney((i.quantity + 1) * i.unitPrice) }
          : i
      )
    );
  };

  const decreaseQuantity = (index: number) => {
    setItems((current) =>
      current
        .map((i, idx) =>
          idx === index
            ? {
                ...i,
                quantity: Math.max(1, i.quantity - 1),
                totalPrice: roundMoney(Math.max(1, i.quantity - 1) * i.unitPrice),
              }
            : i
        )
    );
  };

  const clearCart = () => setItems([]);

  const subtotal = roundMoney(items.reduce((sum, i) => sum + i.totalPrice, 0));
  const total = subtotal;

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, increaseQuantity, decreaseQuantity, clearCart, subtotal, total }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);

export default CartContext;
