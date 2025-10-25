"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export interface GenericStringStorage {
  getItem(key: string): string | Promise<string | null> | null;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

class GenericStringInMemoryStorage implements GenericStringStorage {
  #store = new Map<string, string>();
  getItem(key: string) {
    return this.#store.has(key) ? this.#store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.#store.set(key, value);
  }
  removeItem(key: string) {
    this.#store.delete(key);
  }
}

const Ctx = createContext<{ storage: GenericStringStorage } | undefined>(undefined);

export const InMemoryStorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storage] = useState<GenericStringStorage>(new GenericStringInMemoryStorage());
  const value = useMemo(() => ({ storage }), [storage]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useInMemoryStorage = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInMemoryStorage must be used within provider");
  return ctx;
};





