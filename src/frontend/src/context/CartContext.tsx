import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { reconcileCart, CatalogEntry, ReconcileItem } from "../utils/cartReconcile";

export interface CartItem {
  productId?: string;
  packId?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

interface ReconcileSource {
  products: ReadonlyMap<string, CatalogEntry>;
  packs: ReadonlyMap<string, CatalogEntry>;
  available: boolean;
}

interface CartContextType {
  items: CartItem[];
  liveItems: ReconcileItem[];
  validItems: ReconcileItem[];
  invalidItems: ReconcileItem[];
  hasInvalid: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  increaseQuantity: (index: number) => void;
  decreaseQuantity: (index: number) => void;
  clearCart: () => void;
  reconcile: (
    products?: ReadonlyMap<string, CatalogEntry> | null,
    packs?: ReadonlyMap<string, CatalogEntry> | null,
    available?: boolean
  ) => void;
  subtotal: number;
  total: number;
}

const STORAGE_KEY = "dxn_cart";

const roundMoney = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const asOk = (item: CartItem): ReconcileItem => ({ ...item, status: "ok", reasons: [] });

const CartContext = createContext<CartContextType>({
  items: [],
  liveItems: [],
  validItems: [],
  invalidItems: [],
  hasInvalid: false,
  addItem: () => {},
  removeItem: () => {},
  increaseQuantity: () => {},
  decreaseQuantity: () => {},
  clearCart: () => {},
  reconcile: () => {},
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

  // The authoritative catalog snapshot the pages fetched last. Until a page
  // calls reconcile() (or if the fetch failed: available=false) every line is
  // kept as "ok" so a transient network failure can never wipe a real cart.
  const [reconcileSource, setReconcileSource] = useState<ReconcileSource | null>(null);

  const [liveItems, setLiveItems] = useState<ReconcileItem[]>(() => []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (!reconcileSource) {
      setLiveItems(items.map(asOk));
      return;
    }
    const { items: reconciled, subtotal: _subtotal } = reconcileCart(
      items,
      reconcileSource.products,
      reconcileSource.packs,
      reconcileSource.available
    );
    setLiveItems(reconciled);
  }, [items, reconcileSource]);

  const reconcile = useCallback((
    products?: ReadonlyMap<string, CatalogEntry> | null,
    packs?: ReadonlyMap<string, CatalogEntry> | null,
    available = true
  ) => {
    setReconcileSource({
      products: products || new Map(),
      packs: packs || new Map(),
      available: available && !!(products && packs),
    });
  }, []);

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

  const validItems = liveItems.filter((i) => i.status === "ok");
  const invalidItems = liveItems.filter((i) => i.status !== "ok");
  const subtotal = roundMoney(validItems.reduce((sum, i) => sum + Number(i.totalPrice || 0), 0));
  const total = subtotal;

  return (
    <CartContext.Provider
      value={{
        items,
        liveItems,
        validItems,
        invalidItems,
        hasInvalid: invalidItems.length > 0,
        addItem,
        removeItem,
        increaseQuantity,
        decreaseQuantity,
        clearCart,
        reconcile,
        subtotal,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);

export default CartContext;